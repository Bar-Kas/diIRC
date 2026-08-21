import { useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useMockStore } from "@/lib/mock-store";
import { useModalStore } from "@/hooks/use-modal-store";
import { Server, ChannelType } from "@/types";
import { extractFlag } from "@/lib/flag-tips";

interface IrcMessagePayload {
  serverId?: string;
  server_id?: string;
  sender: string;
  content: string;
  channel: string;
  isSystem?: boolean;
  is_system?: boolean;
}

interface IrcUserEventPayload {
  server_id: string;
  channel: string;
  users: string[];
  event_type: string;
}

export const IrcProvider = ({ children }: { children: React.ReactNode }) => {
  const addMessage = useMockStore((state) => state.addMessage);
  const currentProfile = useMockStore((state) => state.currentProfile);
  const servers = useMockStore((state) => state.servers);
  const addServerMember = useMockStore((state) => state.addServerMember);
  const removeServerMember = useMockStore((state) => state.removeServerMember);
  const updateChannelMembers = useMockStore((state) => state.updateChannelMembers);
  const setIrcConnected = useMockStore((state) => state.setIrcConnected);
  const navigate = useNavigate();
  const connectedConfigsRef = useRef<Map<string, string>>(new Map());
  const connectingRef = useRef<Set<string>>(new Set());
  const attemptsRef = useRef<Map<string, number>>(new Map());
  const nextReconnectTimeRef = useRef<Map<string, number>>(new Map());

  const attemptConnect = useCallback(async (server: Server) => {
    if (connectingRef.current.has(server.id)) return;
    connectingRef.current.add(server.id);

    const nicks = server.nicknames && server.nicknames.length > 0 
      ? server.nicknames 
      : [server.nicknames?.[0] || currentProfile.name.replace(/\s+/g, "") || "ReactUser"];
    const channels = server.channels.map((c) => c.key ? `${c.name} ${c.key}` : c.name);

    try {
      await invoke("connect_irc", {
        params: {
          serverId: server.id,
          host: server.host || "127.0.0.1",
          port: server.port || 6667,
          nicknames: nicks,
          realname: server.realname || "",
          password: server.password || "",
          channels: server.channels.map(c => ({
            name: c.name,
            password: c.key || null
          })),
          useTls: server.useTls || false,
        }
      });
      console.log(`Initiated IRC connection for server ${server.name} (${server.id}) with nicks:`, nicks);
    } catch (error) {
      console.error(`Failed to connect IRC for server ${server.name}:`, error);
      const errMsg = error instanceof Error ? error.message : String(error);
      setIrcConnected(server.id, false, errMsg);
    } finally {
      connectingRef.current.delete(server.id);
    }
  }, [currentProfile.name, setIrcConnected]);

  // Connect / Reconnect servers to IRC when server configs or list change
  useEffect(() => {
    const currentServerIds = new Set(servers.map((s) => s.id));

    // Cleanup disconnected servers
    connectedConfigsRef.current.forEach(async (_, serverId) => {
      if (!currentServerIds.has(serverId)) {
        connectedConfigsRef.current.delete(serverId);
        setIrcConnected(serverId, false);
        try {
          await invoke("disconnect_irc", { serverId });
        } catch (e) {
          console.error(`Failed to disconnect removed server ${serverId}:`, e);
        }
      }
    });

    servers.forEach(async (server) => {
      // Respect autoConnect setting on startup/config load
      if (server.autoConnect === false) return;

      const nicks = server.nicknames && server.nicknames.length > 0 
        ? server.nicknames 
        : [server.nicknames?.[0] || currentProfile.name.replace(/\s+/g, "") || "ReactUser"];

      const configHash = JSON.stringify({
        host: server.host || "127.0.0.1",
        port: server.port || 6667,
        nicks,
        realname: server.realname || "",
        password: server.password || "",
        useTls: server.useTls || false,
      });

      const prevHash = connectedConfigsRef.current.get(server.id);

      // If configuration hasn't changed, skip
      if (prevHash === configHash) return;

      // Update stored hash
      connectedConfigsRef.current.set(server.id, configHash);

      if (prevHash) {
        console.log(`Config changed for IRC server ${server.name} (${server.id}), reconnecting...`);
        try {
          await invoke("disconnect_irc", { serverId: server.id });
        } catch (e) {
          console.error(`Failed to disconnect before reconnecting:`, e);
        }
        await new Promise((res) => setTimeout(res, 400));
      }

      await attemptConnect(server);
    });
  }, [servers, attemptConnect, setIrcConnected]);

  // Track which servers have been synced
  const syncedServersRef = useRef<Set<string>>(new Set());

  // Sync active Conversations with non-empty log files on disk
  useEffect(() => {
    servers.forEach(async (server) => {
      if (syncedServersRef.current.has(server.id)) return;
      syncedServersRef.current.add(server.id);
      
      try {
        const loggedNicks = await invoke<string[]>("list_logged_conversations", {
          serverId: server.id,
        });
        useMockStore.getState().syncActiveConversationsWithDisk(server.id, loggedNicks);
      } catch (err) {
        console.error(`Failed to sync conversations with disk for ${server.name}:`, err);
        // If it fails, allow it to retry later by removing from the set
        syncedServersRef.current.delete(server.id);
      }
    });
  }, [servers]);

  // Auto-reconnect loop with exponential backoff & error throttling for disconnected servers
  useEffect(() => {
    const interval = setInterval(() => {
      const { ircConnectedServers, ircConnectionErrors, servers: currentServers } = useMockStore.getState();
      const now = Date.now();

      currentServers.forEach((server) => {
        // Skip if server auto-reconnect is disabled
        if (server.autoReconnect === false) return;

        // Skip if already connected or currently connecting
        if (ircConnectedServers[server.id] || connectingRef.current.has(server.id)) {
          attemptsRef.current.delete(server.id);
          nextReconnectTimeRef.current.delete(server.id);
          return;
        }

        // Check if server is blocked by rate-limiting
        const activeErr = ircConnectionErrors[server.id];
        if (activeErr && (activeErr.toLowerCase().includes("too many times") || activeErr.toLowerCase().includes("rate limit"))) {
          return;
        }

        // Backoff cooldown check
        const nextTime = nextReconnectTimeRef.current.get(server.id) || 0;
        if (now < nextTime) return;

        const currentAttempts = attemptsRef.current.get(server.id) || 0;
        // Exponential backoff: 15s, 30s, 60s, 120s, max 300s (5 min)
        const backoffMs = Math.min(15000 * Math.pow(2, currentAttempts), 300000);

        attemptsRef.current.set(server.id, currentAttempts + 1);
        nextReconnectTimeRef.current.set(server.id, now + backoffMs);

        console.log(`Auto-reconnecting to IRC server ${server.name} (attempt ${currentAttempts + 1}, backoff ${backoffMs / 1000}s)...`);
        attemptConnect(server);
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [attemptConnect]);

  // Listen for incoming messages across all connected IRC servers
  useEffect(() => {
    let isCancelled = false;
    let unlistenFn: (() => void) | null = null;

    const setupListener = async () => {
      try {
        const unlisten = await listen<IrcMessagePayload>("irc_message", (event) => {
          const { sender, content, channel } = event.payload;
          const serverId = event.payload.serverId || event.payload.server_id;
          const isSystem = event.payload.isSystem ?? event.payload.is_system;

          if (!serverId) return;

          const activeServers = useMockStore.getState().servers;
          const targetServer = activeServers.find((s) => s.id === serverId) || activeServers[0];
          
          if (!targetServer) return;

          const isChannelMsg = channel.startsWith("#") || channel.startsWith("&");

          if (!isChannelMsg) {
            // Private Message (PM)
            const store = useMockStore.getState();
            if (isSystem || sender === "System") {
              const targetNick = channel;
              const targetMember = store.addServerMember(targetServer.id, targetNick);
              const currentMember = targetServer.members.find(
                (m) => m.profileId === store.currentProfile.id
              ) || targetServer.members[0];

              if (targetMember && currentMember) {
                const conversationId = [currentMember.id, targetMember.id].sort().join("-");
                const systemMember = {
                  id: "system",
                  profileId: "system",
                  profile: {
                    id: "system",
                    userId: "system",
                    name: "System",
                    imageUrl: "",
                    email: "system@irc.local",
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  },
                  serverId: targetServer.id,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                };
                store.addDirectMessage(conversationId, systemMember as any, content, null);
                store.openConversation(targetServer.id, targetMember.id);
                store.addToHistoricalConversations(targetServer.id, targetMember.id);
              }
              return;
            }

            let senderMember = store.addServerMember(targetServer.id, sender);

            const currentMember = targetServer.members.find(
              (m) => m.profileId === store.currentProfile.id
            ) || targetServer.members[0];

            if (senderMember && currentMember) {
              const conversationId = [currentMember.id, senderMember.id].sort().join("-");
              store.addDirectMessage(conversationId, senderMember, content, null);
              store.openConversation(targetServer.id, senderMember.id);
              store.addToHistoricalConversations(targetServer.id, senderMember.id);
            }
            return;
          }

          const cleanName = channel.replace(/^#/, "").toLowerCase();
          const targetChannel = targetServer.channels.find(
            (c) => c.name.toLowerCase() === cleanName
          );

          const mockMember = {
            id: `irc-${sender}`,
            profileId: `profile-${sender}`,
            profile: {
              id: `profile-${sender}`,
              userId: `user-${sender}`,
              name: sender,
              imageUrl: "",
              email: `${sender}@irc.local`,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            serverId: targetServer.id,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          if (targetChannel) {
            addMessage(targetChannel.id, mockMember as any, content, null, isSystem);
          } else if (targetServer.channels.length > 0) {
            addMessage(targetServer.channels[0].id, mockMember as any, content, null, isSystem);
          }
        });

        if (isCancelled) {
          unlisten();
        } else {
          unlistenFn = unlisten;
        }
      } catch (error) {
        console.error("Failed to setup IRC listener:", error);
      }
    };

    setupListener();

    let unlistenUsersFn: (() => void) | null = null;
    const setupUsersListener = async () => {
      try {
        const unlistenUsers = await listen<IrcUserEventPayload>("irc_user_event", (event) => {
          const { server_id, channel, users, event_type } = event.payload;
          updateChannelMembers(server_id, channel, users, event_type as any);

          if (event_type === "JOIN") {
            const store = useMockStore.getState();
            const pending = store.pendingJoin;
            const cleanChan = channel.replace(/^#/, "");

            if (
              pending &&
              pending.serverId === server_id &&
              pending.channelName.toLowerCase() === cleanChan.toLowerCase()
            ) {
              const activeServer = store.servers.find(s => s.id === server_id);
              const existing = activeServer?.channels.find(c => c.name.toLowerCase() === cleanChan.toLowerCase());
              
              if (!existing) {
                const newChan = store.addChannel(server_id, cleanChan, ChannelType.TEXT);
                if (pending.password) {
                  store.updateChannelKey(server_id, newChan.id, pending.password);
                }
                store.setPendingJoin(null, null);
                if (newChan?.id) {
                  navigate(`/servers/${server_id}/channels/${newChan.id}`);
                }
              } else {
                if (pending.password) {
                  store.updateChannelKey(server_id, existing.id, pending.password);
                }
                store.setPendingJoin(null, null);
                navigate(`/servers/${server_id}/channels/${existing.id}`);
              }
            }
          }
        });

        if (isCancelled) {
          unlistenUsers();
        } else {
          unlistenUsersFn = unlistenUsers;
        }
      } catch (error) {
        console.error("Failed to setup IRC users listener:", error);
      }
    };

    setupUsersListener();

    let unlistenStatusFn: (() => void) | null = null;
    const setupStatusListener = async () => {
      try {
        const unlistenStatus = await listen<{ server_id: string; connected: boolean; error?: string }>(
          "irc_status",
          (event) => {
            const { server_id, connected, error } = event.payload;
            setIrcConnected(server_id, connected, error || null);
            if (connected) {
              attemptsRef.current.delete(server_id);
              nextReconnectTimeRef.current.delete(server_id);
            } else {
              connectedConfigsRef.current.delete(server_id);
            }
          }
        );

        if (isCancelled) {
          unlistenStatus();
        } else {
          unlistenStatusFn = unlistenStatus;
        }
      } catch (error) {
        console.error("Failed to setup IRC status listener:", error);
      }
    };

    setupStatusListener();

    let unlistenTopicFn: (() => void) | null = null;
    const setupTopicListener = async () => {
      try {
        const unlistenTopic = await listen<{ server_id: string; channel: string; topic: string }>(
          "irc_topic_event",
          (event) => {
            const { server_id, channel, topic } = event.payload;
            useMockStore.getState().updateChannelTopicByName(server_id, channel, topic);
          }
        );

        if (isCancelled) {
          unlistenTopic();
        } else {
          unlistenTopicFn = unlistenTopic;
        }
      } catch (error) {
        console.error("Failed to setup IRC topic listener:", error);
      }
    };

    setupTopicListener();

    let unlistenOpsFn: (() => void) | null = null;
    const setupOpsListener = async () => {
      try {
        const unlistenOps = await listen<{ server_id: string; channel: string; ops: string[] }>(
          "irc_ops_event",
          (event) => {
            const { server_id, channel, ops } = event.payload;
            useMockStore.getState().updateChannelOps(server_id, channel, ops);
          }
        );

        if (isCancelled) {
          unlistenOps();
        } else {
          unlistenOpsFn = unlistenOps;
        }
      } catch (error) {
        console.error("Failed to setup IRC ops listener:", error);
      }
    };

    setupOpsListener();

    let unlistenTopicErrorFn: (() => void) | null = null;
    const setupTopicErrorListener = async () => {
      try {
        const unlistenTopicError = await listen<{ server_id: string; channel: string; error: string }>(
          "irc_topic_error",
          (event) => {
            const { server_id, channel, error } = event.payload;
            const chanName = channel ? `#${channel.replace(/^#/, "")}` : "this channel";

            if (server_id && channel) {
              invoke("refresh_channel_names", { serverId: server_id, channel }).catch(() => {});
            }

            useModalStore.getState().onOpen("ircError", {
              title: "Permission Denied",
              description: `Cannot perform operation on ${chanName}: ${error || "You do not have channel operator (@) permissions."}`,
            });
          }
        );

        if (isCancelled) {
          unlistenTopicError();
        } else {
          unlistenTopicErrorFn = unlistenTopicError;
        }
      } catch (error) {
        console.error("Failed to setup IRC topic error listener:", error);
      }
    };

    setupTopicErrorListener();

    let unlistenBadKeyFn: (() => void) | null = null;
    const setupBadKeyListener = async () => {
      try {
        const unlistenBadKey = await listen<{ server_id: string; channel: string; error: string }>(
          "irc_bad_channel_key",
          (event) => {
            const { server_id, channel, error } = event.payload;
            const cleanChan = channel.replace(/^#/, "");

            // We purposefully do NOT delete the channel here, because if they had it
            // in their sidebar, we don't want to wipe their history just because the key was wrong or changed.
            
            const store = useMockStore.getState();
            const pending = store.pendingJoin;
            let isWrongPassword = false;
            if (pending && pending.serverId === server_id && pending.channelName.toLowerCase() === cleanChan.toLowerCase()) {
              isWrongPassword = !!pending.password;
              store.setPendingJoin(null, null);
            }

            useModalStore.getState().onOpen("joinChannelPassword", {
              serverId: server_id,
              channelName: cleanChan,
              errorMessage: isWrongPassword ? "Incorrect password." : (error || "Cannot join channel (+k): Password required."),
            });
          }
        );

        if (isCancelled) {
          unlistenBadKey();
        } else {
          unlistenBadKeyFn = unlistenBadKey;
        }
      } catch (error) {
        console.error("Failed to setup IRC bad channel key listener:", error);
      }
    };

    setupBadKeyListener();

    let unlistenInviteOnlyFn: (() => void) | null = null;
    const setupInviteOnlyListener = async () => {
      try {
        const unlistenInviteOnly = await listen<{ server_id: string; channel: string; error: string }>(
          "irc_invite_only",
          (event) => {
            const { server_id, channel, error } = event.payload;
            const cleanChan = channel.replace(/^#/, "");
            const formattedChan = channel.startsWith("#") || channel.startsWith("&") ? channel : `#${channel}`;

            const store = useMockStore.getState();
            store.setChannelTemporary(server_id, cleanChan, true);

            const pending = store.pendingJoin;
            if (
              pending &&
              pending.serverId === server_id &&
              pending.channelName.toLowerCase() === cleanChan.toLowerCase()
            ) {
              store.setPendingJoin(null, null);
            }

            useModalStore.getState().onOpen("ircError", {
              title: "Cannot join channel",
              description: `Cannot join ${formattedChan}: ${error || "Cannot join channel (+i)"}.`,
            });
          }
        );

        if (isCancelled) {
          unlistenInviteOnly();
        } else {
          unlistenInviteOnlyFn = unlistenInviteOnly;
        }
      } catch (error) {
        console.error("Failed to setup IRC invite-only listener:", error);
      }
    };

    let unlistenInvitedFn: (() => void) | null = null;
    const setupInvitedListener = async () => {
      try {
        const unlistenInvited = await listen<{ server_id: string; channel: string; inviter: string }>(
          "irc_invited",
          (event) => {
            const { server_id, channel, inviter } = event.payload;
            useMockStore.getState().addPendingInvite(server_id, channel, inviter);
          }
        );

        if (isCancelled) {
          unlistenInvited();
        } else {
          unlistenInvitedFn = unlistenInvited;
        }
      } catch (error) {
        console.error("Failed to setup IRC invited listener:", error);
      }
    };

    setupInvitedListener();

    let unlistenModeFn: (() => void) | null = null;
    const setupModeListener = async () => {
      try {
        const unlistenMode = await listen<{ server_id: string; channel: string; modes: string; set_by?: string; is_full_listing?: boolean }>(
          "irc_mode_event",
          (event) => {
            const { server_id, channel, modes, is_full_listing } = event.payload;
            useMockStore.getState().updateChannelModes(server_id, channel, modes, is_full_listing);
          }
        );

        if (isCancelled) {
          unlistenMode();
        } else {
          unlistenModeFn = unlistenMode;
        }
      } catch (error) {
        console.error("Failed to setup IRC mode listener:", error);
      }
    };

    setupModeListener();

    let unlistenModeErrorFn: (() => void) | null = null;
    const setupModeErrorListener = async () => {
      try {
        const unlistenModeError = await listen<{ server_id: string; channel: string; error: string }>(
          "irc_mode_error",
          (event) => {
            const { server_id, channel, error } = event.payload;
            const chanName = channel ? (channel.startsWith("#") || channel.startsWith("&") ? channel : `#${channel}`) : "this channel";

            if (server_id && channel) {
              const chanTarget = channel.startsWith("#") || channel.startsWith("&") ? channel : `#${channel}`;
              invoke("send_mode", {
                serverId: server_id,
                target: chanTarget,
                mode: null,
                params: null,
              }).catch(() => {});
            }

            const extractedFlag = extractFlag(error);
            useModalStore.getState().onOpen("ircError", {
              title: "Channel mode error",
              description: `Cannot set mode on ${chanName}: ${error || "Server does not support this mode flag or permission was denied."}`,
              flag: extractedFlag || undefined,
            });
          }
        );

        if (isCancelled) {
          unlistenModeError();
        } else {
          unlistenModeErrorFn = unlistenModeError;
        }
      } catch (error) {
        console.error("Failed to setup IRC mode error listener:", error);
      }
    };

    setupModeErrorListener();

    return () => {
      isCancelled = true;
      if (unlistenFn) {
        unlistenFn();
      }
      if (unlistenUsersFn) {
        unlistenUsersFn();
      }
      if (unlistenStatusFn) {
        unlistenStatusFn();
      }
      if (unlistenTopicFn) {
        unlistenTopicFn();
      }
      if (unlistenOpsFn) {
        unlistenOpsFn();
      }
      if (unlistenTopicErrorFn) {
        unlistenTopicErrorFn();
      }
      if (unlistenBadKeyFn) {
        unlistenBadKeyFn();
      }
      if (unlistenInviteOnlyFn) {
        unlistenInviteOnlyFn();
      }
      if (unlistenInvitedFn) {
        unlistenInvitedFn();
      }
      if (unlistenModeFn) {
        unlistenModeFn();
      }
      if (unlistenModeErrorFn) {
        unlistenModeErrorFn();
      }
    };
  }, [addMessage, addServerMember, removeServerMember, setIrcConnected]);

  return <>{children}</>;
};
