import { create } from "zustand";
import { persist } from "zustand/middleware";
import { invoke } from "@tauri-apps/api/core";
import { 
  Server, 
  Channel, 
  Member, 
  Message, 
  DirectMessage, 
  Profile, 
  ChannelType, 
  MemberRole 
} from "@/types";
import { 
  INITIAL_SERVERS, 
  INITIAL_MESSAGES, 
  INITIAL_DIRECT_MESSAGES, 
  MOCK_PROFILE 
} from "./mock-data";
import { v4 as uuidv4 } from "uuid";

export interface AddServerOptions {
  name: string;
  host: string;
  port: number;
  nicknames: string[];
  realname?: string;
  password?: string;
  useTls: boolean;
  autoJoinChannels?: string[];
  imageUrl?: string;
}

export interface UpdateServerOptions {
  name: string;
  host: string;
  port: number;
  nicknames?: string[];
  realname?: string;
  password?: string;
  useTls: boolean;
  autoJoinChannels?: string[];
  imageUrl?: string;
}

interface MockState {
  currentProfile: Profile;
  servers: Server[];
  messages: Record<string, Message[]>;
  directMessages: Record<string, DirectMessage[]>;
  compactMode: boolean;

  // Settings Actions
  setCompactMode: (enabled: boolean) => void;

  // Server Actions
  addServer: (optionsOrName: string | AddServerOptions, imageUrl?: string) => Server;
  updateServer: (serverId: string, optionsOrName: string | UpdateServerOptions, imageUrl?: string) => void;
  deleteServer: (serverId: string) => void;
  joinServerByInvite: (inviteCode: string) => Server | null;
  updateInviteCode: (serverId: string) => string;

  // Channel Actions
  addChannel: (serverId: string, name: string, type: ChannelType, isTemporary?: boolean) => Channel;
  updateChannel: (serverId: string, channelId: string, name: string, type: ChannelType) => void;
  deleteChannel: (serverId: string, channelId: string) => void;

  // Member Actions
  updateMemberRole: (serverId: string, memberId: string, role: MemberRole) => void;
  removeMember: (serverId: string, memberId: string) => void;

  // Message Actions
  addMessage: (channelId: string, member: Member, content: string, fileUrl?: string | null, isSystem?: boolean) => Message;
  editMessage: (channelId: string, messageId: string, content: string) => void;
  deleteMessage: (channelId: string, messageId: string) => void;

  // Direct Message Actions
  addDirectMessage: (conversationId: string, member: Member, content: string, fileUrl?: string | null) => DirectMessage;
  editDirectMessage: (conversationId: string, messageId: string, content: string) => void;
  deleteDirectMessage: (conversationId: string, messageId: string) => void;
}

