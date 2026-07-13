use notify::{RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use std::{
    env, fs,
    path::{Path, PathBuf},
    sync::Mutex,
};
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder},
    Emitter, Manager, RunEvent, Runtime,
};
use tauri_plugin_fs::FsExt;

#[derive(Deserialize)]
struct LegacyRecentWorkspace {
    path: PathBuf,
}

#[derive(Clone, Copy, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
enum RecentSourceKind {
    File,
    Directory,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct RecentSource {
    kind: RecentSourceKind,
    path: PathBuf,
}

#[derive(Deserialize)]
#[serde(untagged)]
enum StoredRecentSource {
    Current(RecentSource),
    Legacy(LegacyRecentWorkspace),
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct OpenedLog {
    name: String,
    path: PathBuf,
    text: String,
}

#[derive(Default)]
struct OpenedLogQueue(Mutex<Vec<PathBuf>>);

#[derive(Default)]
struct WatchedLog(Mutex<Option<notify::RecommendedWatcher>>);

fn is_supported_log(path: &Path) -> bool {
    path.is_file()
        && path
            .extension()
            .and_then(|extension| extension.to_str())
            .is_some_and(|extension| {
                matches!(extension.to_ascii_lowercase().as_str(), "jsonl" | "log")
            })
}

fn event_touches_watched_parent(changed: &Path, target: &Path, parent: &Path) -> bool {
    changed == target
        || changed == parent
        || changed
            .parent()
            .is_some_and(|changed_parent| changed_parent == parent)
}

fn system_open_paths(arguments: impl IntoIterator<Item = String>) -> Vec<PathBuf> {
    arguments
        .into_iter()
        .map(PathBuf::from)
        .filter(|path| is_supported_log(path))
        .collect()
}

fn queue_opened_logs<R: Runtime>(app: &tauri::AppHandle<R>, paths: Vec<PathBuf>) {
    if paths.is_empty() {
        return;
    }
    for path in &paths {
        let _ = app.fs_scope().allow_file(path);
    }
    if let Ok(mut queue) = app.state::<OpenedLogQueue>().0.lock() {
        queue.extend(paths);
    }
    let _ = app.emit("system-opened-logs", ());
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[tauri::command]
fn take_opened_logs(queue: tauri::State<OpenedLogQueue>) -> Result<Vec<OpenedLog>, String> {
    let paths = {
        let mut queue = queue.0.lock().map_err(|error| error.to_string())?;
        std::mem::take(&mut *queue)
    };
    paths
        .into_iter()
        .filter(|path| is_supported_log(path))
        .map(|path| {
            let name = path
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or("session.log")
                .to_owned();
            let text = fs::read_to_string(&path).map_err(|error| error.to_string())?;
            Ok(OpenedLog { name, path, text })
        })
        .collect()
}

#[tauri::command]
fn watch_log_file(
    app: tauri::AppHandle,
    watched: tauri::State<WatchedLog>,
    path: PathBuf,
) -> Result<(), String> {
    if !is_supported_log(&path) {
        return Err("The selected log file no longer exists or is unsupported".into());
    }
    let parent = path
        .parent()
        .ok_or_else(|| "The selected log file has no parent directory".to_string())?
        .to_path_buf();
    let target = path.clone();
    let parent_for_event = parent.clone();
    let event_app = app.clone();
    let mut watcher = notify::recommended_watcher(move |result: notify::Result<notify::Event>| {
        if result.as_ref().is_ok_and(|event| {
            event
                .paths
                .iter()
                .any(|changed| event_touches_watched_parent(changed, &target, &parent_for_event))
        }) {
            let _ = event_app.emit("watched-log-changed", ());
        }
    })
    .map_err(|error| error.to_string())?;
    watcher
        .watch(&parent, RecursiveMode::NonRecursive)
        .map_err(|error| error.to_string())?;
    *watched.0.lock().map_err(|error| error.to_string())? = Some(watcher);
    Ok(())
}

#[tauri::command]
fn unwatch_log_file(watched: tauri::State<WatchedLog>) -> Result<(), String> {
    watched.0.lock().map_err(|error| error.to_string())?.take();
    Ok(())
}

fn recent_source_file<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<PathBuf, String> {
    let config_dir = app
        .path()
        .app_config_dir()
        .map_err(|error| error.to_string())?;
    fs::create_dir_all(&config_dir).map_err(|error| error.to_string())?;
    Ok(config_dir.join("recent-workspace.json"))
}

#[tauri::command]
fn remember_workspace(app: tauri::AppHandle, path: PathBuf) -> Result<(), String> {
    if !path.is_dir() {
        return Err("The selected workspace directory no longer exists".into());
    }
    remember_source(&app, RecentSourceKind::Directory, path)
}

#[tauri::command]
fn remember_file(app: tauri::AppHandle, path: PathBuf) -> Result<(), String> {
    if !is_supported_log(&path) {
        return Err("The selected log file no longer exists or is unsupported".into());
    }
    remember_source(&app, RecentSourceKind::File, path)
}

fn remember_source<R: Runtime>(
    app: &tauri::AppHandle<R>,
    kind: RecentSourceKind,
    path: PathBuf,
) -> Result<(), String> {
    let contents =
        serde_json::to_vec(&RecentSource { kind, path }).map_err(|error| error.to_string())?;
    fs::write(recent_source_file(app)?, contents).map_err(|error| error.to_string())
}

fn parse_recent_source(contents: &[u8]) -> Result<RecentSource, String> {
    match serde_json::from_slice::<StoredRecentSource>(contents)
        .map_err(|error| error.to_string())?
    {
        StoredRecentSource::Current(source) => Ok(source),
        StoredRecentSource::Legacy(workspace) => Ok(RecentSource {
            kind: RecentSourceKind::Directory,
            path: workspace.path,
        }),
    }
}

#[tauri::command]
fn restore_recent_source(app: tauri::AppHandle) -> Result<Option<RecentSource>, String> {
    let config_file = recent_source_file(&app)?;
    if !config_file.exists() {
        return Ok(None);
    }
    let contents = fs::read(config_file).map_err(|error| error.to_string())?;
    let recent = parse_recent_source(&contents)?;
    match recent.kind {
        RecentSourceKind::File if is_supported_log(&recent.path) => app
            .fs_scope()
            .allow_file(&recent.path)
            .map_err(|error| error.to_string())?,
        RecentSourceKind::Directory if recent.path.is_dir() => app
            .fs_scope()
            .allow_directory(&recent.path, true)
            .map_err(|error| error.to_string())?,
        _ => return Ok(None),
    }
    Ok(Some(recent))
}

fn desktop_menu<R: Runtime>(app: &tauri::App<R>) -> tauri::Result<tauri::menu::Menu<R>> {
    let open_file = MenuItemBuilder::with_id("open-file", "Open File…")
        .accelerator("CmdOrCtrl+O")
        .build(app)?;
    let open_folder = MenuItemBuilder::with_id("open-folder", "Open Folder…")
        .accelerator("CmdOrCtrl+Shift+O")
        .build(app)?;
    let reveal = MenuItemBuilder::with_id("reveal-current", "Show Current Log in Folder")
        .accelerator("CmdOrCtrl+Shift+R")
        .build(app)?;
    let load_sample = MenuItemBuilder::with_id("load-sample", "Load XiaoBa Sample").build(app)?;
    let check_updates =
        MenuItemBuilder::with_id("check-updates", "Check for Updates…").build(app)?;

    let file_menu = SubmenuBuilder::new(app, "File")
        .items(&[&open_file, &open_folder])
        .separator()
        .item(&reveal)
        .item(&load_sample)
        .separator()
        .item(&check_updates)
        .separator()
        .close_window()
        .build()?;
    let edit_menu = SubmenuBuilder::new(app, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;
    let view_menu = SubmenuBuilder::new(app, "View").fullscreen().build()?;
    let window_menu = SubmenuBuilder::new(app, "Window").minimize().build()?;

    let menu = MenuBuilder::new(app);
    #[cfg(target_os = "macos")]
    let menu = {
        let app_menu = SubmenuBuilder::new(app, "Agent Explorer")
            .about(None)
            .separator()
            .services()
            .separator()
            .hide()
            .hide_others()
            .show_all()
            .separator()
            .quit()
            .build()?;
        menu.item(&app_menu)
    };

    menu.items(&[&file_menu, &edit_menu, &view_menu, &window_menu])
        .build()
}

fn is_desktop_action(id: &str) -> bool {
    matches!(
        id,
        "open-file" | "open-folder" | "reveal-current" | "load-sample" | "check-updates"
    )
}

fn window_state_flags() -> tauri_plugin_window_state::StateFlags {
    tauri_plugin_window_state::StateFlags::SIZE
        | tauri_plugin_window_state::StateFlags::POSITION
        | tauri_plugin_window_state::StateFlags::MAXIMIZED
}

fn is_main_window(label: &str) -> bool {
    label == "main"
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .manage(OpenedLogQueue::default())
        .manage(WatchedLog::default())
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            queue_opened_logs(app, system_open_paths(args.into_iter().skip(1)));
        }))
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(window_state_flags())
                .build(),
        )
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            remember_workspace,
            remember_file,
            restore_recent_source,
            take_opened_logs,
            watch_log_file,
            unwatch_log_file
        ])
        .setup(|app| {
            app.set_menu(desktop_menu(app)?)?;
            queue_opened_logs(&app.handle(), system_open_paths(env::args().skip(1)));
            Ok(())
        })
        .on_menu_event(|app, event| {
            let id = event.id().as_ref();
            if is_desktop_action(id) {
                let _ = app.emit("desktop-action", id);
            }
        })
        .on_window_event(|window, event| {
            #[cfg(target_os = "macos")]
            if is_main_window(window.label()) {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
            #[cfg(not(target_os = "macos"))]
            let _ = (window, event);
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app, event| {
        #[cfg(target_os = "macos")]
        match event {
            RunEvent::Opened { urls } => {
                let paths = urls
                    .into_iter()
                    .filter_map(|url| url.to_file_path().ok())
                    .filter(|path| is_supported_log(path))
                    .collect();
                queue_opened_logs(app, paths);
            }
            RunEvent::Reopen { .. } => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            _ => {}
        }
        #[cfg(not(target_os = "macos"))]
        let _ = (app, event);
    });
}

#[cfg(test)]
mod tests {
    use super::{
        event_touches_watched_parent, is_desktop_action, is_main_window, is_supported_log,
        parse_recent_source, system_open_paths, window_state_flags, RecentSourceKind,
    };
    use std::{fs, path::Path};

    #[test]
    fn watched_file_events_include_atomic_replacements_in_the_same_directory() {
        let target = Path::new("/tmp/session.jsonl");
        let parent = Path::new("/tmp");

        assert!(event_touches_watched_parent(target, target, parent));
        assert!(event_touches_watched_parent(
            Path::new("/tmp/.session.jsonl.tmp"),
            target,
            parent,
        ));
        assert!(event_touches_watched_parent(parent, target, parent));
    }

    #[test]
    fn watched_file_events_ignore_other_directories() {
        assert!(!event_touches_watched_parent(
            Path::new("/other/session.jsonl"),
            Path::new("/tmp/session.jsonl"),
            Path::new("/tmp"),
        ));
    }

    #[test]
    fn recognizes_only_application_menu_actions() {
        for id in [
            "open-file",
            "open-folder",
            "reveal-current",
            "load-sample",
            "check-updates",
        ] {
            assert!(is_desktop_action(id));
        }
        for id in ["quit", "copy", "unknown"] {
            assert!(!is_desktop_action(id));
        }
    }

    #[test]
    fn accepts_only_existing_supported_log_files() {
        let root = std::env::temp_dir().join(format!("agent-explorer-{}", std::process::id()));
        fs::create_dir_all(&root).unwrap();
        let jsonl = root.join("session.JSONL");
        let text = root.join("notes.txt");
        fs::write(&jsonl, "{}\n").unwrap();
        fs::write(&text, "notes").unwrap();

        assert!(is_supported_log(&jsonl));
        assert!(!is_supported_log(&text));
        assert_eq!(
            system_open_paths([
                jsonl.to_string_lossy().into_owned(),
                text.to_string_lossy().into_owned()
            ]),
            vec![jsonl]
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn migrates_legacy_workspace_storage_to_a_directory_source() {
        let recent = parse_recent_source(br#"{"path":"/tmp/agent-logs"}"#).unwrap();
        assert!(matches!(recent.kind, RecentSourceKind::Directory));
        assert_eq!(recent.path, std::path::PathBuf::from("/tmp/agent-logs"));
    }

    #[test]
    fn reads_the_current_file_source_storage_format() {
        let recent =
            parse_recent_source(br#"{"kind":"file","path":"/tmp/session.jsonl"}"#).unwrap();
        assert!(matches!(recent.kind, RecentSourceKind::File));
        assert_eq!(recent.path, std::path::PathBuf::from("/tmp/session.jsonl"));
    }

    #[test]
    fn persists_only_user_controlled_window_geometry() {
        let flags = window_state_flags();
        assert!(flags.contains(tauri_plugin_window_state::StateFlags::SIZE));
        assert!(flags.contains(tauri_plugin_window_state::StateFlags::POSITION));
        assert!(flags.contains(tauri_plugin_window_state::StateFlags::MAXIMIZED));
        assert!(!flags.contains(tauri_plugin_window_state::StateFlags::VISIBLE));
        assert!(!flags.contains(tauri_plugin_window_state::StateFlags::FULLSCREEN));
        assert!(!flags.contains(tauri_plugin_window_state::StateFlags::DECORATIONS));
    }

    #[test]
    fn identifies_only_the_primary_window_for_macos_hide_on_close() {
        assert!(is_main_window("main"));
        assert!(!is_main_window("settings"));
        assert!(!is_main_window(""));
    }
}
