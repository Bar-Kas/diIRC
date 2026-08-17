import { Member, Server } from "@/types";
import { UserAvatar } from "@/components/user-avatar";
import { useNavigate } from "react-router-dom";
import { useMockStore } from "@/lib/mock-store";

interface ChatMembersSidebarProps {
  server: Server;
}

export const ChatMembersSidebar = ({
  server
}: ChatMembersSidebarProps) => {
  const navigate = useNavigate();
  const openConversation = useMockStore((state) => state.openConversation);
  const currentProfile = useMockStore((state) => state.currentProfile);
  const members = server.members;

  const onMemberClick = (memberId: string) => {
    const currentMember = server.members.find((m) => m.profileId === currentProfile.id);
    if (currentMember?.id === memberId) return;
    openConversation(server.id, memberId);
    navigate(`/servers/${server.id}/conversations/${memberId}`);
  };

  return (
    <div className="h-full w-60 bg-[#F2F3F5] dark:bg-[#2B2D31] flex flex-col pt-4 px-2 overflow-y-auto hidden md:flex shrink-0 border-l border-zinc-200 dark:border-zinc-800">
      <div className="mb-6">
        <h3 className="uppercase text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-2 px-2">
          Users — {members.length}
        </h3>
        <div className="space-y-[2px]">
          {members.map((member) => (
            <div
              key={member.id}
              onClick={() => onMemberClick(member.id)}
              className="group px-2 py-1 flex items-center gap-x-2 w-full hover:bg-zinc-700/10 dark:hover:bg-zinc-700/50 transition cursor-pointer rounded-md"
            >
              <UserAvatar 
                src={member.profile.imageUrl}
                name={member.profile.name}
                className="h-8 w-8 md:h-8 md:w-8"
              />
              <div className="flex flex-col overflow-hidden">
                <div className="flex items-center">
                  <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 truncate">
                    {member.profile.name}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
