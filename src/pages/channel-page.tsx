import { useParams, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useMockStore } from "@/lib/mock-store";
import { useUIStore } from "@/hooks/use-ui-store";
import { ChannelType } from "@/types";
import { ChatHeader } from "@/components/chat/chat-header";
import { ChatInput } from "@/components/chat/chat-input";
import { ChatMessages } from "@/components/chat/chat-messages";
import { MediaRoom } from "@/components/media-room";
import { ChatMembersSidebar } from "@/components/chat/chat-members-sidebar";

export const ChannelPage = () => {
  const { serverId, channelId } = useParams();
  const navigate = useNavigate();
  const servers = useMockStore((state) => state.servers);
  const currentProfile = useMockStore((state) => state.currentProfile);
  const showMembersSidebar = useUIStore((state) => state.showMembersSidebar);

  const server = servers.find((s) => s.id === serverId);
  const channel = server?.channels.find((c) => c.id === channelId);

  useEffect(() => {
    if (!server && servers.length > 0) {
      navigate(`/servers/${servers[0].id}`, { replace: true });
    } else if (server && !channel) {
      navigate(`/servers/${server.id}`, { replace: true });
    }
  }, [server, channel, servers, navigate]);

  if (!server || !channel) {
    return null;
  }

  const currentMember = server.members.find((m) => m.profileId === currentProfile.id) || server.members[0];

  return (
    <div className="bg-white dark:bg-[#313338] flex flex-col h-full">
      <ChatHeader
        name={channel.name}
        serverId={server.id}
        type="channel"
      />
      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-col flex-1 h-full min-w-0">
          {channel.type === ChannelType.TEXT && (
            <>
              <ChatMessages
                member={currentMember}
                name={channel.name}
                chatId={channel.id}
                type="channel"
                paramKey="channelId"
                paramValue={channel.id}
              />
              <ChatInput
                name={channel.name}
                type="channel"
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
        {showMembersSidebar && <ChatMembersSidebar server={server} />}
      </div>
    </div>
  );
};
