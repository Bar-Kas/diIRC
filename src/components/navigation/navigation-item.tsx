import { useParams, useNavigate } from "react-router-dom";

import { cn } from "@/lib/utils";
import { ActionTooltip } from "@/components/action-tooltip";
import { useMockStore } from "@/lib/mock-store";

interface NavigationItemProps {
  id: string;
  imageUrl: string;
  name: string;
}

export const NavigationItem = ({
  id,
  imageUrl,
  name
}: NavigationItemProps) => {
  const params = useParams();
  const navigate = useNavigate();

  const onClick = () => {
    navigate(`/servers/${id}`);
  };

  const isSelected = params?.serverId === id;

  const unreadState = useMockStore((state) => state.unreadState);
  const server = useMockStore((state) => state.servers.find((s) => s.id === id));

  let totalUnread = 0;
  let hasMention = false;

  if (server) {
    for (const channel of server.channels) {
      const info = unreadState[`channel:${channel.id}`];
      if (info && info.count > 0) {
        totalUnread += info.count;
        if (info.hasMention) hasMention = true;
      }
    }
    const processedConvKeys = new Set<string>();
    for (const [key, info] of Object.entries(unreadState)) {
      if (key.startsWith("conversation:") && info.count > 0 && !processedConvKeys.has(key)) {
        const rawId = key.replace("conversation:", "");
        if (server.members.some((m) => rawId.includes(m.id) || m.id === rawId)) {
          totalUnread += info.count;
          if (info.hasMention) hasMention = true;
          for (const otherKey of Object.keys(unreadState)) {
            if (otherKey.startsWith("conversation:")) {
              const otherRaw = otherKey.replace("conversation:", "");
              if (otherRaw === rawId || rawId.includes(otherRaw) || otherRaw.includes(rawId)) {
                processedConvKeys.add(otherKey);
              }
            }
          }
        }
      }
    }
  }

  const isUnread = !isSelected && totalUnread > 0;

  return (
    <ActionTooltip
      side="right"
      align="center"
      label={name}
    >
      <button
        onClick={onClick}
        className="group relative flex items-center"
      >
        <div className={cn(
          "absolute left-0 bg-primary rounded-r-full transition-all w-[4px]",
          !isSelected && "group-hover:h-[20px]",
          isSelected ? "h-[36px]" : (isUnread ? "h-[10px]" : "h-[0px]")
        )} />
        <div className={cn(
          "relative group flex mx-3 h-[48px] w-[48px] rounded-[24px] group-hover:rounded-[16px] transition-all overflow-hidden",
          isSelected && "bg-primary/10 text-primary rounded-[16px]",
          isUnread && "ring-2 ring-indigo-500/80 ring-offset-2 dark:ring-offset-[#1E1F22]"
        )}>
          <img
            src={imageUrl}
            alt={name}
            className="w-full h-full object-cover"
          />
        </div>
        {isUnread && (
          <span className={cn(
            "absolute -top-1 right-2 z-10 flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white shadow-md ring-2 ring-[#E3E5E8] dark:ring-[#1E1F22] transition-transform animate-in zoom-in-50 pointer-events-none",
            hasMention ? "bg-rose-500 shadow-rose-500/40" : "bg-indigo-500 shadow-indigo-500/40"
          )}>
            {totalUnread > 99 ? "99+" : totalUnread}
          </span>
        )}
      </button>
    </ActionTooltip>
  );
};
