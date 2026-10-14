//! CarouselForge desktop shell. The app itself is the web build; Rust adds OS-keychain secret
//! storage and an HTTP client without browser CORS limits (via tauri-plugin-http).

const KEYCHAIN_SERVICE: &str = "com.carouselforge.app";

/// Only these secret names may be read or written from the frontend.
const ALLOWED_SECRETS: &[&str] = &[
  "anthropic_api_key",
  "unsplash_access_key",
  "pexels_api_key",
  "openrouter_api_key",
  "groq_api_key",
  "gemini_api_key",
  "custom_openai_api_key",
];

fn entry(name: &str) -> Result<keyring::Entry, String> {
  if !ALLOWED_SECRETS.contains(&name) {
    return Err(format!("unknown secret: {name}"));
  }
  keyring::Entry::new(KEYCHAIN_SERVICE, name).map_err(|e| e.to_string())
}

#[tauri::command]
fn secret_get(name: String) -> Result<Option<String>, String> {
  match entry(&name)?.get_password() {
    Ok(v) => Ok(Some(v)),
    Err(keyring::Error::NoEntry) => Ok(None),
    Err(e) => Err(e.to_string()),
  }
}

#[tauri::command]
fn secret_set(name: String, value: String) -> Result<(), String> {
  entry(&name)?.set_password(&value).map_err(|e| e.to_string())
}

#[tauri::command]
fn secret_delete(name: String) -> Result<(), String> {
  match entry(&name)?.delete_credential() {
    Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
    Err(e) => Err(e.to_string()),
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_http::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![secret_get, secret_set, secret_delete])
    .run(tauri::generate_context!())
    .expect("error while building tauri application");
}
