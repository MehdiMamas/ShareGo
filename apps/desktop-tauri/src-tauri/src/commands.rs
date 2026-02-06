use base64::{engine::general_purpose, Engine as _};
use tauri::{AppHandle, State};

use crate::ws_server::WsServerState;

#[tauri::command]
pub async fn start_ws_server(
    port: u16,
    app: AppHandle,
    state: State<'_, WsServerState>,
) -> Result<String, String> {
    state.start(port, app).await
}

#[tauri::command]
pub async fn stop_ws_server(
    state: State<'_, WsServerState>,
) -> Result<(), String> {
    state.stop().await;
    Ok(())
}

#[tauri::command]
pub async fn ws_send(
    data: String,
    state: State<'_, WsServerState>,
) -> Result<(), String> {
    let bytes = general_purpose::STANDARD
        .decode(&data)
        .map_err(|e| format!("invalid base64: {}", e))?;
    state.send(&bytes).await
}

#[tauri::command]
pub fn get_local_ip() -> Result<String, String> {
    local_ip_address::local_ip()
        .map(|ip| ip.to_string())
        .map_err(|e| format!("failed to get local ip: {}", e))
}
