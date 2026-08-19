import { useParams, useNavigate } from "react-router-dom";

import { cn } from "@/lib/utils";
import { ActionTooltip } from "@/components/action-tooltip";

interface NavigationItemProps {
  id: string;
  imageUrl: string;
  name: string;
  unreadCount?: number;
  mentionCount?: number;
}

export const NavigationItem = ({
  id,
  imageUrl,
  name,
  unreadCount = 0,
  mentionCount = 0,
}: NavigationItemProps) => {
  const params = useParams();
  const navigate = useNavigate();

  const onClick = () => {
    navigate(`/servers/${id}`);
  };

  const isSelected = params?.serverId === id;

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
          isSelected ? "h-[36px]" : "h-[8px]"
        )} />
        <div className={cn(
          "relative group flex mx-3 h-[48px] w-[48px] rounded-[24px] group-hover:rounded-[16px] transition-all overflow-hidden",
          isSelected && "bg-primary/10 text-primary rounded-[16px]"
        )}>
          <img
            src={imageUrl}
            alt={name}
            className="w-full h-full object-cover"
          />
          {!!mentionCount && (
            <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-rose-600 px-1.5 py-0.5 text-center text-[10px] font-bold text-white">
              {mentionCount > 99 ? "99+" : mentionCount}
            </span>
          )}
          {!!unreadCount && !mentionCount && (
            <span className="absolute -left-1 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-white dark:bg-zinc-200" />
          )}
        </div>
      </button>
    </ActionTooltip>
  );
};
