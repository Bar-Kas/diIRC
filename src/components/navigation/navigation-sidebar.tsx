import { ScrollArea } from "@/components/ui/scroll-area";
import { ModeToggle } from "@/components/mode-toggle";
import { Separator } from "@/components/ui/separator";
import { UserAvatar } from "@/components/user-avatar";
import { useMockStore } from "@/lib/mock-store";
import { getBufferKey } from "@/lib/chat-buffer";
import { useModal } from "@/hooks/use-modal-store";

import { NavigationAction } from "./navigation-action";
import { NavigationItem } from "./navigation-item";

export const NavigationSidebar = () => {
  const servers = useMockStore((state) => state.servers);
  const currentProfile = useMockStore((state) => state.currentProfile);
  const readStates = useMockStore((state) => state.readStates);
  const activeConversations = useMockStore((state) => state.activeConversations);
  const { onOpen } = useModal();

  return (
    <div
      className="space-y-4 flex flex-col items-center h-full text-primary w-full dark:bg-[#1E1F22] bg-[#E3E5E8] py-3"
    >
      <NavigationAction />
      <Separator
        className="h-[2px] bg-zinc-300 dark:bg-zinc-700 rounded-md w-10 mx-auto"
      />
      <ScrollArea className="flex-1 w-full">
        {servers.map((server) => (
          <div key={server.id} className="mb-4">
            <NavigationItem
              id={server.id}
              name={server.name}
              imageUrl={server.imageUrl}
              unreadCount={(() => {
                const currentMember = server.members.find((m) => m.profileId === currentProfile.id) || server.members[0];
                const channelUnread = server.channels.reduce(
                  (total, channel) => total + (readStates[getBufferKey(server.id, "channel", channel.id)]?.unreadCount || 0),
                  0,
                );
                const pmUnread = (activeConversations[server.id] || []).reduce((total, memberId) => {
                  if (!currentMember) return total;
                  const convId = [currentMember.id, memberId].sort().join("-");
                  return total + (readStates[getBufferKey(server.id, "conversation", convId)]?.unreadCount || 0);
                }, 0);
                return channelUnread + pmUnread;
              })()}
              mentionCount={(() => {
                const currentMember = server.members.find((m) => m.profileId === currentProfile.id) || server.members[0];
                const channelMentions = server.channels.reduce(
                  (total, channel) => total + (readStates[getBufferKey(server.id, "channel", channel.id)]?.mentionCount || 0),
                  0,
                );
                const pmMentions = (activeConversations[server.id] || []).reduce((total, memberId) => {
                  if (!currentMember) return total;
                  const convId = [currentMember.id, memberId].sort().join("-");
                  return total + (readStates[getBufferKey(server.id, "conversation", convId)]?.mentionCount || 0);
                }, 0);
                return channelMentions + pmMentions;
              })()}
            />
          </div>
        ))}
      </ScrollArea>
      <div className="pb-3 mt-auto flex items-center flex-col gap-y-4">
        <ModeToggle />
        <div
          onClick={() => onOpen("settings")}
          className="relative group cursor-pointer"
          title={`${currentProfile.name} (Settings)`}
        >
          <UserAvatar
            src={currentProfile.imageUrl}
            name={currentProfile.name}
            className="h-[48px] w-[48px] border-2 border-indigo-500/50 hover:border-indigo-500 transition"
          />
        </div>
      </div>
    </div>
  );
};
