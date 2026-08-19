import { useParams, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useMockStore } from "@/lib/mock-store";
import { useUIStore } from "@/hooks/use-ui-store";
import { ChatHeader } from "@/components/chat/chat-header";
import { ChatInput } from "@/components/chat/chat-input";
import { ChatMessages } from "@/components/chat/chat-messages";
import { ChatMembersSidebar } from "@/components/chat/chat-members-sidebar";

export const ConversationPage = () => {
  const { serverId, memberId } = useParams();
  const navigate = useNavigate();
  const servers = useMockStore((state) => state.servers);
  const currentProfile = useMockStore((state) => state.currentProfile);
  const showMembersSidebar = useUIStore((state) => state.showMembersSidebar);

  const server = servers.find((s) => s.id === serverId);
  const targetMember = server?.members.find((m) => m.id === memberId);

  useEffect(() => {
    if (serverId && memberId) {
      useMockStore.getState().openConversation(serverId, memberId);
    }
  }, [serverId, memberId]);

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

  return (
    <div className="bg-white dark:bg-[#313338] flex flex-col h-full">
      <ChatHeader
        imageUrl={targetMember.profile.imageUrl}
        name={targetMember.profile.name}
        serverId={server.id}
        type="conversation"
      />
      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-col flex-1 h-full min-w-0">
          <ChatMessages
            member={currentMember}
            name={targetMember.profile.name}
            chatId={conversationId}
            serverId={server.id}
            type="conversation"
            paramKey="conversationId"
            paramValue={conversationId}
          />
          <ChatInput
            name={targetMember.profile.name}
            type="conversation"
            query={{
              conversationId,
              serverId: server.id,
            }}
          />
        </div>
        {showMembersSidebar && <ChatMembersSidebar server={server} />}
      </div>
    </div>
  );
};
