import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useMockStore } from "@/lib/mock-store";

interface IrcMessagePayload {
  serverId: string;
  sender: string;
  content: string;
  channel: string;
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
  const connectedConfigsRef = useRef<Map<string, string>>(new Map());

  // Connect / Reconnect servers to IRC when server configs or list change
  useEffect(() => {
    const currentServerIds = new Set(servers.map((s) => s.id));

    // Cleanup disconnected servers
    connectedConfigsRef.current.forEach(async (_, serverId) => {
      if (!currentServerIds.has(serverId)) {
        connectedConfigsRef.current.delete(serverId);
        try {
          await invoke("disconnect_irc", { serverId });
        } catch (e) {
          console.error(`Failed to disconnect removed server ${serverId}:`, e);
        }
      }
    });

    servers.forEach(async (server) => {
      const nicks = server.nicknames && server.nicknames.length > 0 
        ? server.nicknames 
        : [server.nicknames?.[0] || currentProfile.name.replace(/\s+/g, "") || "ReactUser"];
      const channels = server.channels.map((c) => c.name);

      const configHash = JSON.stringify({
        host: server.host || "127.0.0.1",
        port: server.port || 6667,
        nicks,
        password: server.password || "",
        useTls: server.useTls || false,
        channels: channels.length > 0 ? channels : ["test", "general"],
      });

      const prevHash = connectedConfigsRef.current.get(server.id);

      // If configuration hasn't changed, skip
      if (prevHash === configHash) return;

      // Update stored hash
      connectedConfigsRef.current.set(server.id, configHash);

      try {
        if (prevHash) {
          console.log(`Config changed for IRC server ${server.name} (${server.id}), reconnecting with new nickname...`);
          try {
            await invoke("disconnect_irc", { serverId: server.id });
          } catch (e) {
            console.error(`Failed to disconnect before reconnecting:`, e);
          }
          await new Promise((res) => setTimeout(res, 400));
        }

        await invoke("connect_irc", {
          params: {
            serverId: server.id,
            host: server.host || "127.0.0.1",
            port: server.port || 6667,
            nicknames: nicks,
            realname: server.realname || "",
            password: server.password || "",
            channels: channels.length > 0 ? channels : ["test", "general"],
            useTls: server.useTls || false,
          }
        });
        console.log(`Connected IRC server ${server.name} (${server.id}) with nicks:`, nicks);
      } catch (error) {
        console.error(`Failed to connect IRC for server ${server.name}:`, error);
        connectedConfigsRef.current.delete(server.id);
      }
    });
  }, [servers, currentProfile.name]);

  // Listen for incoming messages across all connected IRC servers
  useEffect(() => {
    let isCancelled = false;
    let unlistenFn: (() => void) | null = null;

    const setupListener = async () => {
      try {
        const unlisten = await listen<IrcMessagePayload>("irc_message", (event) => {
          const { serverId, sender, content, channel, is_system } = event.payload;

          const activeServers = useMockStore.getState().servers;
          const targetServer = activeServers.find((s) => s.id === serverId) || activeServers[0];
          
          if (!targetServer) return;

          const isChannelMsg = channel.startsWith("#") || channel.startsWith("&");

          if (!isChannelMsg) {
            // Private Message (PM)
            const store = useMockStore.getState();
            let senderMember = store.addServerMember(targetServer.id, sender);

            const currentMember = targetServer.members.find(
              (m) => m.profileId === store.currentProfile.id
            ) || targetServer.members[0];

            if (senderMember && currentMember) {
              const conversationId = [currentMember.id, senderMember.id].sort().join("-");
              store.addDirectMessage(conversationId, senderMember, content, null);
              store.openConversation(targetServer.id, senderMember.id);
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
            addMessage(targetChannel.id, mockMember as any, content, null, is_system);
          } else if (targetServer.channels.length > 0) {
            addMessage(targetServer.channels[0].id, mockMember as any, content, null, is_system);
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
          const { server_id, users, event_type } = event.payload;

          if (event_type === "NAMES" || event_type === "JOIN") {
            users.forEach(u => addServerMember(server_id, u));
          } else if (event_type === "PART" || event_type === "QUIT") {
            users.forEach(u => removeServerMember(server_id, u));
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

    return () => {
      isCancelled = true;
      if (unlistenFn) {
        unlistenFn();
      }
      if (unlistenUsersFn) {
        unlistenUsersFn();
      }
    };
  }, [addMessage, addServerMember, removeServerMember]);

  return <>{children}</>;
};
