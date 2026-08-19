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
  LogPage,
  BufferRef,
  BufferReadState,
  BufferKey,
  ScrollViewportState,
  MessageAnchor,
  MentionMatch
} from "@/types";
import { 
  INITIAL_SERVERS, 
  INITIAL_MESSAGES, 
  INITIAL_DIRECT_MESSAGES, 
  MOCK_PROFILE 
} from "./mock-data";
import { v4 as uuidv4 } from "uuid";
import { ImageUploadConfig, UrlAuthRule } from "./upload/types";
import { getBufferKey } from "./chat-buffer";
import { findMention } from "./mention-matcher";

export const MAX_MESSAGES_IN_MEMORY = 500;

const chatKey = (serverId: string, type: "channel" | "conversation", id: string) =>
  getBufferKey(serverId, type, id);

const hashString = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
};

const emptyReadState = (): BufferReadState => ({
  initialized: false,
  lastReadTimestamp: null,
  unreadCount: 0,
  mentionCount: 0,
  firstUnread: null,
  latestMessageTimestamp: null,
});

const isWindowFocused = () => typeof document !== "undefined" && document.hasFocus() && document.visibilityState === "visible";

const getMessageAnchor = (message: Message | DirectMessage): MessageAnchor => ({
  timestamp: message.sourceTimestamp || message.createdAt,
  messageId: message.id,
  sender: message.member.profile.name,
  fingerprint: `${message.member.profile.name}|${message.content}`.slice(0, 200),
});

