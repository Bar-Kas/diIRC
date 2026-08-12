import { Member, MemberRole, Profile } from "@/types";
import { Edit, ShieldAlert, ShieldCheck, Trash } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { UserAvatar } from "@/components/user-avatar";
import { ActionTooltip } from "@/components/action-tooltip";
import { cn } from "@/lib/utils";
import { useModal } from "@/hooks/use-modal-store";
import { useMockStore } from "@/lib/mock-store";
import { ChatItemAttachment } from "./chat-item-attachment";
import { ChatItemEditForm } from "./chat-item-edit-form";

interface ChatItemProps {
  id: string;
  content: string;
  member: Member & {
    profile: Profile;
  };
  timestamp: string;
  compactTime?: string;
  fileUrl: string | null;
  deleted: boolean;
  currentMember: Member;
  isUpdated: boolean;
  channelId?: string;
  conversationId?: string;
  compact?: boolean;
  isSystem?: boolean;
}

const roleIconMap = {
  [MemberRole.GUEST]: null,
  [MemberRole.MODERATOR]: <ShieldCheck className="h-4 w-4 ml-2 text-indigo-500" />,
  [MemberRole.ADMIN]: <ShieldAlert className="h-4 w-4 ml-2 text-rose-500" />,
};

export const ChatItem = ({
  id,
  content,
  member,
  timestamp,
  compactTime,
  fileUrl,
  deleted,
  currentMember,
  isUpdated,
  channelId,
  conversationId,
  compact = false,
  isSystem = false,
}: ChatItemProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const { onOpen } = useModal();
  const params = useParams();
  const navigate = useNavigate();

  const editMessage = useMockStore((state) => state.editMessage);
  const editDirectMessage = useMockStore((state) => state.editDirectMessage);
  const compactMode = useMockStore((state) => state.compactMode);

  const onMemberClick = () => {
    if (member.id === currentMember.id) {
      return;
    }
    navigate(`/servers/${params?.serverId}/conversations/${member.id}`);
  };

  const handleEditSubmit = async (values: { content: string }) => {
    try {
      if (channelId) {
        editMessage(channelId, id, values.content);
      } else if (conversationId) {
        editDirectMessage(conversationId, id, values.content);
      }
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to edit message:", error);
    }
  };

  const isAdmin = currentMember.role === MemberRole.ADMIN;
  const isModerator = currentMember.role === MemberRole.MODERATOR;
  const isOwner = currentMember.id === member.id;
  const canDeleteMessage = !deleted && (isAdmin || isModerator || isOwner);
  const canEditMessage = !deleted && isOwner && !fileUrl;

  if (isSystem) {
    return (
      <div className="relative group flex items-center hover:bg-black/5 px-4 py-1 transition w-full">
        <div className="w-10 flex justify-center shrink-0">
          <ActionTooltip label={timestamp}>
            <span className="text-zinc-500 font-bold">→</span>
          </ActionTooltip>
        </div>
        <p className="text-sm text-zinc-500 italic ml-2">
          {content}
        </p>
      </div>
    );
  }

  return (
    <div className={cn(
      "relative group flex items-center hover:bg-black/5 px-4 transition w-full",
      compact ? "py-[2px]" : "pt-3 pb-[2px] mt-2"
    )}>
      <div className="group flex gap-x-2 items-start w-full">
        {!compactMode && !compact ? (
          <div onClick={onMemberClick} className="cursor-pointer hover:drop-shadow-md transition shrink-0">
            <UserAvatar src={member.profile.imageUrl} name={member.profile.name} className="h-10 w-10 md:h-10 md:w-10" />
          </div>
        ) : !compactMode && compact ? (
          <div className="w-10 h-5 flex items-center justify-center shrink-0">
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 hidden group-hover:block select-none font-mono">
              {compactTime}
            </span>
          </div>
        ) : null}
        <div className="flex flex-col w-full">
          {!compact && (
            <div className="flex items-center gap-x-2">
              <div className="flex items-center">
                <p onClick={onMemberClick} className="font-semibold text-sm hover:underline cursor-pointer">
                  {member.profile.name}
                </p>
                <ActionTooltip label={member.role}>
                  {roleIconMap[member.role]}
                </ActionTooltip>
              </div>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {timestamp}
              </span>
            </div>
          )}

          {fileUrl && <ChatItemAttachment fileUrl={fileUrl} content={content} />}

          {!fileUrl && !isEditing && (
            <p className={cn(
              "text-sm text-zinc-600 dark:text-zinc-300",
              deleted && "italic text-zinc-500 dark:text-zinc-400 text-xs mt-1"
            )}>
              {content}
              {isUpdated && !deleted && (
                <span className="text-[10px] mx-2 text-zinc-500 dark:text-zinc-400">
                  (edited)
                </span>
              )}
            </p>
          )}

          {!fileUrl && isEditing && (
            <ChatItemEditForm
              initialContent={content}
              onSubmit={handleEditSubmit}
              onCancel={() => setIsEditing(false)}
            />
          )}
        </div>
      </div>
      {canDeleteMessage && (
        <div className="hidden group-hover:flex items-center gap-x-2 absolute p-1 -top-2 right-5 bg-white dark:bg-zinc-800 border rounded-sm">
          {canEditMessage && (
            <ActionTooltip label="Edit">
              <Edit
                onClick={() => setIsEditing(true)}
                className="cursor-pointer ml-auto w-4 h-4 text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition"
              />
            </ActionTooltip>
          )}
          <ActionTooltip label="Delete">
            <Trash
              onClick={() => onOpen("deleteMessage", { 
                query: { channelId, conversationId, messageId: id },
              })}
              className="cursor-pointer ml-auto w-4 h-4 text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition"
            />
          </ActionTooltip>
        </div>
      )}
    </div>
  );
};
