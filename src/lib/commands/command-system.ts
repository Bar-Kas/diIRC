import { invoke } from "@tauri-apps/api/core";
import { Member, Server } from "@/types";

export interface CommandContext {
  serverId: string;
  channelName: string;
  channelId?: string;
  conversationId?: string;
  type: "channel" | "conversation";
  currentMember: Member;
  activeServer: Server;
  addMessage: (channelId: string, member: Member, content: string) => void;
  addDirectMessage: (conversationId: string, member: Member, content: string) => void;
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
      } catch (err) {
        console.error("Failed to send /me direct action via Tauri IRC:", err);
        ctx.addDirectMessage(ctx.conversationId, ctx.currentMember, ctcpAction);
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
