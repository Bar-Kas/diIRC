import { ChannelType } from "@/types";
import { Hash, User, Check, X, Sparkles, Plus } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useMockStore } from "@/lib/mock-store";
import { getMemberDisplayName } from "@/components/user-hover-card";
import { cn } from "@/lib/utils";
import { ServerHeader } from "./server-header";
import { ServerSearch } from "./server-search";
import { ServerSection } from "./server-section";
import { ServerChannel } from "./server-channel";
import { ServerConversation } from "./server-conversation";
import { useUIStore } from "@/hooks/use-ui-store";
import { ActionTooltip } from "@/components/action-tooltip";
import { useModal } from "@/hooks/use-modal-store";

interface ServerSidebarProps {
  serverId: string;
}

const iconMap = {
  [ChannelType.TEXT]: <Hash className="mr-2 h-4 w-4" />,
};

export const ServerSidebar = ({
  serverId
}: ServerSidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentProfile = useMockStore((state) => state.currentProfile);
  const servers = useMockStore((state) => state.servers);
  const activeConversations = useMockStore((state) => state.activeConversations);
  const pendingInvites = useMockStore((state) => state.pendingInvites);
  const acceptPendingInvite = useMockStore((state) => state.acceptPendingInvite);
  const ignorePendingInvite = useMockStore((state) => state.ignorePendingInvite);

  const setMembersSidebar = useUIStore((state) => state.setMembersSidebar);
  const { onOpen } = useModal();

  const [splitPercent, setSplitPercent] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  const server = servers.find((s) => s.id === serverId) || servers[0];
  const serverInvites = (server ? pendingInvites[server.id] : []) || [];

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.height === 0) return;
      const offsetY = e.clientY - rect.top;
      const newPercent = (offsetY / rect.height) * 100;
      const clamped = Math.min(Math.max(newPercent, 20), 80);
      setSplitPercent(clamped);
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const handleDividerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
  };

  if (!server) {
    return null;
  }

  const channels = server.channels || [];
  const textChannels = channels.filter((channel) => channel.type === ChannelType.TEXT);

  const currentMember = server.members.find(
    (m) =>
      m.profileId === currentProfile?.id ||
      m.profile?.id === currentProfile?.id ||
      (server.nicknames && server.nicknames.length > 0 && 
       server.nicknames.some(nick => nick.toLowerCase() === m.profile?.name?.toLowerCase())) ||
      m.id.startsWith("member-")
  ) || server.members[0]; // fallback to first member so it's never undefined


  const otherMembers = (server.members || []).filter(
    (m) =>
      m.id !== currentMember?.id &&
      m.profileId !== currentProfile?.id &&
      m.profile?.name?.toLowerCase() !== server.nicknames?.[0]?.toLowerCase() &&
      !m.id.startsWith("self-")
  );

  const directMessagesMap = useMockStore((state) => state.directMessages);
  const sortDmByUnread = useMockStore((state) => state.sortDmByUnread ?? true);
  const dmSortOrder = useMockStore((state) => state.dmSortOrder ?? "opening");
  const unreadState = useMockStore((state) => state.unreadState);

  const activeMemberIds = (activeConversations[server.id] || []).filter(
    (memberId) => memberId !== currentMember?.id
  );
  const rawPmMembers = activeMemberIds
    .map((memberId) => server.members.find((m) => m.id === memberId))
    .filter((m): m is NonNullable<typeof m> => {
      if (!m) return false;
      const isSelected = location.pathname.includes(`/conversations/${m.id}`);
      if (isSelected) return true;
      if (!currentMember) return false;
      const convId = [currentMember.id, m.id].sort().join("-");
      const msgs = directMessagesMap[convId];
      if (msgs !== undefined && msgs.length === 0) return false;
      return true;
    });

  const sortedPmMembers = [...rawPmMembers];
  if (dmSortOrder === "alphabetical") {
    sortedPmMembers.sort((a, b) => {
      const nameA = getMemberDisplayName(a, server) || a.profile?.name || "";
      const nameB = getMemberDisplayName(b, server) || b.profile?.name || "";
      return nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
    });
  }

  if (sortDmByUnread) {
    sortedPmMembers.sort((a, b) => {
      const convIdA = currentMember ? [currentMember.id, a.id].sort().join("-") : "";
      const convIdB = currentMember ? [currentMember.id, b.id].sort().join("-") : "";
      const unreadA = unreadState[`conversation:${convIdA}`] || unreadState[`conversation:${a.id}`];
      const unreadB = unreadState[`conversation:${convIdB}`] || unreadState[`conversation:${b.id}`];
      const isUnreadA = !!unreadA && unreadA.count > 0 ? 1 : 0;
      const isUnreadB = !!unreadB && unreadB.count > 0 ? 1 : 0;
      return isUnreadB - isUnreadA;
    });
  }

  const pmMembers = sortedPmMembers;

  const isConversationPage = location.pathname.includes("/conversations/");

  return (
    <div className="flex flex-col h-full text-primary w-full dark:bg-[#2B2D31] bg-[#F2F3F5] overflow-hidden select-none">
      <ServerHeader server={server} />

      <div ref={containerRef} className="flex flex-col flex-1 overflow-hidden relative">
        {/* Top Section: Channels */}
        <div style={{ height: `${splitPercent}%` }} className="flex flex-col min-h-0">
          <ScrollArea className="flex-1 px-3">
            <div className="mt-2">
              <ServerSearch
                serverId={server.id}
                data={[
                  {
                    label: "Text channels",
                    type: "channel",
                    data: textChannels?.map((channel) => ({
                      id: channel.id,
                      name: channel.name,
                      icon: iconMap[channel.type],
                    }))
                  },
                  {
                    label: "Members",
                    type: "member",
                    data: otherMembers?.map((member) => {
                      const displayName = getMemberDisplayName(member, server);
                      const nickname = member.profile?.name;
                      const nameWithNick =
                        displayName && nickname && displayName !== nickname
                          ? `${displayName} (${nickname})`
                          : displayName || nickname || "User";

                      return {
                        id: member.id,
                        name: nameWithNick,
                        icon: <User className="mr-2 h-4 w-4" />,
                      };
                    })
                  }
                ]}
              />
            </div>
            <Separator className="bg-zinc-200 dark:bg-zinc-700 rounded-md my-2" />
            
            {serverInvites.length > 0 && (
              <div className="mb-3 space-y-1">
                <div className="flex items-center justify-between px-1 py-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-indigo-500 dark:text-indigo-400 flex items-center gap-x-1.5">
                    <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                    Invites ({serverInvites.length})
                  </p>
                </div>
                <div className="space-y-1.5">
                  {serverInvites.map((invite) => {
                    const isSelected = location.pathname.includes(`/invites/${encodeURIComponent(invite.channelName)}`);
                    return (
                      <div
                        key={invite.id}
                        onClick={() => navigate(`/servers/${server.id}/invites/${encodeURIComponent(invite.channelName)}`)}
                        className={cn(
                          "group px-2.5 py-2 rounded-md flex items-center justify-between gap-x-2 transition cursor-pointer border",
                          isSelected
                            ? "bg-indigo-500/20 border-indigo-500/50 text-indigo-900 dark:text-indigo-100 shadow-sm"
                            : "bg-indigo-500/10 dark:bg-indigo-500/15 border-indigo-500/25 text-zinc-800 dark:text-zinc-200 hover:bg-indigo-500/20 dark:hover:bg-indigo-500/25"
                        )}
                      >
                        <div className="flex items-center gap-x-2 min-w-0 flex-1">
                          <Hash className="w-4 h-4 text-indigo-500 shrink-0" />
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-semibold truncate">
                              #{invite.channelName}
                            </span>
                            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                              Invited by {invite.inviter}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-x-1 shrink-0">
                          <button
                            type="button"
                            onClick={async (e) => {
                              e.stopPropagation();
                              await acceptPendingInvite(server.id, invite.channelName);
                            }}
                            title="Join channel"
                            className="p-1 rounded hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 transition"
                          >
                            <Check className="w-4 h-4 stroke-[2.5]" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              ignorePendingInvite(server.id, invite.channelName);
                            }}
                            title="Ignore invite"
                            className="p-1 rounded hover:bg-rose-500/20 text-zinc-400 hover:text-rose-500 transition"
                          >
                            <X className="w-4 h-4 stroke-[2.5]" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <Separator className="bg-zinc-200 dark:bg-zinc-700/80 rounded-md my-2" />
              </div>
            )}

            {[
              { label: "Text channels", type: ChannelType.TEXT, channels: textChannels, alwaysShow: true },
            ].map((section) => (section.alwaysShow || !!section.channels?.length) && (
              <div key={section.type} className="mb-2">
                <ServerSection
                  sectionType="channels"
                  channelType={section.type}
                  label={section.label}
                  server={server}
                />
                <div className="space-y-[2px]">
                  {section.channels.map((channel) => (
                    <ServerChannel
                      key={channel.id}
                      channel={channel}
                      server={server}
                    />
                  ))}
                </div>
              </div>
            ))}
          </ScrollArea>
        </div>

        {/* Draggable Divider Handle */}
        <div
          onMouseDown={handleDividerMouseDown}
          className="h-2 flex items-center justify-center cursor-row-resize hover:bg-zinc-300/50 dark:hover:bg-zinc-700/50 transition group shrink-0 border-y border-zinc-200 dark:border-zinc-800/60"
          title="Drag to resize panels"
        >
          <div className="w-10 h-[3px] bg-zinc-300 dark:bg-zinc-600 group-hover:bg-indigo-500 rounded transition" />
        </div>

        {/* Bottom Section: Private Messages */}
        <div style={{ height: `${100 - splitPercent}%` }} className="flex flex-col min-h-0">
          <div className="px-3 pt-2">
            <div className="flex items-center justify-between py-1">
              <p
                onClick={isConversationPage ? () => setMembersSidebar(true) : undefined}
                className={cn(
                  "text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400 flex items-center gap-x-1 select-none transition",
                  isConversationPage && "cursor-pointer hover:text-zinc-700 dark:hover:text-zinc-200"
                )}
                title={isConversationPage ? "Expand side panel" : undefined}
              >
                Private messages ({pmMembers.length})
              </p>
              <ActionTooltip label="Start private message" side="top">
                <button
                  onClick={() => onOpen("privateMessages", { server })}
                  className="text-zinc-500 hover:text-zinc-600 dark:text-zinc-400 dark:hover:text-zinc-300 transition"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </ActionTooltip>
            </div>
          </div>
          <ScrollArea className="flex-1 px-3">
            {pmMembers.length > 0 ? (
              <div className="space-y-[2px]">
                {pmMembers.map((member) => (
                  <ServerConversation
                    key={member.id}
                    member={member}
                    server={server}
                  />
                ))}
              </div>
            ) : (
              <div className="text-xs text-zinc-400 dark:text-zinc-500 italic px-2 py-3">
                No active private messages
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  );
};
