import { useParams, useSearchParams } from "react-router-dom";
import { useMockStore } from "@/lib/mock-store";
import { MemberRole } from "@/types";
import { ChatHeader } from "@/components/chat/chat-header";
import { ChatInput } from "@/components/chat/chat-input";
import { ChatMessages } from "@/components/chat/chat-messages";
import { MediaRoom } from "@/components/media-room";

export const ConversationPage = () => {
  const { serverId, memberId } = useParams();
  const [searchParams] = useSearchParams();
  const servers = useMockStore((state) => state.servers);
  const currentProfile = useMockStore((state) => state.currentProfile);

  const server = servers.find((s) => s.id === serverId) || servers[0];
  const targetMember = server?.members.find((m) => m.id === memberId);

  if (!server || !targetMember) {
    return null;
  }

  const currentMember = server.members.find((m) => m.profileId === currentProfile.id) || {
    id: `member-current-${server.id}`,
    role: MemberRole.ADMIN,
    profileId: currentProfile.id,
    profile: currentProfile,
    serverId: server.id,
  };

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
            }}
          />
        </>
      )}
    </div>
  );
};
