import { invoke } from "@tauri-apps/api/core";

/**
 * Invites a user to a specific IRC channel.
 * Reusable function used by slash commands (/invite) and context menus.
 */
export async function inviteUserToChannel(
  serverId: string,
  nickname: string,
  channelName: string
): Promise<boolean> {
  const cleanNick = nickname.trim();
  const cleanChan = channelName.trim();
  if (!cleanNick || !cleanChan) return false;

  const formattedChan = cleanChan.startsWith("#") || cleanChan.startsWith("&")
    ? cleanChan
    : `#${cleanChan}`;

  try {
    await invoke("send_invite", {
      serverId,
      channel: formattedChan,
      nickname: cleanNick,
    });
    return true;
  } catch (err) {
    console.error("Failed to send INVITE via Tauri IRC:", err);
    return false;
  }
}
