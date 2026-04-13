use std::collections::HashMap;

use tauri::Manager;
use tauri_plugin_shell::ShellExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      // Shell plugin required for sidecar() API.
      app.handle().plugin(tauri_plugin_shell::init())?;

      // Spawn bundled backend sidecar (Windows packaging target).
      // In dev you can still run backend manually; this sidecar will only work when present in bundle.
      let handle = app.handle().clone();
      let app_data = handle
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| std::env::current_dir().unwrap());
      let _ = std::fs::create_dir_all(&app_data);

      // Use AppData DB path by default when desktop sidecar runs.
      let db_path = app_data.join("app.db");
      let db_url = format!("sqlite:///{}", db_path.to_string_lossy().replace('\\', "/"));

      let mut env: HashMap<String, String> = HashMap::new();
      env.insert("WM_DATABASE_URL".into(), db_url);
      env.insert("WM_HOST".into(), "127.0.0.1".into());
      env.insert("WM_PORT".into(), "8000".into());

      // Best-effort: if sidecar exists in bundle, start it.
      // (When missing, we keep app running; user can run API manually.)
      if let Ok(cmd) = handle.shell().sidecar("wm-backend") {
        let _ = cmd.envs(env).spawn();
      }

      if cfg!(debug_assertions) {
        handle.plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
