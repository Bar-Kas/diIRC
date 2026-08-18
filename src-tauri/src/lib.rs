use std::collections::HashMap;
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
    senders: Mutex<HashMap<String, Sender>>,
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
        ..Config::default()
    };
    
    log::info!("Connecting to IRC with nick: {:?}, alt_nicks: {:?}, user: {:?}, realname: {:?}", config.nickname, config.alt_nicks, config.username, config.realname);

    let mut client = Client::from_config(config).await.map_err(|e| e.to_string())?;
    client.identify().map_err(|e| e.to_string())?;

    let sender = client.sender();
    state.senders.lock().await.insert(server_id.clone(), sender);

    let stream_server_id = server_id.clone();

    tauri::async_runtime::spawn(async move {
        let mut stream = match client.stream() {
            Ok(s) => s,
            Err(e) => {
                log::error!("Failed to open stream for server {}: {}", stream_server_id, e);
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
                                let _ = app.emit("irc_message", payload);

                                let payload_users = IrcUserEvent {
                                    server_id: stream_server_id.clone(),
                                    channel: channel.clone(),
                                    users: vec![sender_name],
                                    event_type: "JOIN".to_string(), // Treat speaking as joined
                                };
                                let _ = app.emit("irc_user_event", payload_users);
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
                                let _ = app.emit("irc_message", payload);

                                let payload_users = IrcUserEvent {
                                    server_id: stream_server_id.clone(),
                                    channel,
                                    users: vec![sender_name],
                                    event_type: "JOIN".to_string(),
                                };
                                let _ = app.emit("irc_user_event", payload_users);
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
                                let _ = app.emit("irc_user_event", payload_users);
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
                                let _ = app.emit("irc_user_event", payload_users);
                            }
                        }
                        Command::Response(Response::RPL_NAMREPLY, ref args) => {
                            if args.len() >= 4 {
                                let channel = &args[2];
                                let users_str = &args[3];
                                let users: Vec<String> = users_str.split_whitespace().map(|s| {
                                    let clean = s.trim_start_matches(&['@', '+', '%', '~', '&'][..]);
                                    clean.to_string()
                                }).collect();
                                let payload = IrcUserEvent {
                                    server_id: stream_server_id.clone(),
                                    channel: channel.to_string(),
                                    users,
                                    event_type: "NAMES".to_string(),
                                };
                                let _ = app.emit("irc_user_event", payload);
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

        // Keep client alive in task scope
        let _ = client;
    });

    log::info!("IRC connection setup complete for server {}", server_id);
    Ok(())
}

#[tauri::command]
async fn send_message(
    state: State<'_, IrcState>,
    server_id: String,
    channel: String,
    message: String,
) -> Result<(), String> {
    let senders = state.senders.lock().await;
    if let Some(sender) = senders.get(&server_id) {
        sender.send_privmsg(&channel, &message).map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err(format!("Not connected to server {}", server_id))
    }
}

#[tauri::command]
async fn join_channel(
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
        sender.send_join(&formatted_channel).map_err(|e| {
            log::error!("Error sending JOIN: {}", e);
            e.to_string()
        })?;
        Ok(())
    } else {
        log::error!("Not connected to server {}", server_id);
        Err(format!("Not connected to server {}", server_id))
    }
}

#[tauri::command]
async fn disconnect_irc(
    state: State<'_, IrcState>,
    server_id: String,
) -> Result<(), String> {
    let mut senders = state.senders.lock().await;
    if let Some(sender) = senders.remove(&server_id) {
        let _ = sender.send_quit("Client disconnected");
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(IrcState {
            senders: Mutex::new(HashMap::new()),
        })
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![connect_irc, send_message, disconnect_irc, join_channel])
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
