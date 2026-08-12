import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useMockStore } from "@/lib/mock-store";
import { v4 as uuidv4 } from "uuid";
import { MemberRole } from "@/types";

interface IrcMessagePayload {
  sender: string;
  content: string;
  channel: string;
}

export const IrcProvider = ({ children }: { children: React.ReactNode }) => {
  const addMessage = useMockStore((state) => state.addMessage);
  const currentProfile = useMockStore((state) => state.currentProfile);

  useEffect(() => {
    let unlisten: () => void;

    const setupIrc = async () => {
      try {
        // Connect to IRC when provider mounts
        await invoke("connect_irc", { nickname: currentProfile.name.replace(/\s+/g, "") || "ReactUser" });
        console.log("Connected to IRC");

        // Listen for incoming messages
        const unlistenFn = await listen<IrcMessagePayload>("irc_message", (event) => {
          const { sender, content, channel } = event.payload;
          
          // Map the sender to a mock member
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
            serverId: "server-1",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          const cleanName = channel.replace(/^#/, "").toLowerCase();
          const servers = useMockStore.getState().servers;
          let targetChannelId = "channel-1";

          for (const s of servers) {
            const found = s.channels.find(
              (c) => c.name.toLowerCase() === cleanName
            );
            if (found) {
              targetChannelId = found.id;
              break;
            }
          }

          addMessage(targetChannelId, mockMember as any, content);
        });
        
        unlisten = unlistenFn;
      } catch (error) {
        console.error("Failed to connect to IRC:", error);
      }
    };

    setupIrc();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [addMessage, currentProfile.name]);

  return <>{children}</>;
};
