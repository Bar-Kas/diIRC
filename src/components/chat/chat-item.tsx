import { Member, Profile } from "@/types";
import { Edit, Trash } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { UserAvatar } from "@/components/user-avatar";
import { ActionTooltip } from "@/components/action-tooltip";
import { cn } from "@/lib/utils";
import { useModal } from "@/hooks/use-modal-store";
import { useMockStore } from "@/lib/mock-store";
import { ChatItemAttachment } from "./chat-item-attachment";
import { ChatItemEditForm } from "./chat-item-edit-form";
import { LinkPreview } from "./link-preview";

import { isImageUrl } from "@/lib/image-utils";
import { openExternalUrl } from "@/lib/system-utils";

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
  const enableLinkPreviews = useMockStore((state) => state.enableLinkPreviews);

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

  const isOwner = currentMember.id === member.id;
  const canDeleteMessage = !deleted && isOwner;
  const canEditMessage = !deleted && isOwner && !fileUrl;

  const urlRegex = /(https?:\/\/[^\s]+)/g;

  const renderContentWithLinks = (text: string) => {
    if (deleted) return text;
    const parts = text.split(urlRegex);
    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        if (enableLinkPreviews && isImageUrl(part)) {
          // Hide raw image URL text because it will be rendered as an image card below
          return null;
        }
        return (
          <button
            key={index}
            type="button"
            onClick={() => openExternalUrl(part)}
            className="text-indigo-500 dark:text-indigo-400 hover:underline break-all inline text-left p-0 bg-transparent border-none font-normal"
          >
            {part}
          </button>
        );
      }
      return part;
    });
  };

  // Check if there is any visible text remaining after hiding image URLs
  const renderedElements = renderContentWithLinks(content);
  const hasVisibleText = Array.isArray(renderedElements)
    ? renderedElements.some((item) => item !== null && typeof item === "string" ? item.trim().length > 0 : item !== null)
    : Boolean(renderedElements);

  const extractedUrls = enableLinkPreviews && !deleted && !fileUrl
    ? Array.from(new Set(content.match(urlRegex) || []))
    : [];

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
              </div>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {timestamp}
              </span>
            </div>
          )}

          {fileUrl && <ChatItemAttachment fileUrl={fileUrl} content={content} />}

          {!fileUrl && !isEditing && (
            <div className="space-y-1">
              {(hasVisibleText || deleted || isUpdated) && (
                <p className={cn(
                  "text-sm text-zinc-600 dark:text-zinc-300",
                  deleted && "italic text-zinc-500 dark:text-zinc-400 text-xs mt-1"
                )}>
                  {renderContentWithLinks(content)}
                  {isUpdated && !deleted && (
                    <span className="text-[10px] mx-2 text-zinc-500 dark:text-zinc-400">
                      (edited)
                    </span>
                  )}
                </p>
              )}
              {extractedUrls.map((url) => (
                <LinkPreview key={url} url={url} />
              ))}
            </div>
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
