import { invoke } from "@tauri-apps/api/core";
import { Member, Server } from "@/types";
import { inviteUserToChannel } from "@/lib/irc-actions";

export interface CommandContext {
  serverId: string;
  channelName: string;
  channelId?: string;
  conversationId?: string;
  targetMemberId?: string;
  type: "channel" | "conversation";
  currentMember: Member;
  activeServer: Server;
  addMessage: (channelId: string, member: Member, content: string) => void;
  addDirectMessage: (conversationId: string, member: Member, content: string) => void;
  navigate?: (path: string) => void;
}

export interface SlashCommand {
  name: string;
  description: string;
  execute: (args: string, ctx: CommandContext) => Promise<boolean | void> | boolean | void;
}

class CommandRegistry {
  private commands = new Map<string, SlashCommand>();

  public register(command: SlashCommand) {
    this.commands.set(command.name.toLowerCase(), command);
  }

  public get(name: string): SlashCommand | undefined {
    return this.commands.get(name.toLowerCase());
  }

  public getAll(): SlashCommand[] {
    return Array.from(this.commands.values());
  }

  public async execute(input: string, ctx: CommandContext): Promise<boolean> {
    const trimmed = input.trim();
    if (!trimmed.startsWith("/")) return false;

    const parts = trimmed.slice(1).split(/\s+/);
    const commandName = parts[0]?.toLowerCase();
    const args = trimmed.slice(1 + (parts[0]?.length || 0)).trim();

    if (!commandName) return false;

    const command = this.get(commandName);
    if (command) {
      await command.execute(args, ctx);
      return true;
    }

    return false;
  }
}

export const commandRegistry = new CommandRegistry();

// Register default commands
commandRegistry.register({
  name: "me",
  description: "Sends an action message",
  execute: async (args: string, ctx: CommandContext) => {
    const actionText = args.trim();
    if (!actionText) return;

    const ctcpAction = `\x01ACTION ${actionText}\x01`;

    if (ctx.type === "channel" && ctx.channelId) {
      const channelTarget = ctx.channelName.startsWith("#") ? ctx.channelName : `#${ctx.channelName}`;
      try {
        await invoke("send_message", {
          serverId: ctx.serverId,
          channel: channelTarget,
          message: ctcpAction,
        });
        ctx.addMessage(ctx.channelId, ctx.currentMember, ctcpAction);
      } catch (err) {
        console.error("Failed to send /me channel action via Tauri IRC:", err);
        ctx.addMessage(ctx.channelId, ctx.currentMember, ctcpAction);
      }
    } else if (ctx.type === "conversation" && ctx.conversationId) {
      try {
        await invoke("send_message", {
          serverId: ctx.serverId,
          channel: ctx.channelName,
          message: ctcpAction,
        });
        ctx.addDirectMessage(ctx.conversationId, ctx.currentMember, ctcpAction);
        if (ctx.targetMemberId) {
          const { useMockStore } = await import("@/lib/mock-store");
          useMockStore.getState().addToHistoricalConversations(ctx.serverId, ctx.targetMemberId);
        }
      } catch (err) {
        console.error("Failed to send /me direct action via Tauri IRC:", err);
        ctx.addDirectMessage(ctx.conversationId, ctx.currentMember, ctcpAction);
        if (ctx.targetMemberId) {
          const { useMockStore } = await import("@/lib/mock-store");
          useMockStore.getState().addToHistoricalConversations(ctx.serverId, ctx.targetMemberId);
        }
      }
    }
  },
});

