import { 
  Channel, 
  ChannelType, 
  Server
} from "@/types";
import { Hash, X, Lock, Sliders, Settings, Bell, BellOff } from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";

import { cn } from "@/lib/utils";
import { ActionTooltip } from "@/components/action-tooltip";
import { ModalType, useModal } from "@/hooks/use-modal-store";
import { useMockStore } from "@/lib/mock-store";
import { resolveEffectiveNotificationSettings } from "@/lib/notification-service";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ServerChannelProps {
  channel: Channel;
  server: Server;
}

const iconMap = {
  [ChannelType.TEXT]: Hash,
};

export const ServerChannel = ({
  channel,
  server
}: ServerChannelProps) => {
  const { onOpen } = useModal();
  const params = useParams();
  const navigate = useNavigate();

  const currentProfile = useMockStore((state) => state.currentProfile);
  const channelOpsMap = useMockStore((state) => state.channelOps);
  const channelUserModesMap = useMockStore((state) => state.channelUserModes);
  const deleteChannel = useMockStore((state) => state.deleteChannel);
  const confirmLeaveChannel = useMockStore((state) => state.confirmLeaveChannel ?? true);
  const globalNotificationSettings = useMockStore((state) => state.notificationSettings);
  const setChannelNotificationSettings = useMockStore((state) => state.setChannelNotificationSettings);

  const ourNick = server?.nicknames?.[0] || currentProfile.name;

  const channelOps = channelOpsMap[channel.id] || [];
  const ourModes = channelUserModesMap[channel.id]?.[ourNick.toLowerCase()] || [];
  const isChannelOp =
    channelOps.some((opNick) => opNick.toLowerCase() === ourNick.toLowerCase()) ||
    ourModes.some((m) => ["o", "a", "q"].includes(m.toLowerCase()));

  const Icon = iconMap[channel.type];

  const effectiveSettings = resolveEffectiveNotificationSettings(
    globalNotificationSettings,
    server.notificationSettings,
    channel.notificationSettings,
    false
  );
  const isMuted = effectiveSettings.channelNotifications === "off";

  const onClick = () => {
    navigate(`/servers/${params?.serverId}/channels/${channel.id}`);
  };

  const onAction = (e: React.MouseEvent, action: ModalType) => {
    e.stopPropagation();
    onOpen(action, { channel, server });
  };

  const isSelected = params?.channelId === channel.id;
  const unread = useMockStore((state) => state.unreadState[`channel:${channel.id}`]);
  const isUnread = !!unread && unread.count > 0;

  const handleLeaveChannel = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    if (confirmLeaveChannel) {
      onOpen("deleteChannel", { channel, server });
    } else {
      deleteChannel(server.id, channel.id);
      if (isSelected) {
        navigate(`/servers/${server.id}`);
      }
    }
  };

  const handleToggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    setChannelNotificationSettings(server.id, channel.id, {
      channelNotifications: isMuted ? "default" : "off",
    });
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1) {
      e.preventDefault();
    }
  };

  const onAuxClick = (e: React.MouseEvent) => {
    if (e.button === 1) {
      e.preventDefault();
      handleLeaveChannel(e);
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          onClick={onClick}
          onMouseDown={onMouseDown}
          onAuxClick={onAuxClick}
          className={cn(
            "group px-2 py-2 rounded-md flex items-center gap-x-2 w-full hover:bg-zinc-700/10 dark:hover:bg-zinc-700/50 transition mb-1 relative",
            isSelected && "bg-zinc-700/20 dark:bg-zinc-700",
            isUnread && "bg-indigo-500/10 dark:bg-indigo-500/15"
          )}
        >
          {isUnread && (
            <span
              className={cn(
                "absolute left-0 w-1.5 h-4 rounded-r-full transition-all",
                unread.hasMention ? "bg-rose-500" : "bg-indigo-500 dark:bg-indigo-400"
              )}
            />
          )}
          <Icon className={cn(
            "flex-shrink-0 w-5 h-5 transition",
            isSelected
              ? "text-primary dark:text-zinc-200"
              : isUnread
              ? "text-indigo-600 dark:text-indigo-400 font-bold"
              : isMuted
              ? "text-zinc-400/60 dark:text-zinc-500/60"
              : "text-zinc-500 dark:text-zinc-400"
          )} />
          <p className={cn(
            "line-clamp-1 text-sm text-left transition flex-1",
            isSelected
              ? "font-semibold text-primary dark:text-zinc-200 dark:group-hover:text-white"
              : isUnread
              ? "font-bold text-zinc-900 dark:text-white drop-shadow-sm"
              : isMuted
              ? "font-medium text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-500 dark:group-hover:text-zinc-400"
              : "font-semibold text-zinc-500 group-hover:text-zinc-600 dark:text-zinc-400 dark:group-hover:text-zinc-300"
          )}>
            {channel.name}
          </p>
          {channel.key && (
            <ActionTooltip label="Password protected">
              <Lock className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 flex-shrink-0" />
            </ActionTooltip>
          )}
          {isUnread && (
            <span
              className={cn(
                "ml-auto text-[11px] font-bold px-1.5 py-0.5 rounded-full text-white leading-none shrink-0 shadow-sm transition-transform animate-in zoom-in-50",
                unread.hasMention ? "bg-rose-500 shadow-rose-500/30" : "bg-indigo-500 shadow-indigo-500/30"
              )}
            >
              {unread.hasMention ? `@${unread.count}` : unread.count}
            </span>
          )}
          <div className="ml-auto flex items-center gap-x-2">
            <ActionTooltip label={isMuted ? "Unmute channel" : "Mute channel"}>
              <span
                onClick={handleToggleMute}
                className={cn(
                  "p-0.5 rounded transition cursor-pointer text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300",
                  isMuted ? "block text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300" : "hidden group-hover:block"
                )}
              >
                {isMuted ? (
                  <BellOff className="w-4 h-4" />
                ) : (
                  <Bell className="w-4 h-4" />
                )}
              </span>
            </ActionTooltip>
            <ActionTooltip label="Leave">
              <X
                onClick={handleLeaveChannel}
                className="hidden group-hover:block w-4 h-4 text-zinc-500 hover:text-red-500 dark:text-zinc-400 dark:hover:text-red-400 transition"
              />
            </ActionTooltip>
          </div>
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56 bg-white dark:bg-[#111214] text-zinc-900 dark:text-zinc-100 border-zinc-200 dark:border-zinc-800">
        {isChannelOp ? (
          <>
            <ContextMenuItem
              onSelect={() => setTimeout(() => onOpen("channelOperatorSettings", { server, channel }), 0)}
              className="cursor-pointer flex items-center gap-x-2"
            >
              <Sliders className="w-4 h-4" />
              Channel settings (operator)
            </ContextMenuItem>
            <ContextMenuItem
              onSelect={() => setTimeout(() => onOpen("channelSettings", { server, channel }), 0)}
              className="cursor-pointer flex items-center gap-x-2"
            >
              <Settings className="w-4 h-4" />
              Channel settings
            </ContextMenuItem>
          </>
        ) : (
          <>
            <TooltipProvider>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <div className="w-full">
                    <ContextMenuItem disabled className="opacity-50 cursor-not-allowed flex items-center gap-x-2">
                      <Sliders className="w-4 h-4" />
                      Channel settings (operator)
                    </ContextMenuItem>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p className="text-xs font-medium">You must be a channel operator</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <ContextMenuItem
              onSelect={() => setTimeout(() => onOpen("channelSettings", { server, channel }), 0)}
              className="cursor-pointer flex items-center gap-x-2"
            >
              <Settings className="w-4 h-4" />
              Channel settings
            </ContextMenuItem>
          </>
        )}
        <ContextMenuSeparator className="bg-zinc-200 dark:bg-zinc-800" />
        <ContextMenuItem
          onSelect={() => setTimeout(() => handleLeaveChannel(), 0)}
          className="cursor-pointer flex items-center gap-x-2 text-rose-600 dark:text-rose-400 focus:text-rose-600 dark:focus:text-rose-400"
        >
          <X className="w-4 h-4" />
          Leave channel
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};