export const useMockStore = create<MockState>()(
  persist<MockState>(
    (set, get) => ({
      currentProfile: MOCK_PROFILE,
      servers: INITIAL_SERVERS,
      messages: INITIAL_MESSAGES,
      directMessages: INITIAL_DIRECT_MESSAGES,
      compactMode: false,

      setCompactMode: (enabled: boolean) => set({ compactMode: enabled }),

      addServer: (optionsOrName, imageUrlParam) => {
        const newServerId = `server-${uuidv4().slice(0, 8)}`;
        const newMemberId = `member-${uuidv4().slice(0, 8)}`;

        let name = "";
        let host = "127.0.0.1";
        let port = 6667;
        let nicknames = [get().currentProfile.name.replace(/\s+/g, "") || "ReactUser"];
        let realname = "";
        let password = "";
        let useTls = false;
        let autoJoinChannels: string[] = ["general", "test"];
        let imageUrl = imageUrlParam || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&auto=format&fit=crop&q=80";

        if (typeof optionsOrName === "object") {
          name = optionsOrName.name;
          host = optionsOrName.host || host;
          port = optionsOrName.port || port;
          nicknames = optionsOrName.nicknames || nicknames;
          realname = optionsOrName.realname || "";
          password = optionsOrName.password || "";
          useTls = optionsOrName.useTls ?? false;
          if (optionsOrName.autoJoinChannels && optionsOrName.autoJoinChannels.length > 0) {
            autoJoinChannels = optionsOrName.autoJoinChannels;
          }
          if (optionsOrName.imageUrl) {
            imageUrl = optionsOrName.imageUrl;
          }
        } else {
          name = optionsOrName;
        }

        const initialChannels: Channel[] = autoJoinChannels.map((ch) => {
          const cleanName = ch.trim().replace(/^#/, "").toLowerCase().replace(/\s+/g, "-");
          return {
            id: `channel-${uuidv4().slice(0, 8)}`,
            name: cleanName || "general",
            type: ChannelType.TEXT,
            profileId: get().currentProfile.id,
            serverId: newServerId,
          };
        });

        if (initialChannels.length === 0) {
          initialChannels.push({
            id: `channel-${uuidv4().slice(0, 8)}`,
            name: "general",
            type: ChannelType.TEXT,
            profileId: get().currentProfile.id,
            serverId: newServerId,
          });
        }

        const newServer: Server = {
          id: newServerId,
          name,
          host,
          port,
          nicknames,
          realname,
          password,
          useTls,
          autoJoinChannels,
          imageUrl,
          inviteCode: `invite-${uuidv4().slice(0, 8)}`,
          profileId: get().currentProfile.id,
          channels: initialChannels,
          members: [
            {
              id: newMemberId,
              role: MemberRole.ADMIN,
              profileId: get().currentProfile.id,
              profile: get().currentProfile,
              serverId: newServerId,
            }
          ]
        };

        set((state) => ({
          servers: [...state.servers, newServer],
        }));

        return newServer;
      },

      updateServer: (serverId, optionsOrName, imageUrlParam) => {
        set((state) => ({
          servers: state.servers.map((s) => {
            if (s.id !== serverId) return s;

            if (typeof optionsOrName === "object") {
              const updatedChannels = optionsOrName.autoJoinChannels && optionsOrName.autoJoinChannels.length > 0
                ? optionsOrName.autoJoinChannels.map((ch) => {
                    const cleanName = ch.trim().replace(/^#/, "").toLowerCase().replace(/\s+/g, "-");
                    const existing = s.channels.find((c) => c.name === cleanName);
                    return existing || {
                      id: `channel-${uuidv4().slice(0, 8)}`,
                      name: cleanName,
                      type: ChannelType.TEXT,
                      profileId: get().currentProfile.id,
                      serverId,
                    };
                  })
                : s.channels;

              return {
                ...s,
                name: optionsOrName.name || s.name,
                host: optionsOrName.host || s.host,
                port: optionsOrName.port || s.port,
                nicknames: optionsOrName.nicknames || s.nicknames,
                realname: optionsOrName.realname ?? s.realname,
                password: optionsOrName.password ?? s.password,
                useTls: optionsOrName.useTls ?? s.useTls,
                autoJoinChannels: optionsOrName.autoJoinChannels || s.autoJoinChannels,
                imageUrl: optionsOrName.imageUrl || s.imageUrl,
                channels: updatedChannels,
              };
            } else {
              return {
                ...s,
                name: optionsOrName || s.name,
                imageUrl: imageUrlParam || s.imageUrl,
              };
            }
          }),
        }));
      },

      deleteServer: (serverId) => {
        const targetServer = get().servers.find((s) => s.id === serverId);
        const channelIdsToRemove = new Set(targetServer?.channels.map((c) => c.id) || []);

        try {
          invoke("disconnect_irc", { serverId }).catch(() => {});
        } catch (_) {}

        set((state) => {
          const nextMessages = { ...state.messages };
          channelIdsToRemove.forEach((id) => delete nextMessages[id]);

          return {
            servers: state.servers.filter((s) => s.id !== serverId),
            messages: nextMessages,
          };
        });
      },

      joinServerByInvite: (inviteCode) => {
        const existing = get().servers.find((s) => s.inviteCode === inviteCode);
        if (existing) return existing;

        const newServer = get().addServer(`Joined Server (${inviteCode.slice(0, 5)})`, "");
        return newServer;
      },

      updateInviteCode: (serverId) => {
        const newCode = `invite-${uuidv4().slice(0, 8)}`;
        set((state) => ({
          servers: state.servers.map((s) =>
            s.id === serverId ? { ...s, inviteCode: newCode } : s
          ),
        }));
        return newCode;
      },

      addChannel: (serverId, name, type, isTemporary) => {
        const newChannel: Channel = {
          id: `channel-${uuidv4().slice(0, 8)}`,
          name: name.toLowerCase().replace(/\s+/g, "-"),
          type,
          profileId: get().currentProfile.id,
          serverId,
          isTemporary,
        };

        set((state) => ({
          servers: state.servers.map((s) =>
            s.id === serverId
              ? { ...s, channels: [...s.channels, newChannel] }
              : s
          ),
        }));

        return newChannel;
      },

      updateChannel: (serverId, channelId, name, type) => {
        set((state) => ({
          servers: state.servers.map((s) =>
            s.id === serverId
              ? {
                  ...s,
                  channels: s.channels.map((c) =>
                    c.id === channelId
                      ? { ...c, name: name.toLowerCase().replace(/\s+/g, "-"), type }
                      : c
                  ),
                }
              : s
          ),
        }));
      },

      deleteChannel: (serverId, channelId) => {
        set((state) => {
          const nextMessages = { ...state.messages };
          delete nextMessages[channelId];

          return {
            servers: state.servers.map((s) =>
              s.id === serverId
                ? { ...s, channels: s.channels.filter((c) => c.id !== channelId) }
                : s
            ),
            messages: nextMessages,
          };
        });
      },

      updateMemberRole: (serverId, memberId, role) => {
        set((state) => ({
          servers: state.servers.map((s) =>
            s.id === serverId
              ? {
                  ...s,
                  members: s.members.map((m) =>
                    m.id === memberId ? { ...m, role } : m
                  ),
                }
              : s
          ),
        }));
      },

      removeMember: (serverId, memberId) => {
        set((state) => ({
          servers: state.servers.map((s) =>
            s.id === serverId
              ? { ...s, members: s.members.filter((m) => m.id !== memberId) }
              : s
          ),
        }));
      },

      addMessage: (channelId, member, content, fileUrl, isSystem) => {
        const existingMsgs = get().messages[channelId] || [];
        const lastMsg = existingMsgs[existingMsgs.length - 1];
        if (
          isSystem &&
          lastMsg &&
          lastMsg.isSystem &&
          lastMsg.content === content &&
          new Date().getTime() - new Date(lastMsg.createdAt).getTime() < 3000
        ) {
          return lastMsg;
        }

        const newMessage: Message = {
          id: `msg-${uuidv4().slice(0, 8)}`,
          content,
          fileUrl: fileUrl || null,
          memberId: member.id,
          member,
          channelId,
          deleted: false,
          isSystem,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        set((state) => ({
          messages: {
            ...state.messages,
            [channelId]: [...(state.messages[channelId] || []), newMessage],
          },
        }));

        return newMessage;
      },

      editMessage: (channelId, messageId, content) => {
        set((state) => ({
          messages: {
            ...state.messages,
            [channelId]: (state.messages[channelId] || []).map((m) =>
              m.id === messageId ? { ...m, content, updatedAt: new Date().toISOString() } : m
            ),
          },
        }));
      },

      deleteMessage: (channelId, messageId) => {
        set((state) => ({
          messages: {
            ...state.messages,
            [channelId]: (state.messages[channelId] || []).map((m) =>
              m.id === messageId ? { ...m, content: "This message has been deleted.", deleted: true } : m
            ),
          },
        }));
      },

      addDirectMessage: (conversationId, member, content, fileUrl) => {
        const newDm: DirectMessage = {
          id: `dm-${uuidv4().slice(0, 8)}`,
          content,
          fileUrl: fileUrl || null,
          memberId: member.id,
          member,
          conversationId,
          deleted: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        set((state) => ({
          directMessages: {
            ...state.directMessages,
            [conversationId]: [...(state.directMessages[conversationId] || []), newDm],
          },
        }));

        return newDm;
      },

      editDirectMessage: (conversationId, messageId, content) => {
        set((state) => ({
          directMessages: {
            ...state.directMessages,
            [conversationId]: (state.directMessages[conversationId] || []).map((m) =>
              m.id === messageId ? { ...m, content, updatedAt: new Date().toISOString() } : m
            ),
          },
        }));
      },

      deleteDirectMessage: (conversationId, messageId) => {
        set((state) => ({
          directMessages: {
            ...state.directMessages,
            [conversationId]: (state.directMessages[conversationId] || []).map((m) =>
              m.id === messageId ? { ...m, content: "This message has been deleted.", deleted: true } : m
            ),
          },
        }));
      },
    }),
    {
      name: "diirc-store",
      version: 1,
      partialize: (state) => ({
        ...state,
        servers: state.servers.map((s) => ({
          ...s,
          channels: s.channels.filter((c) => !c.isTemporary),
        })),
      }),
      migrate: (persistedState: any) => {
        if (!persistedState || !Array.isArray(persistedState.servers)) {
          return { servers: [], messages: {}, directMessages: {} };
        }
        const sanitizedServers = persistedState.servers.map((s: any) => ({
          ...s,
          host: s.host || "127.0.0.1",
          port: s.port || 6667,
          nicknames: s.nicknames || (s.nickname ? [s.nickname] : ["ReactUser"]),
          channels: Array.isArray(s.channels) ? s.channels : [],
          members: Array.isArray(s.members) ? s.members : [],
          useTls: s.useTls ?? false,
          autoJoinChannels: Array.isArray(s.autoJoinChannels) ? s.autoJoinChannels : ["general", "test"],
        }));
        return {
          ...persistedState,
          servers: sanitizedServers,
        };
      }
    }
  )
);
