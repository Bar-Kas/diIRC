import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useModalStore } from "@/hooks/use-modal-store";

const WHOIS_RESPONSE_TIMEOUT_MS = 3000;

type WhoisEventPayload = {
  server_id: string;
  query: string;
  kind: string;
};

type IrcCommandErrorPayload = {
  server_id: string;
  command: string;
};

/**
 * Sends WHOIS and waits for the native bridge to finish the response. Some
 * IRC servers silently ignore WHOIS for service or playback users, so the
 * caller gets a useful error instead of waiting forever.
 */
export async function requestWhois(
  serverId: string,
  nickname: string,
  args: string[] = [nickname]
): Promise<void> {
  const cleanNick = nickname.trim();
  if (!cleanNick) throw new Error("WHOIS requires a user nickname.");

  useModalStore.getState().onOpen("whois", {
    serverId,
    whois: { nick: cleanNick, loading: true },
  });

  let resolveResponse: (() => void) | null = null;
  const responsePromise = new Promise<void>((resolve) => {
    resolveResponse = resolve;
  });
  let whoisUnlisten: (() => void) | undefined;
  let commandErrorUnlisten: (() => void) | undefined;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    whoisUnlisten = await listen<WhoisEventPayload>("irc_whois_event", ({ payload }) => {
      if (
        payload.server_id === serverId &&
        payload.query?.trim().toLowerCase() === cleanNick.toLowerCase() &&
        payload.kind === "complete"
      ) {
        resolveResponse?.();
      }
    });
    commandErrorUnlisten = await listen<IrcCommandErrorPayload>("irc_command_error", ({ payload }) => {
      if (payload.server_id === serverId && payload.command?.trim().toUpperCase() === "WHOIS") {
        // The provider already displays the server error modal. Treat it as a
        // completed request so the timeout does not replace that message.
        resolveResponse?.();
      }
    });

    await invoke("send_raw", {
      serverId,
      command: "WHOIS",
      args,
    });

    await Promise.race([
      responsePromise,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`No WHOIS response was received for ${cleanNick} within 3 seconds.`));
        }, WHOIS_RESPONSE_TIMEOUT_MS);
      }),
    ]);
  } catch (error) {
    useModalStore.getState().onClose("whois");
    throw error;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    whoisUnlisten?.();
    commandErrorUnlisten?.();
  }
}

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
