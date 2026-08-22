import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useRef } from "react";
import { useMockStore } from "@/lib/mock-store";
import { useUIStore } from "@/hooks/use-ui-store";
import { ChatHeader } from "@/components/chat/chat-header";
import { ChatInput } from "@/components/chat/chat-input";
import { ChatMessages } from "@/components/chat/chat-messages";
import { ChatMembersSidebar } from "@/components/chat/chat-members-sidebar";
import { getMemberDisplayName } from "@/components/user-hover-card";

export const ConversationPage = () => {
  const { serverId, memberId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const servers = useMockStore((state) => state.servers);
  const currentProfile = useMockStore((state) => state.currentProfile);
  const showMembersSidebar = useUIStore((state) => state.showMembersSidebar);
  const setMembersSidebar = useUIStore((state) => state.setMembersSidebar);

  const server = servers.find((s) => s.id === serverId);
  const targetMember = server?.members.find((m) => m.id === memberId);

  const prevPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (serverId && memberId) {
      useMockStore.getState().openConversation(serverId, memberId);
      
      const wasInConversation = prevPathRef.current?.includes("/conversations/");
      if (!wasInConversation) {
        setMembersSidebar(false);
      }
    }
    prevPathRef.current = location.pathname;
  }, [serverId, memberId, location.pathname, setMembersSidebar]);

  useEffect(() => {
    if (!server && servers.length > 0) {
      navigate(`/servers/${servers[0].id}`, { replace: true });
    }
  }, [server, servers, navigate]);

  if (!server || !targetMember) {
    return null;
  }

  const currentMember =
    server.members.find(
      (m) =>
        m.profileId === currentProfile.id ||
        m.profile?.id === currentProfile.id ||
        (server.nicknames && server.nicknames.includes(m.profile?.name)) ||
        m.id.startsWith("member-")
    ) || server.members[0];
  const conversationId = [currentMember.id, targetMember.id].sort().join("-");
  const displayName = getMemberDisplayName(targetMember, server);

  return (
    <div className="bg-white dark:bg-[#313338] flex flex-col h-full">
      <ChatHeader
        imageUrl={targetMember.profile.imageUrl}
        name={displayName}
        serverId={server.id}
        type="conversation"
        targetMember={targetMember}
        server={server}
      />
      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-col flex-1 h-full min-w-0">
          <ChatMessages
            member={currentMember}
            name={displayName}
            chatId={conversationId}
            serverId={server.id}
            type="conversation"
            paramKey="conversationId"
            paramValue={conversationId}
          />
          <ChatInput
            name={displayName}
            type="conversation"
            query={{
              conversationId,
              serverId: server.id,
              targetMemberId: targetMember.id,
            }}
          />
        </div>
        <ChatMembersSidebar server={server} />
      </div>
    </div>
  );
};