commandRegistry.register({
  name: "join",
  description: "Joins a channel: /join #channel [password]",
  execute: async (args: string, ctx: CommandContext) => {
    const parts = args.trim().split(/\s+/);
    if (!parts[0]) return;

    const channelName = parts[0].replace(/^#/, "");
    const password = parts[1] || null;

    try {
      const { useMockStore } = await import("@/lib/mock-store");
      useMockStore.getState().setPendingJoin(ctx.serverId, channelName, password || undefined);
      
      await invoke("join_channel", {
        serverId: ctx.serverId,
        channel: channelName,
        password: password,
      });
    } catch (err) {
      console.error("Failed to send /join via Tauri IRC:", err);
    }
  },
});

commandRegistry.register({
  name: "invite",
  description: "Invites a user to a channel: /invite <nickname> [#channel]",
  execute: async (args: string, ctx: CommandContext) => {
    const parts = args.trim().split(/\s+/).filter(Boolean);
    if (!parts[0]) return;

    const nickname = parts[0];
    let channelTarget = parts[1] || "";

    if (!channelTarget) {
      if (ctx.type === "channel" && ctx.channelName) {
        channelTarget = ctx.channelName;
      } else {
        return;
      }
    }

    await inviteUserToChannel(ctx.serverId, nickname, channelTarget);
  },
});

commandRegistry.register({
  name: "mode",
  description: "Sets or queries channel modes: /mode [#channel] [flags] [params]",
  execute: async (args: string, ctx: CommandContext) => {
    const trimmed = args.trim();
    let target = "";
    let modeStr: string | null = null;
    let params: string[] | null = null;

    if (!trimmed) {
      if (ctx.type === "channel" && ctx.channelName) {
        target = ctx.channelName.startsWith("#") ? ctx.channelName : `#${ctx.channelName}`;
      } else {
        return;
      }
    } else {
      const parts = trimmed.split(/\s+/);
      if (parts[0].startsWith("#") || parts[0].startsWith("&")) {
        target = parts[0];
        if (parts.length > 1) {
          modeStr = parts[1];
          if (parts.length > 2) {
            params = parts.slice(2);
          }
        }
      } else {
        if (ctx.type === "channel" && ctx.channelName) {
          target = ctx.channelName.startsWith("#") ? ctx.channelName : `#${ctx.channelName}`;
          modeStr = parts[0];
          if (parts.length > 1) {
            params = parts.slice(1);
          }
        } else {
          return;
        }
      }
    }

    await sendMode(ctx.serverId, target, modeStr, params);
  },
});

async function sendMode(serverId: string, target: string, mode: string | null, params: string[] | null) {
  try {
    await invoke("send_mode", {
      serverId,
      target,
      mode,
      params,
    });
  } catch (err) {
    console.error("Failed to send /mode via Tauri IRC:", err);
    invoke("refresh_channel_names", { serverId, channel: target }).catch(() => {});
  }
}

async function handleRoleMode(flag: string, args: string, ctx: CommandContext) {
  const trimmed = args.trim();
  if (!trimmed) return;

  const parts = trimmed.split(/\s+/);
  let target = "";
  let nicks: string[] = [];

  if (parts[0].startsWith("#") || parts[0].startsWith("&")) {
    target = parts[0];
    nicks = parts.slice(1);
  } else {
    if (ctx.type === "channel" && ctx.channelName) {
      target = ctx.channelName.startsWith("#") ? ctx.channelName : `#${ctx.channelName}`;
      nicks = parts;
    } else {
      return;
    }
  }

  if (nicks.length === 0) return;

  const sign = flag[0];
  const modeChar = flag.slice(1);
  const modeStr = sign + modeChar.repeat(nicks.length);

  await sendMode(ctx.serverId, target, modeStr, nicks);
}

commandRegistry.register({
  name: "op",
  description: "Gives channel operator status to a user: /op [#channel] <nick...>",
  execute: (args: string, ctx: CommandContext) => handleRoleMode("+o", args, ctx),
});

commandRegistry.register({
  name: "deop",
  description: "Removes channel operator status from a user: /deop [#channel] <nick...>",
  execute: (args: string, ctx: CommandContext) => handleRoleMode("-o", args, ctx),
});

commandRegistry.register({
  name: "voice",
  description: "Gives voice status to a user: /voice [#channel] <nick...>",
  execute: (args: string, ctx: CommandContext) => handleRoleMode("+v", args, ctx),
});

commandRegistry.register({
  name: "devoice",
  description: "Removes voice status from a user: /devoice [#channel] <nick...>",
  execute: (args: string, ctx: CommandContext) => handleRoleMode("-v", args, ctx),
});

commandRegistry.register({
  name: "query",
  description: "Opens a private message conversation: /query [nickname] [message]",
  execute: async (args: string, ctx: CommandContext) => {
    const trimmed = args.trim();
    if (!trimmed) {
      const { useModalStore } = await import("@/hooks/use-modal-store");
      useModalStore.getState().onOpen("privateMessages", { serverId: ctx.serverId });
      return true;
    }

    const parts = trimmed.split(/\s+/);
    const rawNick = parts[0];
    if (!rawNick) {
      const { useModalStore } = await import("@/hooks/use-modal-store");
      useModalStore.getState().onOpen("privateMessages", { serverId: ctx.serverId });
      return true;
    }

    const cleanNick = rawNick.replace(/^@/, "");
    const initialMessage = parts.slice(1).join(" ").trim();

    const { useMockStore } = await import("@/lib/mock-store");
    const store = useMockStore.getState();

    const targetMember = store.addServerMember(ctx.serverId, cleanNick);
    if (!targetMember) return true;

    store.openConversation(ctx.serverId, targetMember.id);
    store.addToHistoricalConversations(ctx.serverId, targetMember.id);

    if (initialMessage) {
      const conversationId = [ctx.currentMember.id, targetMember.id].sort().join("-");
      try {
        await invoke("send_message", {
          serverId: ctx.serverId,
          channel: cleanNick,
          message: initialMessage,
        });
        ctx.addDirectMessage(conversationId, ctx.currentMember, initialMessage);
      } catch (err) {
        console.error("Failed to send /query message via Tauri IRC:", err);
        ctx.addDirectMessage(conversationId, ctx.currentMember, initialMessage);
      }
    }

    if (ctx.navigate) {
      ctx.navigate(`/servers/${ctx.serverId}/conversations/${targetMember.id}`);
    }

    return true;
  },
});


