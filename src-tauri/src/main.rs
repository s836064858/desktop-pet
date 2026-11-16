// Phase 0 约定：本文件只做插件注册声明，不允许出现业务逻辑（「Rust 零业务代码」基线）
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Emitter;
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_log::{Target, TargetKind};

fn main() {
    tauri::Builder::default()
        // 必须最先注册：新实例在创建窗口、托盘及其他插件前退出。
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Err(error) = app.emit_to("main", "app-reopen", ()) {
                log::error!("[app] 转发重复启动事件失败：{error}");
            }
        }))
        // macOS 点击 Dock/Finder 可直接触发现有进程的 Reopen，不经过新实例。
        .plugin(
            tauri::plugin::Builder::<tauri::Wry>::new("app-lifecycle")
                .on_event(|_app, _event| {
                    #[cfg(target_os = "macos")]
                    if matches!(_event, tauri::RunEvent::Reopen { .. }) {
                        if let Err(error) = _app.emit_to("main", "app-reopen", ()) {
                            log::error!("[app] 转发系统重新打开事件失败：{error}");
                        }
                    }
                })
                .build(),
        )
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .targets([
                    Target::new(TargetKind::Stdout),
                    Target::new(TargetKind::Webview),
                ])
                .build(),
        )
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .run(tauri::generate_context!())
        .expect("芽伴 · Sproutkin 启动失败");
}
