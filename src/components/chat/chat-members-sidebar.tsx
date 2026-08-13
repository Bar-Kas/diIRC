import { Member, Server } from "@/types";
import { UserAvatar } from "@/components/user-avatar";

interface ChatMembersSidebarProps {
  server: Server;
}

export const ChatMembersSidebar = ({
  server
}: ChatMembersSidebarProps) => {
  const members = server.members;

  return (
    <div className="h-full w-60 bg-[#F2F3F5] dark:bg-[#2B2D31] flex flex-col pt-4 px-2 overflow-y-auto hidden md:flex shrink-0 border-l border-zinc-200 dark:border-zinc-800">
      <div className="mb-6">
        <h3 className="uppercase text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-2 px-2">
          Użytkownicy — {members.length}
        </h3>
        <div className="space-y-[2px]">
          {members.map((member) => (
            <div
              key={member.id}
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
