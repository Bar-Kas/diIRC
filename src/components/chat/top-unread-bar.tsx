import { memo } from "react";
import { ChevronDown, Check } from "lucide-react";

interface TopUnreadBarProps {
  unreadCount: number;
  onJumpToUnread: () => void;
  onMarkAsRead: () => void;
}

export const TopUnreadBar = memo(({ unreadCount, onJumpToUnread, onMarkAsRead }: TopUnreadBarProps) => {
  return (
    <div className="absolute top-2 left-4 right-4 z-20 flex items-center justify-between rounded-md bg-[#5865F2] hover:bg-[#4752C4] text-white text-xs font-semibold px-3.5 py-1.5 shadow-md transition-all duration-150 animate-in slide-in-from-top-2">
      <button
        onClick={onJumpToUnread}
        className="flex items-center gap-2 hover:underline cursor-pointer focus:outline-none"
      >
        <ChevronDown className="h-4 w-4 shrink-0" />
        <span>
          {unreadCount > 1 ? `${unreadCount} unread messages` : "1 unread message"}
        </span>
        <span className="opacity-80 font-normal text-[11px] ml-1">
          (Jump to unread)
        </span>
      </button>

      <button
        onClick={onMarkAsRead}
        className="flex items-center gap-1.5 opacity-90 hover:opacity-100 hover:underline cursor-pointer focus:outline-none ml-4 shrink-0"
        title="Mark channel as read (Esc)"
      >
        <Check className="h-3.5 w-3.5" />
        <span>Mark as read</span>
      </button>
    </div>
  );
});

TopUnreadBar.displayName = "TopUnreadBar";
