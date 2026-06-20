use serde::Serialize;
use std::{path::PathBuf, sync::Mutex};
use tauri::{Emitter, Manager};

#[derive(Default)]
struct OpenedFiles(Mutex<Vec<String>>);

#[derive(Serialize)]
struct LocalFilePayload {
    path: String,
    title: String,
    contents: String,
    size: u64,
}

#[tauri::command]
fn read_local_file(path: String) -> Result<LocalFilePayload, String> {
    let path_buf = PathBuf::from(&path);
    let metadata = std::fs::metadata(&path_buf)
        .map_err(|error| format!("Unable to inspect {}: {}", path, error))?;
    let contents = std::fs::read_to_string(&path_buf)
        .map_err(|error| format!("Unable to read {} as UTF-8 text: {}", path, error))?;

    let title = path_buf
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("Untitled JSON")
        .to_string();

    Ok(LocalFilePayload {
        path,
        title,
        contents,
        size: metadata.len(),
    })
}

#[tauri::command]
fn opened_files(state: tauri::State<OpenedFiles>) -> Vec<String> {
    state.0.lock().expect("opened files mutex poisoned").clone()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(OpenedFiles(Mutex::new(initial_opened_files())))
        .invoke_handler(tauri::generate_handler![read_local_file, opened_files])
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building Tauri application")
        .run(|app, event| {
            if let tauri::RunEvent::Opened { urls } = event {
                let paths = urls_to_paths(urls);

                if paths.is_empty() {
                    return;
                }

                app.state::<OpenedFiles>()
                    .0
                    .lock()
                    .expect("opened files mutex poisoned")
                    .extend(paths.clone());

                let _ = app.emit("opened-files", paths);
            }
        });
}

fn urls_to_paths(urls: Vec<tauri::Url>) -> Vec<String> {
    urls.into_iter()
        .filter_map(|url| url.to_file_path().ok())
        .map(|path| path.to_string_lossy().to_string())
        .collect()
}

fn initial_opened_files() -> Vec<String> {
    std::env::args()
        .skip(1)
        .filter(|arg| {
            let lower = arg.to_lowercase();
            lower.ends_with(".json") || lower.ends_with(".jsonl") || lower.ends_with(".ndjson")
        })
        .collect()
}
