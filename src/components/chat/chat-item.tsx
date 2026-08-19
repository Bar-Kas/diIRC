import { useState, useEffect } from "react";
import { Member, Profile } from "@/types";
import { Reply } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { UserAvatar } from "@/components/user-avatar";
import { UserHoverCard, getMemberDisplayName } from "@/components/user-hover-card";
import { ActionTooltip } from "@/components/action-tooltip";
import { cn } from "@/lib/utils";
import { useMockStore } from "@/lib/mock-store";
import { ChatItemAttachment } from "./chat-item-attachment";
import { LinkPreview } from "./link-preview";

import { isMediaUrl, subscribeImageCache } from "@/lib/image-utils";
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
  channelId?: string;
  conversationId?: string;
  compact?: boolean;
  isSystem?: boolean;
  onContentSizeChange?: () => void;
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
  channelId,
  conversationId,
  compact = false,
  isSystem = false,
  onContentSizeChange,
}: ChatItemProps) => {
  const params = useParams();
  const navigate = useNavigate();

  const compactMode = useMockStore((state) => state.compactMode);
  const enableLinkPreviews = useMockStore((state) => state.enableLinkPreviews);

  const [, setCacheTick] = useState(0);
  useEffect(() => {
    return subscribeImageCache(() => {
      setCacheTick((prev) => prev + 1);
    });
  }, []);

  const onMemberClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const activeServers = useMockStore.getState().servers;
    const serverId = params?.serverId || activeServers[0]?.id;
    if (!serverId) return;

    if (currentMember.id === member.id || currentMember.profile.name.toLowerCase() === member.profile.name.toLowerCase()) {
      return;
    }

    const server = activeServers.find((s) => s.id === serverId) || activeServers[0];
    if (!server) return;

    let targetMember = server.members.find(
      (m) => m.id === member.id || m.profile.name.toLowerCase() === member.profile.name.toLowerCase()
    );

    if (!targetMember) {
      targetMember = useMockStore.getState().addServerMember(server.id, member.profile.name);
    }

    if (!targetMember) return;

    useMockStore.getState().openConversation(server.id, targetMember.id);
    navigate(`/servers/${server.id}/conversations/${targetMember.id}`);
  };

  const urlRegex = /(https?:\/\/[^\s]+)/g;

  const renderContentWithLinks = (text: string) => {
    if (deleted) return text;
    const parts = text.split(urlRegex);
    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        if (enableLinkPreviews && isMediaUrl(part)) {
          // Hide raw media (image or video) URL text because it will be rendered as a media card below
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

  const servers = useMockStore((state) => state.servers);
  const activeServer = servers.find((s) => s.id === params?.serverId) || servers[0];
  const displayName = getMemberDisplayName(member, activeServer);

  if (isSystem) {
    return (
      <div className="relative group flex items-center hover:bg-black/5 px-4 py-1 transition w-full">
        <div className="w-10 flex justify-center shrink-0">
          <ActionTooltip label={timestamp}>
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono select-none">
              {compactTime}
            </span>
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
          <UserHoverCard member={member} server={activeServer} side="right">
            <div onClick={onMemberClick} className="cursor-pointer hover:drop-shadow-md transition shrink-0">
              <UserAvatar src={member.profile.imageUrl} name={displayName} className="h-10 w-10 md:h-10 md:w-10" />
            </div>
          </UserHoverCard>
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
                <UserHoverCard member={member} server={activeServer} side="right">
                  <p onClick={onMemberClick} className="font-semibold text-sm hover:underline cursor-pointer">
                    {displayName}
                  </p>
                </UserHoverCard>
              </div>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {timestamp}
              </span>
            </div>
          )}

          {fileUrl && (
            <ChatItemAttachment
              fileUrl={fileUrl}
              content={content}
              onContentSizeChange={onContentSizeChange}
            />
          )}

          {!fileUrl && (
            <div className="space-y-1">
              {(hasVisibleText || deleted) && (
                <p className={cn(
                  "text-sm text-zinc-600 dark:text-zinc-300",
                  deleted && "italic text-zinc-500 dark:text-zinc-400 text-xs mt-1"
                )}>
                  {renderContentWithLinks(content)}
                </p>
              )}
              {extractedUrls.map((url) => (
                <LinkPreview
                  key={url}
                  url={url}
                  onContentSizeChange={onContentSizeChange}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="hidden group-hover:flex items-center gap-x-2 absolute p-1 -top-2 right-5 bg-white dark:bg-zinc-800 border rounded-sm">
        <ActionTooltip label="Answer">
          <Reply
            className="cursor-pointer ml-auto w-4 h-4 text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition"
          />
        </ActionTooltip>
      </div>
    </div>
  );
};

