use std::sync::Arc;

use base64::{engine::general_purpose, Engine as _};
use futures_util::{stream::SplitSink, SinkExt, StreamExt};
use serde::Serialize;
use tauri::{AppHandle, Emitter};
use tokio::{
    net::TcpListener,
    sync::{mpsc, Mutex},
};
use tokio_tungstenite::{accept_async, tungstenite::Message};

type WsSink = SplitSink<
    tokio_tungstenite::WebSocketStream<tokio::net::TcpStream>,
    Message,
>;

#[derive(Serialize, Clone)]
pub struct WsMessagePayload {
    pub data: String,
}

pub struct WsServerState {
    pub sink: Arc<Mutex<Option<WsSink>>>,
    pub shutdown_tx: Arc<Mutex<Option<mpsc::Sender<()>>>>,
}

impl WsServerState {
    pub fn new() -> Self {
        Self {
            sink: Arc::new(Mutex::new(None)),
            shutdown_tx: Arc::new(Mutex::new(None)),
        }
    }

    pub async fn start(
        &self,
        port: u16,
        app: AppHandle,
    ) -> Result<String, String> {
        let addr = format!("0.0.0.0:{}", port);
        let listener = TcpListener::bind(&addr)
            .await
            .map_err(|e| format!("failed to bind: {}", e))?;

        let local_port = listener
            .local_addr()
            .map_err(|e| e.to_string())?
            .port();

        let local_ip = local_ip_address::local_ip()
            .map_err(|e| format!("failed to get local ip: {}", e))?;

        let bound = format!("{}:{}", local_ip, local_port);

        let (shutdown_tx, mut shutdown_rx) = mpsc::channel::<()>(1);
        *self.shutdown_tx.lock().await = Some(shutdown_tx);

        let sink_ref = self.sink.clone();

        tokio::spawn(async move {
            let mut has_peer = false;

            loop {
                tokio::select! {
                    result = listener.accept() => {
                        match result {
                            Ok((stream, _)) => {
                                // only one peer allowed per session
                                if has_peer {
                                    drop(stream);
                                    continue;
                                }

                                let ws = match accept_async(stream).await {
                                    Ok(ws) => ws,
                                    Err(_) => continue,
                                };

                                has_peer = true;
                                let (write, mut read) = ws.split();
                                *sink_ref.lock().await = Some(write);

                                let _ = app.emit("ws-connection", ());

                                let app_read = app.clone();
                                let sink_close = sink_ref.clone();

                                // read loop for this client
                                tokio::spawn(async move {
                                    while let Some(msg) = read.next().await {
                                        match msg {
                                            Ok(Message::Binary(data)) => {
                                                let encoded =
                                                    general_purpose::STANDARD
                                                        .encode(&data);
                                                let _ = app_read.emit(
                                                    "ws-message",
                                                    WsMessagePayload {
                                                        data: encoded,
                                                    },
                                                );
                                            }
                                            Ok(Message::Text(text)) => {
                                                let encoded =
                                                    general_purpose::STANDARD
                                                        .encode(
                                                            text.as_bytes(),
                                                        );
                                                let _ = app_read.emit(
                                                    "ws-message",
                                                    WsMessagePayload {
                                                        data: encoded,
                                                    },
                                                );
                                            }
                                            Ok(Message::Close(_)) | Err(_) => {
                                                break;
                                            }
                                            _ => {}
                                        }
                                    }

                                    *sink_close.lock().await = None;
                                    let _ = app_read.emit("ws-close", ());
                                });
                            }
                            Err(_) => break,
                        }
                    }
                    _ = shutdown_rx.recv() => {
                        break;
                    }
                }
            }
        });

        Ok(bound)
    }

    pub async fn send(&self, data: &[u8]) -> Result<(), String> {
        let mut sink_guard = self.sink.lock().await;
        if let Some(sink) = sink_guard.as_mut() {
            sink.send(Message::Binary(data.to_vec()))
                .await
                .map_err(|e| format!("send failed: {}", e))
        } else {
            Err("no peer connected".to_string())
        }
    }

    pub async fn stop(&self) {
        if let Some(tx) = self.shutdown_tx.lock().await.take() {
            let _ = tx.send(()).await;
        }
        if let Some(mut sink) = self.sink.lock().await.take() {
            let _ = sink.close().await;
        }
    }
}
