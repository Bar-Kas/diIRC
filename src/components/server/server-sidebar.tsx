import { ChannelType } from "@/types";
import { Hash, Mic, Video } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useMockStore } from "@/lib/mock-store";
import { ServerHeader } from "./server-header";
import { ServerSearch } from "./server-search";
import { ServerSection } from "./server-section";
import { ServerChannel } from "./server-channel";

interface ServerSidebarProps {
  serverId: string;
}

const iconMap = {
  [ChannelType.TEXT]: <Hash className="mr-2 h-4 w-4" />,
  [ChannelType.AUDIO]: <Mic className="mr-2 h-4 w-4" />,
  [ChannelType.VIDEO]: <Video className="mr-2 h-4 w-4" />
};
export const ServerSidebar = ({
  serverId
}: ServerSidebarProps) => {
  const navigate = useNavigate();
  const servers = useMockStore((state) => state.servers);
  const currentProfile = useMockStore((state) => state.currentProfile);

  const server = servers.find((s) => s.id === serverId) || servers[0];

  if (!server) {
    return null;
  }

  const channels = server.channels || [];
  const textChannels = channels.filter((channel) => channel.type === ChannelType.TEXT);
  const audioChannels = channels.filter((channel) => channel.type === ChannelType.AUDIO);
  const videoChannels = channels.filter((channel) => channel.type === ChannelType.VIDEO);

  return (
    <div className="flex flex-col h-full text-primary w-full dark:bg-[#2B2D31] bg-[#F2F3F5]">
      <ServerHeader
        server={server}
      />
      <ScrollArea className="flex-1 px-3">
        <div className="mt-2">
          <ServerSearch
            data={[
              {
                label: "Text Channels",
                type: "channel",
                data: textChannels?.map((channel) => ({
                  id: channel.id,
                  name: channel.name,
                  icon: iconMap[channel.type],
                }))
              },
              {
                label: "Voice Channels",
                type: "channel",
                data: audioChannels?.map((channel) => ({
                  id: channel.id,
                  name: channel.name,
                  icon: iconMap[channel.type],
                }))
              },
              {
                label: "Video Channels",
                type: "channel",
                data: videoChannels?.map((channel) => ({
                  id: channel.id,
                  name: channel.name,
                  icon: iconMap[channel.type],
                }))
              }
            ]}
          />
        </div>
        <Separator className="bg-zinc-200 dark:bg-zinc-700 rounded-md my-2" />
        {[
          { label: "Text Channels", type: ChannelType.TEXT, channels: textChannels, alwaysShow: true },
          { label: "Voice Channels", type: ChannelType.AUDIO, channels: audioChannels, alwaysShow: false },
          { label: "Video Channels", type: ChannelType.VIDEO, channels: videoChannels, alwaysShow: false },
        ].map((section) => (section.alwaysShow || !!section.channels?.length) && (
          <div key={section.type} className="mb-2">
            <ServerSection
              sectionType="channels"
              channelType={section.type}
              label={section.label}
              server={server}
            />
            <div className="space-y-[2px]">
              {section.channels.map((channel) => (
                <ServerChannel
                  key={channel.id}
                  channel={channel}
                  server={server}
                />
              ))}
            </div>
          </div>
        ))}
      </ScrollArea>
    </div>
  );
};
