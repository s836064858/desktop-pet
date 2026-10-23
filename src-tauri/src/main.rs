// Phase 0 约定：本文件只做插件注册声明，不允许出现业务逻辑（「Rust 零业务代码」基线）
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_log::{Target, TargetKind};

fn main() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .targets([Target::new(TargetKind::Stdout), Target::new(TargetKind::Webview)])
                .build(),
        )
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .run(tauri::generate_context!())
        .expect("芽伴 · Sproutkin 启动失败");
}
