import { Hash, PanelLeft, Server, Users } from "lucide-react";

import { MobileToggle } from "@/components/mobile-toggle";
import { UserAvatar } from "@/components/user-avatar";
import { ActionTooltip } from "@/components/action-tooltip";
import { useUIStore } from "@/hooks/use-ui-store";
import { cn } from "@/lib/utils";

interface ChatHeaderProps {
  serverId: string;
  name: string;
  type: "channel" | "conversation";
  imageUrl?: string;
}

export const ChatHeader = ({
  serverId,
  name,
  type,
  imageUrl
}: ChatHeaderProps) => {
  const { 
    showNavigationSidebar, 
    toggleNavigationSidebar, 
    showServerSidebar, 
    toggleServerSidebar, 
    showMembersSidebar, 
    toggleMembersSidebar 
  } = useUIStore();

  return (
    <div className="text-md font-semibold px-3 flex items-center h-12 border-neutral-200 dark:border-neutral-800 border-b-2 gap-x-2">
      <MobileToggle serverId={serverId} />
      
      <ActionTooltip 
        side="bottom" 
        label={showNavigationSidebar ? "Hide server list" : "Show server list"}
      >
        <button
          onClick={toggleNavigationSidebar}
          className="hidden md:flex items-center justify-center p-1.5 rounded-lg hover:bg-zinc-200/60 dark:hover:bg-zinc-700/50 transition"
        >
          <Server className={cn(
            "w-5 h-5 text-zinc-500 dark:text-zinc-400 transition",
            showNavigationSidebar && "text-indigo-500 dark:text-indigo-400"
          )} />
        </button>
      </ActionTooltip>

      <ActionTooltip 
        side="bottom" 
        label={showServerSidebar ? "Hide channel list" : "Show channel list"}
      >
        <button
          onClick={toggleServerSidebar}
          className="hidden md:flex items-center justify-center p-1.5 rounded-lg hover:bg-zinc-200/60 dark:hover:bg-zinc-700/50 transition mr-1"
        >
          <PanelLeft className={cn(
            "w-5 h-5 text-zinc-500 dark:text-zinc-400 transition",
            showServerSidebar && "text-indigo-500 dark:text-indigo-400"
          )} />
        </button>
      </ActionTooltip>

      {type === "channel" && (
        <Hash className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
      )}
      {type === "conversation" && (
        <UserAvatar 
          src={imageUrl}
          name={name}
          className="h-8 w-8 md:h-8 md:w-8"
        />
      )}
      <p className="font-semibold text-md text-black dark:text-white">
        {name}
      </p>

      <div className="ml-auto flex items-center gap-x-2">
        <ActionTooltip 
          side="bottom" 
          label={showMembersSidebar ? "Hide user list" : "Show user list"}
        >
          <button
            onClick={toggleMembersSidebar}
            className="flex items-center justify-center p-1.5 rounded-lg hover:bg-zinc-200/60 dark:hover:bg-zinc-700/50 transition"
          >
            <Users className={cn(
              "w-5 h-5 text-zinc-500 dark:text-zinc-400 transition",
              showMembersSidebar && "text-indigo-500 dark:text-indigo-400"
            )} />
          </button>
        </ActionTooltip>
      </div>
    </div>
  );
};
