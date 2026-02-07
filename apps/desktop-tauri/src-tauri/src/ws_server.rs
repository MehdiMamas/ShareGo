use std::net::SocketAddr;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use base64::{engine::general_purpose, Engine as _};
use futures_util::{stream::SplitSink, SinkExt, StreamExt};
use serde::Serialize;
use socket2::{Domain, Protocol, Socket, Type};
use tauri::{AppHandle, Emitter};
use tokio::{
    net::TcpListener,
    sync::{mpsc, Mutex},
    task::JoinHandle,
};
use tokio_tungstenite::{accept_async, tungstenite::Message};

/// max allowed message size in bytes (64 KB), matching the JS transport limit
const MAX_MESSAGE_SIZE: usize = 65536;

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
    pub listener_handle: Arc<Mutex<Option<JoinHandle<()>>>>,
    /// serializes stop+start operations so they never interleave
    pub op_lock: Arc<Mutex<()>>,
}

impl WsServerState {
    pub fn new() -> Self {
        Self {
            sink: Arc::new(Mutex::new(None)),
            shutdown_tx: Arc::new(Mutex::new(None)),
            listener_handle: Arc::new(Mutex::new(None)),
            op_lock: Arc::new(Mutex::new(())),
        }
    }

    pub async fn start(
        &self,
        port: u16,
        app: AppHandle,
    ) -> Result<String, String> {
        // serialize against concurrent stop/start calls
        let _guard = self.op_lock.lock().await;

        // stop any previous server and wait for the listener task to finish
        self.stop_inner().await;

        // bind with SO_REUSEADDR and retry to handle lingering sockets
        let listener = self.bind_with_retry(port, 5, 200).await?;

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

        let handle = tokio::spawn(async move {
            let has_peer = Arc::new(AtomicBool::new(false));

            loop {
                tokio::select! {
                    result = listener.accept() => {
                        match result {
                            Ok((stream, _)) => {
                                if has_peer.load(Ordering::SeqCst) {
                                    drop(stream);
                                    continue;
                                }

                                let ws = match accept_async(stream).await {
                                    Ok(ws) => ws,
                                    Err(_) => continue,
                                };

                                has_peer.store(true, Ordering::SeqCst);
                                let (write, mut read) = ws.split();
                                *sink_ref.lock().await = Some(write);

                                let _ = app.emit("ws-connection", ());

                                let app_read = app.clone();
                                let sink_close = sink_ref.clone();
                                let has_peer_clone = has_peer.clone();

                                tokio::spawn(async move {
                                    while let Some(msg) = read.next().await {
                                        match msg {
                                            Ok(Message::Binary(data)) => {
                                                if data.len() > MAX_MESSAGE_SIZE {
                                                    continue; // drop oversized messages
                                                }
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
                                                if text.len() > MAX_MESSAGE_SIZE {
                                                    continue; // drop oversized messages
                                                }
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

                                    has_peer_clone.store(false, Ordering::SeqCst);
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
            // listener is dropped here, releasing the port
        });

        *self.listener_handle.lock().await = Some(handle);

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
        let _guard = self.op_lock.lock().await;
        self.stop_inner().await;
    }

    /// internal stop without acquiring op_lock (caller must hold it)
    async fn stop_inner(&self) {
        if let Some(tx) = self.shutdown_tx.lock().await.take() {
            let _ = tx.send(()).await;
        }
        if let Some(mut sink) = self.sink.lock().await.take() {
            let _ = sink.close().await;
        }
        if let Some(handle) = self.listener_handle.lock().await.take() {
            let _ = handle.await;
        }
    }

    /// try binding with retries to handle the port not being released yet
    async fn bind_with_retry(
        &self,
        port: u16,
        max_attempts: u32,
        delay_ms: u64,
    ) -> Result<TcpListener, String> {
        let addr: SocketAddr = format!("0.0.0.0:{}", port)
            .parse()
            .map_err(|e| format!("invalid address: {}", e))?;

        let mut last_err = String::new();
        for attempt in 0..max_attempts {
            if attempt > 0 {
                tokio::time::sleep(std::time::Duration::from_millis(delay_ms)).await;
            }

            match self.try_bind(addr) {
                Ok(listener) => return Ok(listener),
                Err(e) => last_err = e,
            }
        }

        Err(last_err)
    }

    fn try_bind(&self, addr: SocketAddr) -> Result<TcpListener, String> {
        let socket = Socket::new(Domain::IPV4, Type::STREAM, Some(Protocol::TCP))
            .map_err(|e| format!("failed to create socket: {}", e))?;
        socket
            .set_reuse_address(true)
            .map_err(|e| format!("failed to set SO_REUSEADDR: {}", e))?;
        socket
            .bind(&addr.into())
            .map_err(|e| format!("failed to bind: {}", e))?;
        socket
            .listen(128)
            .map_err(|e| format!("failed to listen: {}", e))?;
        socket
            .set_nonblocking(true)
            .map_err(|e| format!("failed to set nonblocking: {}", e))?;
        let std_listener: std::net::TcpListener = socket.into();
        TcpListener::from_std(std_listener)
            .map_err(|e| format!("failed to create tokio listener: {}", e))
    }
}
