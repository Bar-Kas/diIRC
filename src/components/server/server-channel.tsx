import { 
  Channel, 
  ChannelType, 
  Server
} from "@/types";
import { Hash, Trash } from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";

import { cn } from "@/lib/utils";
import { ActionTooltip } from "@/components/action-tooltip";
import { ModalType, useModal } from "@/hooks/use-modal-store";

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

  const Icon = iconMap[channel.type];

  const onClick = () => {
    navigate(`/servers/${params?.serverId}/channels/${channel.id}`);
  };

  const onAction = (e: React.MouseEvent, action: ModalType) => {
    e.stopPropagation();
    onOpen(action, { channel, server });
  };

  const isSelected = params?.channelId === channel.id;

  return (
    <button
      onClick={onClick}
      className={cn(
        "group px-2 py-2 rounded-md flex items-center gap-x-2 w-full hover:bg-zinc-700/10 dark:hover:bg-zinc-700/50 transition mb-1",
        isSelected && "bg-zinc-700/20 dark:bg-zinc-700"
      )}
    >
      <Icon className="flex-shrink-0 w-5 h-5 text-zinc-500 dark:text-zinc-400" />
      <p className={cn(
        "line-clamp-1 font-semibold text-sm text-zinc-500 group-hover:text-zinc-600 dark:text-zinc-400 dark:group-hover:text-zinc-300 transition",
        isSelected && "text-primary dark:text-zinc-200 dark:group-hover:text-white"
      )}>
        {channel.name}
      </p>
      <div className="ml-auto flex items-center gap-x-2">
        <ActionTooltip label="Leave">
          <Trash
            onClick={(e) => onAction(e, "deleteChannel")}
            className="hidden group-hover:block w-4 h-4 text-zinc-500 hover:text-zinc-600 dark:text-zinc-400 dark:hover:text-zinc-300 transition"
          />
        </ActionTooltip>
      </div>
    </button>
  );
};
