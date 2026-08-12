import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useMockStore } from "@/lib/mock-store";
import { MemberRole } from "@/types";

interface IrcMessagePayload {
  serverId: string;
  sender: string;
  content: string;
  channel: string;
  is_system?: boolean;
}

export const IrcProvider = ({ children }: { children: React.ReactNode }) => {
  const addMessage = useMockStore((state) => state.addMessage);
  const currentProfile = useMockStore((state) => state.currentProfile);
  const servers = useMockStore((state) => state.servers);
  const connectedServersRef = useRef<Set<string>>(new Set());

  // Connect servers to IRC when servers list changes
  useEffect(() => {
    servers.forEach(async (server) => {
      if (connectedServersRef.current.has(server.id)) return;
      connectedServersRef.current.add(server.id);

      try {
        const channels = server.channels.map((c) => c.name);
        await invoke("connect_irc", {
          params: {
            serverId: server.id,
            host: server.host || "127.0.0.1",
            port: server.port || 6667,
            nicknames: server.nicknames && server.nicknames.length > 0 
              ? server.nicknames 
              : [server.nicknames?.[0] || currentProfile.name.replace(/\s+/g, "") || "ReactUser"],
            realname: server.realname || "",
            password: server.password || "",
            channels: channels.length > 0 ? channels : ["test", "general"],
            useTls: server.useTls || false,
          }
        });
        console.log(`Connected IRC server ${server.name} (${server.id})`);
      } catch (error) {
        console.error(`Failed to connect IRC for server ${server.name}:`, error);
        connectedServersRef.current.delete(server.id);
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

          const cleanName = channel.replace(/^#/, "").toLowerCase();
          const targetChannel = targetServer.channels.find(
            (c) => c.name.toLowerCase() === cleanName
          );

          const mockMember = {
            id: `irc-${sender}`,
            role: MemberRole.GUEST,
            profileId: `profile-${sender}`,
            profile: {
              id: `profile-${sender}`,
              userId: `user-${sender}`,
              name: sender,
              imageUrl: "https://github.com/identicons/identicon.png",
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

    return () => {
      isCancelled = true;
      if (unlistenFn) {
        unlistenFn();
      }
    };
  }, [addMessage]);

  return <>{children}</>;
};
