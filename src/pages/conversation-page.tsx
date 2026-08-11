import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useMockStore } from "@/lib/mock-store";
import { ChatHeader } from "@/components/chat/chat-header";
import { ChatInput } from "@/components/chat/chat-input";
import { ChatMessages } from "@/components/chat/chat-messages";
import { MediaRoom } from "@/components/media-room";

export const ConversationPage = () => {
  const { serverId, memberId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const servers = useMockStore((state) => state.servers);
  const currentProfile = useMockStore((state) => state.currentProfile);

  const server = servers.find((s) => s.id === serverId);
  const targetMember = server?.members.find((m) => m.id === memberId);

  useEffect(() => {
    if (!server && servers.length > 0) {
      navigate(`/servers/${servers[0].id}`, { replace: true });
    }
  }, [server, servers, navigate]);

  if (!server || !targetMember) {
    return null;
  }

  const currentMember = server.members.find((m) => m.profileId === currentProfile.id) || server.members[0];
  const conversationId = [currentMember.id, targetMember.id].sort().join("-");
  const isVideo = searchParams.get("video") === "true";

  return (
    <div className="bg-white dark:bg-[#313338] flex flex-col h-full">
      <ChatHeader
        imageUrl={targetMember.profile.imageUrl}
        name={targetMember.profile.name}
        serverId={server.id}
        type="conversation"
      />
      {isVideo ? (
        <MediaRoom
          chatId={conversationId}
          video={true}
          audio={true}
        />
      ) : (
        <>
          <ChatMessages
            member={currentMember}
            name={targetMember.profile.name}
            chatId={conversationId}
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
        </>
      )}
    </div>
  );
};
