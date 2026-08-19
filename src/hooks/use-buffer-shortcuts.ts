import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMockStore } from "@/lib/mock-store";
import { getBufferKey } from "@/lib/chat-buffer";

export const useBufferShortcuts = () => {
  const navigate = useNavigate();
  const activeChatKey = useMockStore((state) => state.activeChatKey);
  const servers = useMockStore((state) => state.servers);
  const readStates = useMockStore((state) => state.readStates);
  const activeConversations = useMockStore((state) => state.activeConversations);
  const currentProfile = useMockStore((state) => state.currentProfile);
  const markBufferRead = useMockStore((state) => state.markBufferRead);

  useEffect(() => {
    const buffers = servers.flatMap((server) => {
      const channels = server.channels.map((channel) => ({
        key: getBufferKey(server.id, "channel", channel.id),
        path: `/servers/${server.id}/channels/${channel.id}`,
      }));
      const currentMember = server.members.find((member) => member.profileId === currentProfile.id) || server.members[0];
      const conversations = (activeConversations[server.id] || [])
        .map((memberId) => {
          const member = server.members.find((item) => item.id === memberId);
          if (!member || !currentMember) return null;
          const conversationId = [currentMember.id, member.id].sort().join("-");
          return {
            key: getBufferKey(server.id, "conversation", conversationId),
            path: `/servers/${server.id}/conversations/${member.id}`,
          };
        })
        .filter((item): item is { key: string; path: string } => !!item);
      return [...channels, ...conversations];
    });

    const unreadBuffers = buffers.filter((buffer) => {
      const state = readStates[buffer.key];
      return !!state?.unreadCount || !!state?.mentionCount;
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTextEntry = target?.tagName === "INPUT"
        || target?.tagName === "TEXTAREA"
        || target?.isContentEditable;

      if (event.key === "Escape") {
        if (activeChatKey && !event.defaultPrevented) {
          markBufferRead(activeChatKey, "escape");
        }
        return;
      }

      if (
        isTextEntry
        || !event.altKey
        || !event.shiftKey
        || (event.key !== "ArrowUp" && event.key !== "ArrowDown")
        || unreadBuffers.length === 0
      ) {
        return;
      }

      event.preventDefault();
      const currentIndex = Math.max(0, unreadBuffers.findIndex((buffer) => buffer.key === activeChatKey));
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const nextIndex = (currentIndex + direction + unreadBuffers.length) % unreadBuffers.length;
      navigate(unreadBuffers[nextIndex].path);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeChatKey, activeConversations, currentProfile.id, markBufferRead, navigate, readStates, servers]);
};
