mod commands;
mod ws_server;

use ws_server::WsServerState;

pub fn run() {
    tauri::Builder::default()
        .manage(WsServerState::new())
        .invoke_handler(tauri::generate_handler![
            commands::start_ws_server,
            commands::stop_ws_server,
            commands::ws_send,
            commands::get_local_ip,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
