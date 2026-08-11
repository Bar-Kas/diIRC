import { useParams, useNavigate } from "react-router-dom";
import { useMockStore } from "@/lib/mock-store";
import { ChannelType, MemberRole } from "@/types";
import { ChatHeader } from "@/components/chat/chat-header";
import { ChatInput } from "@/components/chat/chat-input";
import { ChatMessages } from "@/components/chat/chat-messages";
import { MediaRoom } from "@/components/media-room";

export const ChannelPage = () => {
  const { serverId, channelId } = useParams();
  const navigate = useNavigate();
  const servers = useMockStore((state) => state.servers);
  const currentProfile = useMockStore((state) => state.currentProfile);

  const server = servers.find((s) => s.id === serverId) || servers[0];
  const channel = server?.channels.find((c) => c.id === channelId);

  if (!server || !channel) {
    return null;
  }

  const currentMember = server.members.find((m) => m.profileId === currentProfile.id) || {
    id: `member-current-${server.id}`,
    role: MemberRole.ADMIN,
    profileId: currentProfile.id,
    profile: currentProfile,
    serverId: server.id,
  };

  return (
    <div className="bg-white dark:bg-[#313338] flex flex-col h-full">
      <ChatHeader
        name={channel.name}
        serverId={server.id}
        type="channel"
      />
      {channel.type === ChannelType.TEXT && (
        <>
          <ChatMessages
            member={currentMember}
            name={channel.name}
            chatId={channel.id}
            type="channel"
            apiUrl="/api/messages"
            socketUrl="/api/socket/messages"
            socketQuery={{
              channelId: channel.id,
              serverId: channel.serverId,
            }}
            paramKey="channelId"
            paramValue={channel.id}
          />
          <ChatInput
            name={channel.name}
            type="channel"
            apiUrl="/api/socket/messages"
            query={{
              channelId: channel.id,
              serverId: channel.serverId,
            }}
          />
        </>
      )}
      {channel.type === ChannelType.AUDIO && (
        <MediaRoom
          chatId={channel.id}
          video={false}
          audio={true}
        />
      )}
      {channel.type === ChannelType.VIDEO && (
        <MediaRoom
          chatId={channel.id}
          video={true}
          audio={true}
        />
      )}
    </div>
  );
};
