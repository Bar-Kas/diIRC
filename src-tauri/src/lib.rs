use std::collections::HashMap;
use std::sync::Arc;
use futures::prelude::*;
use irc::client::prelude::*;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};
use tokio::sync::Mutex;

#[derive(Serialize, Clone)]
struct IrcMessage {
    server_id: String,
    sender: String,
    content: String,
    channel: String,
    is_system: bool,
}

#[derive(Serialize, Clone)]
struct IrcUserEvent {
    server_id: String,
    channel: String,
    users: Vec<String>,
    event_type: String,
}

#[derive(Serialize, Clone)]
struct IrcStatusEvent {
    server_id: String,
    connected: bool,
}

#[derive(Serialize, Clone)]
struct IrcTopicEvent {
    server_id: String,
    channel: String,
    topic: String,
    set_by: Option<String>,
}

#[derive(Serialize, Clone)]
struct IrcOpsEvent {
    server_id: String,
    channel: String,
    ops: Vec<String>,
}

#[derive(Serialize, Clone)]
struct IrcTopicErrorEvent {
    server_id: String,
    channel: String,
    error: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct IrcConnectParams {
    server_id: String,
    host: String,
    port: u16,
    nicknames: Vec<String>,
    #[serde(default)]
    realname: Option<String>,
    #[serde(default)]
    password: Option<String>,
    #[serde(default)]
    channels: Vec<String>,
    #[serde(default)]
    use_tls: bool,
}

struct IrcState {
    senders: Arc<Mutex<HashMap<String, Sender>>>,
}

#[tauri::command]
async fn connect_irc(
    app: AppHandle,
    state: State<'_, IrcState>,
    params: IrcConnectParams,
) -> Result<(), String> {
    let server_id = params.server_id.clone();

    {
        let senders = state.senders.lock().await;
        if senders.contains_key(&server_id) {
            let _ = app.emit("irc_status", IrcStatusEvent {
                server_id: server_id.clone(),
                connected: true,
            });
            return Ok(());
        }
    }

    let formatted_channels: Vec<String> = params
        .channels
        .into_iter()
        .map(|ch| if ch.starts_with('#') { ch } else { format!("#{}", ch) })
        .collect();

    let primary_nickname = params.nicknames.first().cloned().unwrap_or_else(|| "ReactUser".to_string());
    let alt_nicknames = if params.nicknames.len() > 1 {
        params.nicknames[1..].to_vec()
    } else {
        Vec::new()
    };

    let config = Config {
        nickname: Some(primary_nickname.clone()),
        username: Some(primary_nickname.clone()),
        realname: params.realname.filter(|s| !s.is_empty()).or(Some(primary_nickname)),
        password: params.password.filter(|s| !s.is_empty()),
        alt_nicks: alt_nicknames,
        server: Some(params.host),
        port: Some(params.port),
        channels: formatted_channels,
        use_tls: Some(params.use_tls),
        ping_time: Some(15),
        ping_timeout: Some(10),
        ..Config::default()
    };
    
    log::info!("Connecting to IRC with nick: {:?}, alt_nicks: {:?}, user: {:?}, realname: {:?}", config.nickname, config.alt_nicks, config.username, config.realname);

    let mut client = Client::from_config(config).await.map_err(|e| {
        let _ = app.emit("irc_status", IrcStatusEvent {
            server_id: server_id.clone(),
            connected: false,
        });
        e.to_string()
    })?;

    client.identify().map_err(|e| {
        let _ = app.emit("irc_status", IrcStatusEvent {
            server_id: server_id.clone(),
            connected: false,
        });
        e.to_string()
    })?;

    let sender = client.sender();
    state.senders.lock().await.insert(server_id.clone(), sender);

    let _ = app.emit("irc_status", IrcStatusEvent {
        server_id: server_id.clone(),
        connected: true,
    });

    let stream_server_id = server_id.clone();
    let senders_clone = state.senders.clone();
    let app_clone = app.clone();

    tauri::async_runtime::spawn(async move {
        let mut stream = match client.stream() {
            Ok(s) => s,
            Err(e) => {
                log::error!("Failed to open stream for server {}: {}", stream_server_id, e);
                senders_clone.lock().await.remove(&stream_server_id);
                let _ = app_clone.emit("irc_status", IrcStatusEvent {
                    server_id: stream_server_id,
                    connected: false,
                });
                return;
            }
        };

        while let Some(message_res) = stream.next().await {
            match message_res {
                Ok(message) => {
                    log::info!("IRC [{}] Received: {:?}", stream_server_id, message.command);
                    match message.command {
                        Command::PRIVMSG(channel, content) => {
                            if let Some(source) = message.prefix {
                                let sender_name = match source {
                                    Prefix::Nickname(nick, _, _) => nick,
                                    Prefix::ServerName(name) => name,
                                };
                                let payload = IrcMessage {
                                    server_id: stream_server_id.clone(),
                                    sender: sender_name.clone(),
                                    content,
                                    channel: channel.clone(),
                                    is_system: false,
                                };
                                let _ = app_clone.emit("irc_message", payload);

                                let payload_users = IrcUserEvent {
                                    server_id: stream_server_id.clone(),
                                    channel: channel.clone(),
                                    users: vec![sender_name],
                                    event_type: "JOIN".to_string(),
                                };
                                let _ = app_clone.emit("irc_user_event", payload_users);
                            }
                        }
                        Command::JOIN(channel, _, _) => {
                            if let Some(source) = message.prefix {
                                let sender_name = match source.clone() {
                                    Prefix::Nickname(nick, _, _) => nick,
                                    Prefix::ServerName(name) => name,
                                };
                                let full_source = match source {
                                    Prefix::Nickname(nick, user, host) => {
                                        format!("{} ({}@{})", nick, user, host)
                                    }
                                    Prefix::ServerName(name) => name,
                                };
                                let payload = IrcMessage {
                                    server_id: stream_server_id.clone(),
                                    sender: sender_name.clone(),
                                    content: format!("{} has joined", full_source),
                                    channel: channel.clone(),
                                    is_system: true,
                                };
                                let _ = app_clone.emit("irc_message", payload);

                                let payload_users = IrcUserEvent {
                                    server_id: stream_server_id.clone(),
                                    channel,
                                    users: vec![sender_name],
                                    event_type: "JOIN".to_string(),
                                };
                                let _ = app_clone.emit("irc_user_event", payload_users);
                            }
                        }
                        Command::PART(channel, _) => {
                            if let Some(source) = message.prefix {
                                let sender_name = match source.clone() {
                                    Prefix::Nickname(nick, _, _) => nick,
                                    Prefix::ServerName(name) => name,
                                };
                                let payload_users = IrcUserEvent {
                                    server_id: stream_server_id.clone(),
                                    channel,
                                    users: vec![sender_name],
                                    event_type: "PART".to_string(),
                                };
                                let _ = app_clone.emit("irc_user_event", payload_users);
                            }
                        }
                        Command::QUIT(_) => {
                            if let Some(source) = message.prefix {
                                let sender_name = match source.clone() {
                                    Prefix::Nickname(nick, _, _) => nick,
                                    Prefix::ServerName(name) => name,
                                };
                                let payload_users = IrcUserEvent {
                                    server_id: stream_server_id.clone(),
                                    channel: "".to_string(),
                                    users: vec![sender_name],
                                    event_type: "QUIT".to_string(),
                                };
                                let _ = app_clone.emit("irc_user_event", payload_users);
                            }
                        }
                        Command::Response(Response::RPL_NAMREPLY, ref args) => {
                            if args.len() >= 4 {
                                let channel = &args[2];
                                let users_str = &args[3];
                                let mut users: Vec<String> = Vec::new();
                                let mut ops: Vec<String> = Vec::new();

                                for token in users_str.split_whitespace() {
                                    let is_op = token.starts_with('@') || token.starts_with('%') || token.starts_with('~') || token.starts_with('&');
                                    let clean = token.trim_start_matches(&['@', '+', '%', '~', '&'][..]).to_string();
                                    users.push(clean.clone());
                                    if is_op {
                                        ops.push(clean);
                                    }
                                }

                                let payload = IrcUserEvent {
                                    server_id: stream_server_id.clone(),
                                    channel: channel.to_string(),
                                    users,
                                    event_type: "NAMES".to_string(),
                                };
                                let _ = app_clone.emit("irc_user_event", payload);

                                let ops_payload = IrcOpsEvent {
                                    server_id: stream_server_id.clone(),
                                    channel: channel.to_string(),
                                    ops,
                                };
                                let _ = app_clone.emit("irc_ops_event", ops_payload);
                            }
                        }
                        Command::Response(Response::ERR_CHANOPRIVSNEEDED, ref args) => {
                            let channel = args.get(1).cloned().unwrap_or_default();
                            let reason = args.get(2).cloned().unwrap_or_else(|| "You're not channel operator".to_string());
                            
                            let msg_payload = IrcMessage {
                                server_id: stream_server_id.clone(),
                                sender: "System".to_string(),
                                content: format!("Cannot change topic on {}: {}", channel, reason),
                                channel: channel.clone(),
                                is_system: true,
                            };
                            let _ = app_clone.emit("irc_message", msg_payload);

                            let err_payload = IrcTopicErrorEvent {
                                server_id: stream_server_id.clone(),
                                channel,
                                error: reason,
                            };
                            let _ = app_clone.emit("irc_topic_error", err_payload);
                        }
                        Command::Response(Response::ERR_NOPRIVILEGES, ref args) => {
                            let reason = args.get(1).cloned().unwrap_or_else(|| "Permission Denied".to_string());
                            let msg_payload = IrcMessage {
                                server_id: stream_server_id.clone(),
                                sender: "System".to_string(),
                                content: format!("Permission Denied: {}", reason),
                                channel: "".to_string(),
                                is_system: true,
                            };
                            let _ = app_clone.emit("irc_message", msg_payload);
                        }
                        Command::Response(Response::ERR_NOCHANMODES, ref args) => {
                            let channel = args.get(1).cloned().unwrap_or_default();
                            let reason = args.get(2).cloned().unwrap_or_else(|| "Channel doesn't support modes".to_string());
                            let msg_payload = IrcMessage {
                                server_id: stream_server_id.clone(),
                                sender: "System".to_string(),
                                content: format!("Cannot set topic on {}: {}", channel, reason),
                                channel,
                                is_system: true,
                            };
                            let _ = app_clone.emit("irc_message", msg_payload);
                        }
                        Command::Response(Response::RPL_TOPIC, ref args) => {
                            if args.len() >= 3 {
                                let channel = &args[1];
                                let topic = &args[2];
                                let payload = IrcTopicEvent {
                                    server_id: stream_server_id.clone(),
                                    channel: channel.to_string(),
                                    topic: topic.to_string(),
                                    set_by: None,
                                };
                                let _ = app_clone.emit("irc_topic_event", payload);
                            }
                        }
                        Command::TOPIC(ref channel, ref topic_opt) => {
                            let topic_text = topic_opt.as_deref().unwrap_or("");
                            let sender_name = message.prefix.as_ref().map(|source| match source {
                                Prefix::Nickname(nick, _, _) => nick.clone(),
                                Prefix::ServerName(name) => name.clone(),
                            });

                            let payload = IrcTopicEvent {
                                server_id: stream_server_id.clone(),
                                channel: channel.clone(),
                                topic: topic_text.to_string(),
                                set_by: sender_name.clone(),
                            };
                            let _ = app_clone.emit("irc_topic_event", payload);

                            if let Some(ref sender) = sender_name {
                                let sys_content = if topic_text.is_empty() {
                                    format!("{} cleared the topic", sender)
                                } else {
                                    format!("{} changed the topic to: {}", sender, topic_text)
                                };
                                let msg_payload = IrcMessage {
                                    server_id: stream_server_id.clone(),
                                    sender: sender.clone(),
                                    content: sys_content,
                                    channel: channel.clone(),
                                    is_system: true,
                                };
                                let _ = app_clone.emit("irc_message", msg_payload);
                            }
                        }
                        _ => {}
                    }
                }
                Err(e) => {
                    log::error!("IRC [{}] Stream error: {}", stream_server_id, e);
                }
            }
        }

        log::warn!("IRC [{}] Stream closed!", stream_server_id);
        senders_clone.lock().await.remove(&stream_server_id);
        let _ = app_clone.emit("irc_status", IrcStatusEvent {
            server_id: stream_server_id,
            connected: false,
        });

        // Keep client alive in task scope
        let _ = client;
    });

    log::info!("IRC connection setup complete for server {}", server_id);
    Ok(())
}

#[tauri::command]
async fn send_message(
    app: AppHandle,
    state: State<'_, IrcState>,
    server_id: String,
    channel: String,
    message: String,
) -> Result<(), String> {
    let senders = state.senders.lock().await;
    if let Some(sender) = senders.get(&server_id) {
        if let Err(e) = sender.send_privmsg(&channel, &message) {
            drop(senders);
            state.senders.lock().await.remove(&server_id);
            let _ = app.emit("irc_status", IrcStatusEvent {
                server_id: server_id.clone(),
                connected: false,
            });
            return Err(e.to_string());
        }
        Ok(())
    } else {
        Err(format!("Not connected to server {}", server_id))
    }
}

#[tauri::command]
async fn join_channel(
    app: AppHandle,
    state: State<'_, IrcState>,
    server_id: String,
    channel: String,
) -> Result<(), String> {
    log::info!("join_channel called for server: {}, channel: {}", server_id, channel);
    let senders = state.senders.lock().await;
    if let Some(sender) = senders.get(&server_id) {
        let formatted_channel = if channel.starts_with('#') {
            channel
        } else {
            format!("#{}", channel)
        };
        log::info!("Sending JOIN {}", formatted_channel);
        if let Err(e) = sender.send_join(&formatted_channel) {
            log::error!("Error sending JOIN: {}", e);
            drop(senders);
            state.senders.lock().await.remove(&server_id);
            let _ = app.emit("irc_status", IrcStatusEvent {
                server_id: server_id.clone(),
                connected: false,
            });
            return Err(e.to_string());
        }
        Ok(())
    } else {
        log::error!("Not connected to server {}", server_id);
        Err(format!("Not connected to server {}", server_id))
    }
}

#[tauri::command]
async fn set_channel_topic(
    app: AppHandle,
    state: State<'_, IrcState>,
    server_id: String,
    channel: String,
    topic: String,
) -> Result<(), String> {
    let senders = state.senders.lock().await;
    if let Some(sender) = senders.get(&server_id) {
        let formatted_channel = if channel.starts_with('#') {
            channel
        } else {
            format!("#{}", channel)
        };
        if let Err(e) = sender.send_topic(&formatted_channel, &topic) {
            drop(senders);
            state.senders.lock().await.remove(&server_id);
            let _ = app.emit("irc_status", IrcStatusEvent {
                server_id: server_id.clone(),
                connected: false,
            });
            return Err(e.to_string());
        }
        Ok(())
    } else {
        Err(format!("Not connected to server {}", server_id))
    }
}

#[tauri::command]
async fn disconnect_irc(
    app: AppHandle,
    state: State<'_, IrcState>,
    server_id: String,
) -> Result<(), String> {
    let mut senders = state.senders.lock().await;
    if let Some(sender) = senders.remove(&server_id) {
        let _ = sender.send_quit("Client disconnected");
    }
    let _ = app.emit("irc_status", IrcStatusEvent {
        server_id: server_id.clone(),
        connected: false,
    });
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(IrcState {
            senders: Arc::new(Mutex::new(HashMap::new())),
        })
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![connect_irc, send_message, disconnect_irc, join_channel, set_channel_topic])
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
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
