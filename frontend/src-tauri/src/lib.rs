use std::collections::HashMap;
use std::sync::Mutex;

use tauri::Manager;
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::ShellExt;

/// Holds the spawned backend sidecar child so we can kill it on exit.
struct BackendChild(Mutex<Option<CommandChild>>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .manage(BackendChild(Mutex::new(None)))
    .setup(|app| {
      app.handle().plugin(tauri_plugin_shell::init())?;

      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      let handle = app.handle().clone();

      // Resolve AppData dir for DB storage.
      let app_data = handle
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| std::env::current_dir().unwrap());
      let _ = std::fs::create_dir_all(&app_data);

      let db_path = app_data.join("app.db");
      let db_url = format!("sqlite:///{}", db_path.to_string_lossy().replace('\\', "/"));

      let mut env: HashMap<String, String> = HashMap::new();
      env.insert("WM_DATABASE_URL".into(), db_url);
      env.insert("WM_HOST".into(), "127.0.0.1".into());
      env.insert("WM_PORT".into(), "8000".into());

      // Spawn sidecar and store child handle so we can kill it on window close.
      if let Ok(cmd) = handle.shell().sidecar("wm-backend") {
        match cmd.envs(env).spawn() {
          Ok((_rx, child)) => {
            let state = handle.state::<BackendChild>();
            *state.0.lock().unwrap() = Some(child);
          }
          Err(e) => {
            eprintln!("[sidecar] Failed to spawn wm-backend: {e}");
          }
        }
      }

      Ok(())
    })
    .on_window_event(|window, event| {
      if let tauri::WindowEvent::CloseRequested { .. } = event {
        // Kill backend process when the main window is closed.
        // Use a block so MutexGuard is dropped before end of closure (borrow checker).
        let child = {
          let state = window.state::<BackendChild>();
          let mut guard = state.0.lock().unwrap();
          let x = guard.take();
          x
        };
        if let Some(c) = child {
          let _ = c.kill();
        }
      }
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
