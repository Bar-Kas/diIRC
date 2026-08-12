use futures::prelude::*;
use irc::client::prelude::*;
use tauri::{AppHandle, Emitter, State};
use tokio::sync::Mutex;
use serde::Serialize;

#[derive(Serialize, Clone)]
struct IrcMessage {
    sender: String,
    content: String,
    channel: String,
}

struct IrcState {
    sender: Mutex<Option<Sender>>,
}

#[tauri::command]
async fn connect_irc(app: AppHandle, state: State<'_, IrcState>, nickname: String) -> Result<(), String> {
    let config = Config {
        nickname: Some(nickname.clone()),
        server: Some("127.0.0.1".to_owned()),
        port: Some(6667),
        channels: vec!["#test".to_owned(), "#general".to_owned()],
        use_tls: Some(false),
        ..Config::default()
    };

    let mut client = Client::from_config(config).await.map_err(|e| e.to_string())?;
    client.identify().map_err(|e| e.to_string())?;

    let sender = client.sender();
    *state.sender.lock().await = Some(sender);

    let mut stream = client.stream().map_err(|e| e.to_string())?;

    tauri::async_runtime::spawn(async move {
        while let Some(Ok(message)) = stream.next().await {
            if let Command::PRIVMSG(channel, content) = message.command {
                if let Some(source) = message.prefix {
                    let sender_name = match source {
                        Prefix::Nickname(nick, _, _) => nick,
                        Prefix::ServerName(name) => name,
                    };
                    let payload = IrcMessage {
                        sender: sender_name,
                        content,
                        channel,
                    };
                    let _ = app.emit("irc_message", payload);
                }
            }
        }
    });

    Ok(())
}

#[tauri::command]
async fn send_message(state: State<'_, IrcState>, channel: String, message: String) -> Result<(), String> {
    let sender = state.sender.lock().await;
    if let Some(sender) = sender.as_ref() {
        sender.send_privmsg(&channel, &message).map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("Not connected".into())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .manage(IrcState { sender: Mutex::new(None) })
    .invoke_handler(tauri::generate_handler![connect_irc, send_message])
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