const parseLogTimestamp = (timestamp: string) => {
  const parsed = new Date(timestamp.replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
};

const createIrcMember = (serverId: string, name: string): Member => ({
  id: `irc-${name}`,
  profileId: `profile-${name}`,
  profile: {
    id: `profile-${name}`,
    userId: `user-${name}`,
    name,
    imageUrl: "",
    email: `${name}@irc.local`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  serverId,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const mapLogEntries = (
  entries: LogPage["entries"],
  server: Server | undefined,
  serverId: string,
  type: "channel" | "conversation",
  chatId: string,
): (Message | DirectMessage)[] => entries.map((entry) => {
  const member = server?.members.find(
    (item) => item.profile.name.toLowerCase() === entry.sender.toLowerCase()
  ) || createIrcMember(serverId, entry.sender);
  const createdAt = parseLogTimestamp(entry.timestamp);

  return {
    id: `log-${hashString(`${createdAt}|${entry.sender}|${entry.content}`)}`,
    content: entry.content,
    fileUrl: null,
    memberId: member.id,
    member,
    channelId: type === "channel" ? chatId : undefined,
    conversationId: type === "conversation" ? chatId : undefined,
    deleted: false,
    sourceTimestamp: createdAt,
    createdAt,
    updatedAt: createdAt,
  } as Message | DirectMessage;
});

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

export type StatusDisplayMode = "always" | "on_error" | "disabled";

interface MockState {
  currentProfile: Profile;
  servers: Server[];
  messages: Record<string, Message[]>;
  directMessages: Record<string, DirectMessage[]>;
  activeChatKey: string | null;
  readStates: Record<BufferKey, BufferReadState>;
  viewportStates: Record<BufferKey, ScrollViewportState>;
  messageSequences: Record<BufferKey, number>;
  historyLoadToken: number;
  historyNextOffset: number | null;
  historyHasMore: boolean;
  compactMode: boolean;
  enableCommandSuggestions: boolean;
  enableLinkPreviews: boolean;
  enableWebPagePreviews: boolean;
  linkPreviewApiUrl: string;
  uploadConfig: ImageUploadConfig;
  urlAuthRules: UrlAuthRule[];
  ircConnectedServers: Record<string, boolean>;
  statusDisplayMode: StatusDisplayMode;

  // Connection Actions
  setIrcConnected: (serverId: string, isConnected: boolean) => void;
  setStatusDisplayMode: (mode: StatusDisplayMode) => void;

  // Settings Actions
  setCompactMode: (enabled: boolean) => void;
  setEnableCommandSuggestions: (enabled: boolean) => void;
  setEnableLinkPreviews: (enabled: boolean) => void;
  setEnableWebPagePreviews: (enabled: boolean) => void;
  setLinkPreviewApiUrl: (url: string) => void;
  setUploadConfig: (config: ImageUploadConfig) => void;
  addUrlAuthRule: (rule: Omit<UrlAuthRule, "id">) => void;
  removeUrlAuthRule: (id: string) => void;

  // Server Actions
  addServer: (optionsOrName: string | AddServerOptions, imageUrl?: string) => Server;
  updateServer: (serverId: string, optionsOrName: string | UpdateServerOptions, imageUrl?: string) => void;
  deleteServer: (serverId: string) => void;
  joinServerByInvite: (inviteCode: string) => Server | null;
  updateInviteCode: (serverId: string) => string;

  // Channel Actions
  pendingJoin: { serverId: string; channelName: string; password?: string } | null;
  setPendingJoin: (serverId: string | null, channelName: string | null, password?: string) => void;
  addChannel: (serverId: string, name: string, type: ChannelType, isTemporary?: boolean) => Channel;
  updateChannel: (serverId: string, channelId: string, name: string, type: ChannelType) => void;
  updateChannelTopic: (serverId: string, channelId: string, topic: string) => void;
  updateChannelTopicByName: (serverId: string, channelName: string, topic: string) => void;
  updateChannelKey: (serverId: string, channelId: string, key?: string) => void;
  deleteChannel: (serverId: string, channelId: string) => void;

  // Member Actions
  removeMember: (serverId: string, memberId: string) => void;
  addServerMember: (serverId: string, name: string, realname?: string) => Member | undefined;
  removeServerMember: (serverId: string, name: string) => void;
  channelMembers: Record<string, string[]>;
  channelOps: Record<string, string[]>;
  updateChannelMembers: (serverId: string, channelName: string, users: string[], eventType: "NAMES" | "JOIN" | "PART" | "QUIT") => void;
  updateChannelOps: (serverId: string, channelName: string, ops: string[]) => void;

  // Message Actions
  loadChatHistory: (type: "channel" | "conversation", chatId: string, serverId: string, target: string) => Promise<void>;
  loadOlderHistory: (type: "channel" | "conversation", chatId: string, serverId: string, target: string) => Promise<boolean>;
  addMessage: (channelId: string, member: Member, content: string, fileUrl?: string | null, isSystem?: boolean) => Message;
  ingestIncomingMessage: (buffer: BufferRef, member: Member, content: string, fileUrl?: string | null, isSystem?: boolean, sourceTimestamp?: string) => Message;
  ingestIncomingDirectMessage: (buffer: BufferRef, member: Member, content: string, fileUrl?: string | null, sourceTimestamp?: string) => DirectMessage;
  ingestIncomingChannelBatch: (items: Array<{ buffer: BufferRef; member: Member; content: string; fileUrl?: string | null; isSystem?: boolean; timestamp?: string }>) => void;
  setViewportState: (bufferKey: BufferKey, viewport: Omit<ScrollViewportState, "revision">) => void;
  markBufferRead: (bufferKey: BufferKey, reason: "bottom" | "jump-to-present" | "escape" | "manual") => void;
  clearBufferNotifications: (bufferKey: BufferKey) => void;
  updateUnreadProgress: (bufferKey: BufferKey, remainingUnread: number, newFirstUnread: MessageAnchor | null, remainingMentions: number) => void;
  deleteMessage: (channelId: string, messageId: string) => void;

  // Direct Message Actions
  activeConversations: Record<string, string[]>;
  openConversation: (serverId: string, memberId: string) => void;
  closeConversation: (serverId: string, memberId: string) => void;
  addDirectMessage: (conversationId: string, member: Member, content: string, fileUrl?: string | null) => DirectMessage;
  deleteDirectMessage: (conversationId: string, messageId: string) => void;
}

export const useMockStore = create<MockState>()(
  persist<MockState>(
    (set, get) => ({
      currentProfile: MOCK_PROFILE,
      servers: INITIAL_SERVERS,
      messages: INITIAL_MESSAGES,
      directMessages: INITIAL_DIRECT_MESSAGES,
      activeChatKey: null,
      readStates: {},
      viewportStates: {},
      messageSequences: {},
      historyLoadToken: 0,
      historyNextOffset: null,
      historyHasMore: false,
      pendingJoin: null,
      setPendingJoin: (serverId, channelName, password) => {
        if (!serverId || !channelName) {
          set({ pendingJoin: null });
        } else {
          set({ pendingJoin: { serverId, channelName: channelName.replace(/^#/, ""), password } });
        }
      },
      activeConversations: {},
      compactMode: false,
      enableCommandSuggestions: true,
      enableLinkPreviews: true,
      enableWebPagePreviews: true,
      linkPreviewApiUrl: "https://api.microlink.io",
      uploadConfig: {
        provider: "litterbox",
        litterboxTime: "24h",
      },
      urlAuthRules: [],
      ircConnectedServers: {},
      statusDisplayMode: "always",

      setIrcConnected: (serverId: string, isConnected: boolean) =>
        set((state) => ({
          ircConnectedServers: {
            ...state.ircConnectedServers,
            [serverId]: isConnected,
          },
        })),

      setStatusDisplayMode: (mode: StatusDisplayMode) => set({ statusDisplayMode: mode }),

      setCompactMode: (enabled: boolean) => set({ compactMode: enabled }),
      setEnableCommandSuggestions: (enabled: boolean) => set({ enableCommandSuggestions: enabled }),
      setEnableLinkPreviews: (enabled: boolean) => set({ enableLinkPreviews: enabled }),
      setEnableWebPagePreviews: (enabled: boolean) => set({ enableWebPagePreviews: enabled }),
      setLinkPreviewApiUrl: (url: string) => set({ linkPreviewApiUrl: url }),
      setUploadConfig: (config: ImageUploadConfig) => set({ uploadConfig: config }),
      addUrlAuthRule: (rule) =>
        set((state) => ({
          urlAuthRules: [
            ...state.urlAuthRules,
            { ...rule, id: `auth-rule-${uuidv4().slice(0, 8)}` },
          ],
        })),
      removeUrlAuthRule: (id) =>
        set((state) => ({
          urlAuthRules: state.urlAuthRules.filter((r) => r.id !== id),
        })),

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

        const primaryNick = nicknames[0] || get().currentProfile.name.replace(/\s+/g, "") || "ReactUser";

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
              profileId: get().currentProfile.id,
              profile: {
                ...get().currentProfile,
                name: primaryNick,
              },
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
        set((state) => {
          const nextMessages = { ...state.messages };
          const updatedServers = state.servers.map((s) => {
            if (s.id !== serverId) return s;

            if (typeof optionsOrName === "object") {
              const newNicknames = optionsOrName.nicknames && optionsOrName.nicknames.length > 0
                ? optionsOrName.nicknames
                : s.nicknames;
              const primaryNick = newNicknames && newNicknames.length > 0 ? newNicknames[0] : "ReactUser";

              const updatedChannels = optionsOrName.autoJoinChannels && optionsOrName.autoJoinChannels.length > 0
                ? optionsOrName.autoJoinChannels.map((ch) => {
                    const cleanName = ch.trim().replace(/^#/, "").toLowerCase().replace(/\s+/g, "-");
                    const existing = s.channels.find((c) => c.name.trim().replace(/^#/, "").toLowerCase() === cleanName);
                    return existing || {
                      id: `channel-${uuidv4().slice(0, 8)}`,
                      name: cleanName,
                      type: ChannelType.TEXT,
                      profileId: get().currentProfile.id,
                      serverId,
                    };
                  })
                : s.channels;

              const updatedMembers = s.members.map((m) => {
                if (m.profileId === get().currentProfile.id || m.id.startsWith("member-")) {
                  return {
                    ...m,
                    profile: {
                      ...m.profile,
                      name: primaryNick,
                    },
                  };
                }
                return m;
              });

              // Update any existing messages sent by the user in this server's channels
              s.channels.forEach((ch) => {
                if (nextMessages[ch.id]) {
                  nextMessages[ch.id] = nextMessages[ch.id].map((msg) => {
                    if (msg.member.profileId === get().currentProfile.id || msg.member.id.startsWith("member-")) {
                      return {
                        ...msg,
                        member: {
                          ...msg.member,
                          profile: {
                            ...msg.member.profile,
                            name: primaryNick,
                          },
                        },
                      };
                    }
                    return msg;
                  });
                }
              });

              return {
                ...s,
                name: optionsOrName.name || s.name,
                host: optionsOrName.host || s.host,
                port: optionsOrName.port || s.port,
                nicknames: newNicknames,
                realname: optionsOrName.realname ?? s.realname,
                password: optionsOrName.password ?? s.password,
                useTls: optionsOrName.useTls ?? s.useTls,
                autoJoinChannels: optionsOrName.autoJoinChannels || s.autoJoinChannels,
                imageUrl: optionsOrName.imageUrl || s.imageUrl,
                channels: updatedChannels,
                members: updatedMembers,
              };
            } else {
              return {
                ...s,
                name: optionsOrName || s.name,
                imageUrl: imageUrlParam || s.imageUrl,
              };
            }
          });

          return {
            servers: updatedServers,
            messages: nextMessages,
          };
        });
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
        const cleanName = name.trim().replace(/^#/, "").toLowerCase().replace(/\s+/g, "-");
        const server = get().servers.find((s) => s.id === serverId);

        if (server) {
          const existingChannel = server.channels.find(
            (c) => c.name.trim().replace(/^#/, "").toLowerCase() === cleanName && c.type === type
          );

          if (existingChannel) {
            if (isTemporary === false && existingChannel.isTemporary) {
              set((state) => ({
                servers: state.servers.map((s) =>
                  s.id === serverId
                    ? {
                        ...s,
                        channels: s.channels.map((c) =>
                          c.id === existingChannel.id
                            ? { ...c, isTemporary: false }
                            : c
                        ),
                      }
                    : s
                ),
              }));
              return { ...existingChannel, isTemporary: false };
            }
            return existingChannel;
          }
        }

        const newChannel: Channel = {
          id: `channel-${uuidv4().slice(0, 8)}`,
          name: cleanName,
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

      updateChannelTopic: (serverId, channelId, topic) => {
        set((state) => ({
          servers: state.servers.map((s) =>
            s.id === serverId
              ? {
                  ...s,
                  channels: s.channels.map((c) =>
                    c.id === channelId ? { ...c, topic } : c
                  ),
                }
              : s
          ),
        }));
      },

      updateChannelTopicByName: (serverId, channelName, topic) => {
        const cleanName = channelName.replace(/^#/, "").toLowerCase();
        set((state) => ({
          servers: state.servers.map((s) =>
            s.id === serverId
              ? {
                  ...s,
                  channels: s.channels.map((c) =>
                    c.name.toLowerCase() === cleanName ? { ...c, topic } : c
                  ),
                }
              : s
          ),
        }));
      },

      updateChannelKey: (serverId, channelId, key) => {
        set((state) => ({
          servers: state.servers.map((s) =>
            s.id === serverId
              ? {
                  ...s,
                  channels: s.channels.map((c) =>
                    c.id === channelId || c.name.toLowerCase() === channelId.toLowerCase().replace(/^#/, "")
                      ? { ...c, key: key || undefined }
                      : c
                  ),
                }
              : s
          ),
        }));
      },

      deleteChannel: (serverId, channelId) => {
        const state = get();
        const server = state.servers.find((s) => s.id === serverId);
        const channel = server?.channels.find((c) => c.id === channelId);

        if (server && channel) {
          invoke("part_channel", {
            serverId: server.id,
            channel: channel.name,
          }).catch((err) => {
            console.error("Failed to send PART to IRC server:", err);
          });
        }

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

      removeMember: (serverId, memberId) => {
        set((state) => ({
          servers: state.servers.map((s) =>
            s.id === serverId
              ? { ...s, members: s.members.filter((m) => m.id !== memberId) }
              : s
          ),
        }));
      },

      addServerMember: (serverId, name, realname) => {
        let resultMember: Member | undefined;
        set((state) => {
          const s = state.servers.find(s => s.id === serverId);
          if (!s) return state;

          const exists = s.members.find(m => m.profile.name.toLowerCase() === name.toLowerCase());
          if (exists) {
            if (realname && !exists.profile.realname) {
              exists.profile.realname = realname;
            }
            resultMember = exists;
            return state;
          }

          const currentProfile = state.currentProfile;
          const isOurNick = s.nicknames?.includes(name) || name === currentProfile.name;
          if (isOurNick) {
            let updatedSelf: Member | undefined;
            const updatedMembers = s.members.map((m) => {
              if (m.profileId === currentProfile.id || m.id.startsWith("member-")) {
                const updated = {
                  ...m,
                  profile: {
                    ...m.profile,
                    name,
                    realname: realname || s.realname || m.profile.realname,
                  },
                };
                if (!updatedSelf) updatedSelf = updated;
                return updated;
              }
              return m;
            });
            resultMember = updatedSelf;
            return {
              servers: state.servers.map((serv) =>
                serv.id === serverId
                  ? { ...serv, members: updatedMembers }
                  : serv
              ),
            };
          }

          const mockMember: Member = {
            id: `irc-${name}`,
            profileId: `profile-${name}`,
            profile: {
              id: `profile-${name}`,
              userId: `user-${name}`,
              name: name,
              realname: realname || "",
              imageUrl: "",
              email: `${name}@irc.local`,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            serverId: serverId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          resultMember = mockMember;

          return {
            servers: state.servers.map((serv) =>
              serv.id === serverId
                ? { ...serv, members: [...serv.members, mockMember] }
                : serv
            ),
          };
        });
        return resultMember;
      },

      removeServerMember: (serverId, name) => {
        set((state) => ({
          servers: state.servers.map((s) =>
            s.id === serverId
              ? { ...s, members: s.members.filter(m => m.profile.name !== name) }
              : s
          ),
        }));
      },

      channelMembers: {},
      channelOps: {},

      updateChannelOps: (serverId, channelName, ops) => {
        const cleanChan = channelName ? channelName.trim().replace(/^#/, "").toLowerCase() : "";
        set((state) => {
          const targetServer = state.servers.find((s) => s.id === serverId);
          if (!targetServer || !cleanChan) return state;

          const targetChannel = targetServer.channels.find(
            (c) => c.name.toLowerCase().replace(/^#/, "") === cleanChan
          );

          if (!targetChannel) return state;

          return {
            channelOps: {
              ...state.channelOps,
              [targetChannel.id]: ops,
            },
          };
        });
      },

      updateChannelMembers: (serverId, channelName, users, eventType) => {
        // Ensure all users exist as server members
        users.forEach((u) => {
          if (u && u.trim()) {
            get().addServerMember(serverId, u.trim());
          }
        });

        const cleanChan = channelName ? channelName.trim().replace(/^#/, "").toLowerCase() : "";

        set((state) => {
          const targetServer = state.servers.find((s) => s.id === serverId);
          if (!targetServer) return state;

          const updatedChannelMembers = { ...state.channelMembers };

          if (cleanChan) {
            const targetChannel = targetServer.channels.find(
              (c) => c.name.toLowerCase().replace(/^#/, "") === cleanChan
            );

            if (targetChannel) {
              const chId = targetChannel.id;
              const currentUsers = updatedChannelMembers[chId] || [];

              if (eventType === "NAMES") {
                updatedChannelMembers[chId] = Array.from(new Set(users));
              } else if (eventType === "JOIN") {
                updatedChannelMembers[chId] = Array.from(new Set([...currentUsers, ...users]));
              } else if (eventType === "PART") {
                const toRemove = new Set(users.map((u) => u.toLowerCase()));
                updatedChannelMembers[chId] = currentUsers.filter((u) => !toRemove.has(u.toLowerCase()));
              }
            }
          }

          if (eventType === "QUIT") {
            const toRemove = new Set(users.map((u) => u.toLowerCase()));
            targetServer.channels.forEach((c) => {
              if (updatedChannelMembers[c.id]) {
                updatedChannelMembers[c.id] = updatedChannelMembers[c.id].filter(
                  (u) => !toRemove.has(u.toLowerCase())
                );
              }
            });
          }

          return { channelMembers: updatedChannelMembers };
        });
      },

      loadChatHistory: async (type, chatId, serverId, target) => {
        const requestedKey = chatKey(serverId, type, chatId);
        // OnChannelDeselect: nie czyść automatycznie – tylko Esc / Jump to Present oraz top-margin
        const requestToken = get().historyLoadToken + 1;
        set({
          activeChatKey: requestedKey,
          historyLoadToken: requestToken,
          historyNextOffset: null,
          historyHasMore: false,
          messages: {},
          directMessages: {},
        });

        try {
          const page = await invoke<LogPage>("load_log_page", {
            serverId,
            channel: target,
            before: null,
          });
          const state = get();
          if (state.activeChatKey !== requestedKey || state.historyLoadToken !== requestToken) return;

          const server = state.servers.find((item) => item.id === serverId);
          const messages = mapLogEntries(page.entries, server, serverId, type, chatId);
          const currentAfter = get();
          if (currentAfter.activeChatKey !== requestedKey || currentAfter.historyLoadToken !== requestToken) return;
          // Race: w czasie load wpadły nowe wiadomości via ingest (emit IRC) – nie nadpisuj ich
          const existingAfter = type === "channel" ? currentAfter.messages[chatId] || [] : currentAfter.directMessages[chatId] || [];
          const dedupedExisting = (existingAfter as any[]).filter((em: any) => !(messages as any[]).some((lm: any) => lm.member?.profile?.name === em.member?.profile?.name && lm.content === em.content && Math.abs(new Date(lm.createdAt).getTime() - new Date(em.createdAt).getTime()) < 2000));
          const merged = [...messages, ...dedupedExisting].slice(-MAX_MESSAGES_IN_MEMORY) as typeof messages;
          const latestMessage = (merged[merged.length - 1] as any) || messages[messages.length - 1];
          let existingReadState = currentAfter.readStates[requestedKey] || state.readStates[requestedKey];
          // OnChannelOpened: jeśli brak dividera ale są wiadomości nowsze niż LastRead, wstaw divider
          if (existingReadState?.initialized && !existingReadState.firstUnread && existingReadState.lastReadTimestamp) {
            const firstNewIdx = (merged as any[]).findIndex((m: any) => new Date(m.sourceTimestamp || m.createdAt).getTime() > new Date(existingReadState.lastReadTimestamp as string).getTime());
            if (firstNewIdx >= 0) {
              const firstNew = (merged as any[])[firstNewIdx];
              const remaining = (merged as any[]).length - firstNewIdx;
              let mentions = 0;
              for (let i=firstNewIdx;i<(merged as any[]).length;i++) if ((merged as any[])[i].mention?.matched) mentions++;
              existingReadState = {
                ...existingReadState,
                firstUnread: {
                  timestamp: firstNew.sourceTimestamp || firstNew.createdAt,
                  messageId: firstNew.id,
                  sender: firstNew.member.profile.name,
                  fingerprint: `${firstNew.member.profile.name}|${firstNew.content}`.slice(0,200),
                },
                unreadCount: remaining,
                mentionCount: mentions,
              };
            }
          }
          const readState = existingReadState?.initialized
            ? existingReadState
            : {
                ...emptyReadState(),
                initialized: true,
                lastReadTimestamp: latestMessage?.sourceTimestamp || latestMessage?.createdAt || null,
                latestMessageTimestamp: latestMessage?.sourceTimestamp || latestMessage?.createdAt || null,
                latestMessageId: latestMessage?.id,
              };

          if (type === "channel") {
            set({
              messages: { [chatId]: merged as Message[] },
              readStates: { ...currentAfter.readStates, [requestedKey]: readState },
              historyNextOffset: page.nextOffset,
              historyHasMore: page.nextOffset !== null,
            });
          } else {
            set({
              directMessages: { [chatId]: merged as DirectMessage[] },
              readStates: { ...currentAfter.readStates, [requestedKey]: readState },
              historyNextOffset: page.nextOffset,
              historyHasMore: page.nextOffset !== null,
            });
          }
        } catch (error) {
          console.error(`Failed to load IRC history for ${target}:`, error);
        }
      },

      loadOlderHistory: async (type, chatId, serverId, target) => {
        const requestedKey = chatKey(serverId, type, chatId);
        const state = get();
        if (
          state.activeChatKey !== requestedKey
          || !state.historyHasMore
          || state.historyNextOffset === null
        ) {
          return false;
        }

        const requestToken = state.historyLoadToken;

        try {
          const page = await invoke<LogPage>("load_log_page", {
            serverId,
            channel: target,
            before: state.historyNextOffset,
          });
          const current = get();
          if (current.activeChatKey !== requestedKey || current.historyLoadToken !== requestToken) {
            return false;
          }

          const server = current.servers.find((item) => item.id === serverId);
          const olderMessages = mapLogEntries(page.entries, server, serverId, type, chatId);
          const currentMessages = type === "channel"
            ? current.messages[chatId] || []
            : current.directMessages[chatId] || [];
          const combinedMessages = [...olderMessages, ...currentMessages].slice(-MAX_MESSAGES_IN_MEMORY);
          const hasMore = page.nextOffset !== null && combinedMessages.length < MAX_MESSAGES_IN_MEMORY;

          if (type === "channel") {
            set({
              messages: { [chatId]: combinedMessages as Message[] },
              historyNextOffset: page.nextOffset,
              historyHasMore: hasMore,
            });
          } else {
            set({
              directMessages: { [chatId]: combinedMessages as DirectMessage[] },
              historyNextOffset: page.nextOffset,
              historyHasMore: hasMore,
            });
          }

          return olderMessages.length > 0;
        } catch (error) {
          console.error(`Failed to load older IRC history for ${target}:`, error);
          return false;
        }
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

        const serverId = member.serverId || get().servers
          .flatMap((server) => server.channels)
          .find((channel) => channel.id === channelId)?.serverId || "";
        const bufferKey = getBufferKey(serverId, "channel", channelId);
        const now = newMessage.createdAt;

        if (get().activeChatKey === bufferKey) {
          set((state) => ({
            messages: {
              [channelId]: [...(state.messages[channelId] || []), newMessage].slice(-MAX_MESSAGES_IN_MEMORY),
            },
          }));
        }

        // Self-Action Override: wysłanie wymusza IsAtBottom i czyści divider
        set((state) => {
          const previous = state.readStates[bufferKey] || emptyReadState();
          return {
            readStates: {
              ...state.readStates,
              [bufferKey]: {
                ...previous,
                initialized: true,
                latestMessageTimestamp: now,
                latestMessageId: newMessage.id,
                lastReadTimestamp: now,
                lastReadMessageId: newMessage.id,
                firstUnread: null,
                unreadCount: 0,
                mentionCount: 0,
              },
            },
            messageSequences: {
              ...state.messageSequences,
              [bufferKey]: (state.messageSequences[bufferKey] || 0) + 1,
            },
            viewportStates: {
              ...state.viewportStates,
              [bufferKey]: {
                bufferKey,
                geometry: state.viewportStates[bufferKey]?.geometry || { scrollTop: 0, scrollHeight: 0, clientHeight: 0, distanceFromBottom: 0, distanceFromTop: 0 },
                isAtBottom: true,
                isAtTop: false,
                revision: (state.viewportStates[bufferKey]?.revision || 0) + 1,
              },
            },
          };
        });

        return newMessage;
      },

      ingestIncomingMessage: (buffer, member, content, fileUrl, isSystem, sourceTimestamp) => {
        const state = get();
        const now = sourceTimestamp || new Date().toISOString();
        const mention = !isSystem
          ? findMention(
              content,
              state.currentProfile.name,
              state.servers.find((server) => server.id === buffer.serverId)?.highlightKeywords || [],
            )
          : { matched: false, source: null } as MentionMatch;
        const newMessage: Message = {
          id: `msg-${uuidv4().slice(0, 8)}`,
          content,
          fileUrl: fileUrl || null,
          memberId: member.id,
          member,
          channelId: buffer.id,
          deleted: false,
          isSystem,
          mention,
          sourceTimestamp: now,
          createdAt: now,
          updatedAt: now,
        };

        set((current) => {
          const previous = current.readStates[buffer.key] || emptyReadState();
          const sequence = (current.messageSequences[buffer.key] || 0) + 1;
          const active = current.activeChatKey === buffer.key;
          const eligible = !isSystem;
          const isAtBottom = current.viewportStates[buffer.key]?.isAtBottom === true;
          const isFocused = isWindowFocused();
          let nextFirstUnread = previous.firstUnread;
          let nextUnread = previous.unreadCount;
          let nextMentions = previous.mentionCount;
          let nextLastReadTs: string | null = previous.lastReadTimestamp;
          let nextLastReadId: string | undefined = previous.lastReadMessageId;
          if (eligible) {
            if (active && isAtBottom && isFocused) {
              nextLastReadTs = now;
              nextLastReadId = newMessage.id;
              nextFirstUnread = null;
              nextUnread = 0;
              nextMentions = 0;
            } else {
              if (!previous.firstUnread) nextFirstUnread = getMessageAnchor(newMessage);
              nextUnread = previous.unreadCount + 1;
              if (mention.matched) nextMentions = previous.mentionCount + 1;
            }
          }
          const nextReadState: BufferReadState = {
            ...previous,
            initialized: true,
            latestMessageTimestamp: now,
            latestMessageId: newMessage.id,
            unreadCount: nextUnread,
            mentionCount: nextMentions,
            firstUnread: nextFirstUnread,
            lastReadTimestamp: nextLastReadTs,
            lastReadMessageId: nextLastReadId,
          };

          return {
            ...(active
              ? {
                  messages: {
                    ...current.messages,
                    [buffer.id]: [
                      ...(current.messages[buffer.id] || []),
                      newMessage,
                    ].slice(-MAX_MESSAGES_IN_MEMORY),
                  },
                }
              : {}),
            readStates: { ...current.readStates, [buffer.key]: nextReadState },
            messageSequences: { ...current.messageSequences, [buffer.key]: sequence },
          };
        });

        return newMessage;
      },

      ingestIncomingDirectMessage: (buffer, member, content, fileUrl, sourceTimestamp) => {
        const state = get();
        const now = sourceTimestamp || new Date().toISOString();
        const mention = findMention(
          content,
          state.currentProfile.name,
          state.servers.find((server) => server.id === buffer.serverId)?.highlightKeywords || [],
        );
        const newMessage: DirectMessage = {
          id: `dm-${uuidv4().slice(0, 8)}`,
          content,
          fileUrl: fileUrl || null,
          memberId: member.id,
          member,
          conversationId: buffer.id,
          deleted: false,
          mention,
          sourceTimestamp: now,
          createdAt: now,
          updatedAt: now,
        };

        set((current) => {
          const previous = current.readStates[buffer.key] || emptyReadState();
          const sequence = (current.messageSequences[buffer.key] || 0) + 1;
          const active = current.activeChatKey === buffer.key;
          const isAtBottom = current.viewportStates[buffer.key]?.isAtBottom === true;
          const isFocused = isWindowFocused();
          let nextFirstUnread = previous.firstUnread;
          let nextUnread = previous.unreadCount;
          let nextMentions = previous.mentionCount;
          let nextLastReadTs: string | null = previous.lastReadTimestamp;
          let nextLastReadId: string | undefined = previous.lastReadMessageId;
          if (active && isAtBottom && isFocused) {
            nextLastReadTs = now;
            nextLastReadId = newMessage.id;
            nextFirstUnread = null;
            nextUnread = 0;
            nextMentions = 0;
          } else {
            if (!previous.firstUnread) nextFirstUnread = getMessageAnchor(newMessage);
            nextUnread = previous.unreadCount + 1;
            if (mention.matched) nextMentions = previous.mentionCount + 1;
          }
          const nextReadState: BufferReadState = {
            ...previous,
            initialized: true,
            latestMessageTimestamp: now,
            latestMessageId: newMessage.id,
            unreadCount: nextUnread,
            mentionCount: nextMentions,
            firstUnread: nextFirstUnread,
            lastReadTimestamp: nextLastReadTs,
            lastReadMessageId: nextLastReadId,
          };

          return {
            ...(active
              ? {
                  directMessages: {
                    ...current.directMessages,
                    [buffer.id]: [
                      ...(current.directMessages[buffer.id] || []),
                      newMessage,
                    ].slice(-MAX_MESSAGES_IN_MEMORY),
                  },
                }
              : {}),
            readStates: { ...current.readStates, [buffer.key]: nextReadState },
            messageSequences: { ...current.messageSequences, [buffer.key]: sequence },
          };
        });

        return newMessage;
      },

      setViewportState: (bufferKey, viewport) => {
        set((state) => ({
          viewportStates: {
            ...state.viewportStates,
            [bufferKey]: {
              ...viewport,
              revision: (state.viewportStates[bufferKey]?.revision || 0) + 1,
            },
          },
        }));
      },

      markBufferRead: (bufferKey, reason) => {
        set((state) => {
          const readState = state.readStates[bufferKey];
          if (!readState) return state;
          if (
            reason === "bottom"
            && (state.activeChatKey !== bufferKey || state.viewportStates[bufferKey]?.isAtBottom !== true)
          ) {
            return state;
          }

          return {
            readStates: {
              ...state.readStates,
              [bufferKey]: {
                ...readState,
                unreadCount: 0,
                mentionCount: 0,
                firstUnread: null,
                lastReadTimestamp: readState.latestMessageTimestamp || readState.lastReadTimestamp,
                lastReadMessageId: readState.latestMessageId || readState.lastReadMessageId,
              },
            },
          };
        });
      },

      clearBufferNotifications: (bufferKey) => {
        get().markBufferRead(bufferKey, "manual");
      },

      updateUnreadProgress: (bufferKey, remainingUnread, newFirstUnread, remainingMentions) => {
        set((state) => {
          const rs = state.readStates[bufferKey];
          if (!rs || rs.unreadCount === remainingUnread) return state;
          // nie nadpisuj gdy już 0 i nie ma firstUnread
          if (remainingUnread === 0) {
            return {
              readStates: {
                ...state.readStates,
                [bufferKey]: {
                  ...rs,
                  unreadCount: 0,
                  mentionCount: 0,
                  firstUnread: null,
                  lastReadTimestamp: rs.latestMessageTimestamp || rs.lastReadTimestamp,
                  lastReadMessageId: rs.latestMessageId || rs.lastReadMessageId,
                },
              },
            };
          }
          return {
            readStates: {
              ...state.readStates,
              [bufferKey]: {
                ...rs,
                unreadCount: remainingUnread,
                mentionCount: remainingMentions,
                firstUnread: newFirstUnread || rs.firstUnread,
              },
            },
          };
        });
      },

      ingestIncomingChannelBatch: (items: Array<{ buffer: BufferRef; member: Member; content: string; fileUrl?: string | null; isSystem?: boolean; timestamp?: string }>) => {
        if (items.length === 0) return;
        const state = get();
        const nowMap = new Map<string, string>();
        items.forEach((item) => {
          if (!nowMap.has(item.buffer.key)) {
            nowMap.set(item.buffer.key, item.timestamp || new Date().toISOString());
          }
        });

        set((current) => {
          const nextMessages = { ...current.messages };
          const nextReadStates = { ...current.readStates };
          const nextSequences = { ...current.messageSequences };

          items.forEach((item) => {
            const now = item.timestamp || nowMap.get(item.buffer.key) || new Date().toISOString();
            const mention = !item.isSystem
              ? findMention(
                  item.content,
                  current.currentProfile.name,
                  current.servers.find((server) => server.id === item.buffer.serverId)?.highlightKeywords || [],
                )
              : ({ matched: false, source: null } as MentionMatch);
            const newMessage: Message = {
              id: `msg-${uuidv4().slice(0, 8)}`,
              content: item.content,
              fileUrl: item.fileUrl || null,
              memberId: item.member.id,
              member: item.member,
              channelId: item.buffer.id,
              deleted: false,
              isSystem: item.isSystem,
              mention,
              sourceTimestamp: now,
              createdAt: now,
              updatedAt: now,
            };
            const active = current.activeChatKey === item.buffer.key;
            if (active) {
              nextMessages[item.buffer.id] = [...(nextMessages[item.buffer.id] || []), newMessage].slice(-MAX_MESSAGES_IN_MEMORY);
            }
            const previous = nextReadStates[item.buffer.key] || emptyReadState();
            const eligible = !item.isSystem;
            const isAtBottom = current.viewportStates[item.buffer.key]?.isAtBottom === true;
            const isFocused = isWindowFocused();
            // Google: IsAtBottom && Focused && Active -> LastAck = Nowa, divider null (auto-odczyt)
            // !IsAtBottom -> ViewDivider bez zmian (stabilny snapshot)
            // IsAtBottom && !Focused -> traktuj jak !IsAtBottom (wstaw divider)
            let nextFirstUnread = previous.firstUnread;
            let nextUnread = previous.unreadCount;
            let nextMentions = previous.mentionCount;
            let nextLastReadTs: string | null = previous.lastReadTimestamp;
            let nextLastReadId: string | undefined = previous.lastReadMessageId;
            if (eligible) {
              if (active && isAtBottom && isFocused) {
                // Auto-odczyt
                nextLastReadTs = now;
                nextLastReadId = newMessage.id;
                nextFirstUnread = null;
                nextUnread = 0;
                nextMentions = 0;
              } else {
                // Tło lub przewinięte lub brak focusu – stabilny divider
                if (!previous.firstUnread) nextFirstUnread = getMessageAnchor(newMessage);
                nextUnread = previous.unreadCount + 1;
                if (mention.matched) nextMentions = previous.mentionCount + 1;
              }
            }
            nextReadStates[item.buffer.key] = {
              ...previous,
              initialized: true,
              latestMessageTimestamp: now,
              latestMessageId: newMessage.id,
              unreadCount: nextUnread,
              mentionCount: nextMentions,
              firstUnread: nextFirstUnread,
              lastReadTimestamp: nextLastReadTs,
              lastReadMessageId: nextLastReadId,
            };
            nextSequences[item.buffer.key] = (nextSequences[item.buffer.key] || 0) + 1;
          });

          return {
            messages: nextMessages,
            readStates: nextReadStates,
            messageSequences: nextSequences,
          };
        });
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

      openConversation: (serverId, memberId) => {
        set((state) => {
          const server = state.servers.find((s) => s.id === serverId);
          if (server) {
            const currentProfile = state.currentProfile;
            const currentMember = server.members.find(
              (m) =>
                m.profileId === currentProfile.id ||
                m.profile?.id === currentProfile.id ||
                (server.nicknames && server.nicknames.includes(m.profile?.name)) ||
                m.id.startsWith("member-")
            );
            if (currentMember && currentMember.id === memberId) {
              return state;
            }
          }

          const current = state.activeConversations[serverId] || [];
          if (current.includes(memberId)) return state;
          return {
            activeConversations: {
              ...state.activeConversations,
              [serverId]: [...current, memberId],
            },
          };
        });
      },

      closeConversation: (serverId, memberId) => {
        set((state) => {
          const current = state.activeConversations[serverId] || [];
          return {
            activeConversations: {
              ...state.activeConversations,
              [serverId]: current.filter((id) => id !== memberId),
            },
          };
        });
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

set((state) => {
          const serverId = member.serverId;
          const currentConvs = serverId ? state.activeConversations[serverId] || [] : [];
          const updatedConvs = serverId && !currentConvs.includes(member.id)
            ? [...currentConvs, member.id]
            : currentConvs;

          return {
            ...(state.activeChatKey === chatKey(serverId || "", "conversation", conversationId)
              ? {
                  directMessages: {
                    [conversationId]: [...(state.directMessages[conversationId] || []), newDm].slice(-MAX_MESSAGES_IN_MEMORY),
                  },
                }
              : {}),
            ...(serverId
              ? {
                  activeConversations: {
                    ...state.activeConversations,
                    [serverId]: updatedConvs,
                  },
                }
              : {}),
          };
        });

        const serverId = member.serverId || "";
        const bufferKey = getBufferKey(serverId, "conversation", conversationId);
        const now = newDm.createdAt;
        set((state) => {
          const previous = state.readStates[bufferKey] || emptyReadState();
          return {
            readStates: {
              ...state.readStates,
              [bufferKey]: {
                ...previous,
                initialized: true,
                latestMessageTimestamp: now,
                latestMessageId: newDm.id,
              },
            },
            messageSequences: {
              ...state.messageSequences,
              [bufferKey]: (state.messageSequences[bufferKey] || 0) + 1,
            },
          };
        });

        return newDm;
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
      version: 5,
      partialize: (state) => ({
        ...state,
        messages: {},
        directMessages: {},
        activeChatKey: null,
        readStates: state.readStates,
        viewportStates: {},
        messageSequences: {},
        historyLoadToken: 0,
        historyNextOffset: null,
        historyHasMore: false,
        servers: state.servers.map((s) => ({
          ...s,
          channels: s.channels.filter((c) => !c.isTemporary),
        })),
      }),
      migrate: (persistedState: any) => {
        if (!persistedState || !Array.isArray(persistedState.servers)) {
          return {
            servers: [],
            messages: {},
            directMessages: {},
            activeChatKey: null,
            readStates: {},
            viewportStates: {},
            messageSequences: {},
            historyLoadToken: 0,
            historyNextOffset: null,
            historyHasMore: false,
          };
        }
        const currentProfileId = persistedState.currentProfile?.id || MOCK_PROFILE.id;

        const sanitizedServers = persistedState.servers.map((s: any) => {
          const nicks = s.nicknames || (s.nickname ? [s.nickname] : ["ReactUser"]);
          const primaryNick = nicks[0] || "ReactUser";

          const members = (Array.isArray(s.members) ? s.members : []).map((m: any) => {
            if (m.profileId === currentProfileId || m.id?.startsWith("member-")) {
              return {
                ...m,
                profile: {
                  ...m.profile,
                  name: primaryNick,
                },
              };
            }
            return m;
          });

          return {
            ...s,
            host: s.host || "127.0.0.1",
            port: s.port || 6667,
            nicknames: nicks,
            channels: Array.isArray(s.channels) ? s.channels : [],
            members,
            useTls: s.useTls ?? false,
            autoJoinChannels: Array.isArray(s.autoJoinChannels) ? s.autoJoinChannels : ["general", "test"],
          };
        });
        return {
          ...persistedState,
          servers: sanitizedServers,
          messages: {},
          directMessages: {},
          activeChatKey: null,
          readStates: persistedState.readStates || {},
          viewportStates: {},
          messageSequences: {},
          historyLoadToken: 0,
          historyNextOffset: null,
          historyHasMore: false,
        };
      }
    }
  )
);
