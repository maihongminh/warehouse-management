use std::collections::HashMap;
use std::sync::Mutex;

use tauri::Manager;
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::ShellExt;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

/// Holds the spawned backend sidecar child so we can kill it on exit.
struct BackendChild(Mutex<Option<CommandChild>>);

/// Kill the sidecar child stored in app state, then fall back to
/// `taskkill /F /IM wm-backend.exe` on Windows in case the handle is stale.
fn kill_backend(app: &tauri::AppHandle) {
  // 1. Try killing via the stored CommandChild handle.
  let child = {
    let state = app.state::<BackendChild>();
    let mut guard = state.0.lock().unwrap();
    let x = guard.take();
    x
  };
  if let Some(c) = child {
    let _ = c.kill();
  }

  // 2. Windows fallback: force-kill any remaining wm-backend.exe process.
  //    This handles cases where the child handle is stale (e.g. the process
  //    survived a previous crash or was not tracked properly).
  #[cfg(target_os = "windows")]
  {
    let _ = std::process::Command::new("taskkill")
      .args(["/F", "/IM", "wm-backend*.exe"])
      .creation_flags(0x08000000) // CREATE_NO_WINDOW — run silently
      .spawn();
  }
}

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
      env.insert("WM_PORT".into(), "14802".into());

      // ── Windows Network Isolation fix ────────────────────────────────────
      // WebView2 on some Windows machines cannot connect to localhost by default
      // due to the Windows network isolation policy (loopback restriction).
      // Running CheckNetIsolation adds a loopback exemption for WebView2 so that
      // fetch() calls from inside the WebView can reach 127.0.0.1:8000.
      #[cfg(target_os = "windows")]
      {
        let _ = std::process::Command::new("CheckNetIsolation")
          .args(["LoopbackExempt", "-a", "-n=Microsoft.Win32WebViewHost_cw5n1h2txyewy"])
          .creation_flags(0x08000000) // CREATE_NO_WINDOW — run silently
          .spawn();
        // Small delay so that isolation policy is applied before WebView initializes.
        std::thread::sleep(std::time::Duration::from_millis(300));
      }

      // Kill any leftover backend from a previous abnormal exit before spawning.
      #[cfg(target_os = "windows")]
      {
        let _ = std::process::Command::new("taskkill")
          .args(["/F", "/IM", "wm-backend*.exe"])
          .creation_flags(0x08000000)
          .spawn();
        // Small delay so the port is freed before we bind again.
        std::thread::sleep(std::time::Duration::from_millis(500));
      }

      // Spawn sidecar and store child handle so we can kill it on exit.
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
      match event {
        // User clicked X or pressed Alt+F4.
        tauri::WindowEvent::CloseRequested { .. } => {
          kill_backend(window.app_handle());
        }
        // Window was fully destroyed (covers force-close paths).
        tauri::WindowEvent::Destroyed => {
          kill_backend(window.app_handle());
        }
        _ => {}
      }
    })
    .build(tauri::generate_context!())
    .expect("error while building tauri application")
    .run(|app_handle, event| match event {
      tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit => {
        kill_backend(app_handle);
      }
      _ => {}
    });
}
