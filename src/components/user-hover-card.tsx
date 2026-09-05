import React from "react";
import { Channel, Member, Profile, Server } from "@/types";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Info, MessageSquare } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useMockStore, getServerActiveNick } from "@/lib/mock-store";
import { useModalStore } from "@/hooks/use-modal-store";
import { requestWhois } from "@/lib/irc-actions";
import { UserRoleIcon, getHighestChannelRole } from "@/components/user-role-icon";
import { UserContextMenu } from "@/components/user-context-menu";
import { ActionTooltip } from "@/components/action-tooltip";

interface UserHoverCardProps {
  member: Member & { profile: Profile };
  server?: Server;
  channel?: Channel;
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
}

import { getMemberDisplayName } from "@/lib/display-name-utils";
export { getMemberDisplayName };


export const UserHoverCard = ({
  member,
  server,
  channel: customChannel,
  children,
  side = "right",
  align = "start",
}: UserHoverCardProps) => {
  const params = useParams();
  const navigate = useNavigate();
  const currentProfile = useMockStore((state) => state.currentProfile);
  const servers = useMockStore((state) => state.servers);
  const openConversation = useMockStore((state) => state.openConversation);
  const channelUserModesMap = useMockStore((state) => state.channelUserModes);
  const awayUsersMap = useMockStore((state) => state.awayUsers);
  const awayReasonsMap = useMockStore((state) => state.awayReasons);
  const selfAwayMap = useMockStore((state) => state.selfAway);

  const activeServer = server || servers[0];
  const freshMember = activeServer?.members.find(
    (m) => m.id === member.id || m.profile.name.toLowerCase() === member.profile.name.toLowerCase()
  ) || member;

  const activeChannel = customChannel || activeServer?.channels.find((c) => c.id === params?.channelId);
  const nickname = freshMember.profile.name;
  const nicknameLower = nickname.toLowerCase();
  const activeNick = activeServer ? getServerActiveNick(activeServer) : "";
  const activeNickLower = activeNick.toLowerCase();

  const userModes = activeChannel ? channelUserModesMap[activeChannel.id]?.[nicknameLower] || [] : [];
  const highestRole = getHighestChannelRole(userModes);

  const displayName = getMemberDisplayName(freshMember, activeServer);
  const isSelf =
    freshMember.profileId === currentProfile.id ||
    (!!activeNick && nicknameLower === activeNickLower);
  const rawAwayReason = activeServer
    ? awayReasonsMap[activeServer.id]?.[nicknameLower] || (isSelf ? awayReasonsMap[activeServer.id]?.[activeNickLower] : undefined)
    : undefined;
  const trimmedAwayReason = rawAwayReason?.trim();
  const awayReason = trimmedAwayReason && trimmedAwayReason.toLowerCase() !== "away" ? trimmedAwayReason : undefined;
  const isAway = activeServer
    ? !!awayUsersMap[activeServer.id]?.[nicknameLower] ||
      (isSelf && (!!selfAwayMap[activeServer.id] || !!awayUsersMap[activeServer.id]?.[activeNickLower]))
    : false;

  const onOpenDM = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (!activeServer || isSelf) return;

    let targetMember = activeServer.members.find(
      (m) => m.id === freshMember.id || m.profile.name.toLowerCase() === freshMember.profile.name.toLowerCase()
    );

    if (!targetMember) {
      targetMember = useMockStore.getState().addServerMember(activeServer.id, nickname);
    }

    if (!targetMember) return;

    openConversation(activeServer.id, targetMember.id);
    navigate(`/servers/${activeServer.id}/conversations/${targetMember.id}`);
  };

  const onOpenWhois = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (!activeServer) return;

    try {
      await requestWhois(activeServer.id, nickname);
    } catch (error) {
      const detail = String(error || "The WHOIS request could not be sent.")
        .replace(/[\r\n\u0000]/g, " ")
        .trim();
      useModalStore.getState().onOpen("ircError", {
        title: "WHOIS request failed",
        description: detail,
      });
    }
  };

  return (
    <HoverCard openDelay={150} closeDelay={300}>
      <UserContextMenu member={freshMember} server={activeServer} channel={activeChannel}>
        <HoverCardTrigger asChild>
          {children}
        </HoverCardTrigger>
      </UserContextMenu>
      <HoverCardContent
        side={side}
        align={align}
        sideOffset={4}
        className="w-80 p-0 shadow-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#313338]"
      >
        <div className="overflow-hidden rounded-xl">
          <div className="relative h-[74px] overflow-hidden bg-indigo-600">
            <div className="absolute -right-10 -top-16 h-40 w-40 rounded-full bg-violet-400/30 blur-2xl" />
            <div className="absolute -bottom-20 left-1/3 h-36 w-36 rounded-full bg-indigo-300/20 blur-2xl" />
          </div>

          <div className="relative px-4 pb-4">
            <div className="-mt-9 flex items-end justify-between gap-3">
              <div className="relative shrink-0">
                <UserAvatar
                  src={freshMember.profile.imageUrl}
                  name={displayName}
                  className="h-[72px] w-[72px] border-4 border-white shadow-lg dark:border-[#313338]"
                />
                <ActionTooltip label={awayReason ? `Away: ${awayReason}` : isAway ? "Away" : "Online"} side="right">
                  <span
                    role="img"
                    aria-label={awayReason ? `Away: ${awayReason}` : isAway ? "Away" : "Online"}
                    className={`absolute bottom-0.5 right-0.5 h-4 w-4 rounded-full border-[3px] border-white dark:border-[#313338] ${isAway ? "bg-zinc-400 dark:bg-zinc-500" : "bg-emerald-500"}`}
                  />
                </ActionTooltip>
              </div>
              <div className="pb-1 text-right text-[11px] text-zinc-500 dark:text-zinc-400">
                {activeServer?.name || activeServer?.host || "IRC server"}
              </div>
            </div>

            <div className="mt-3 space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="min-w-0 truncate text-lg font-bold leading-tight text-zinc-900 dark:text-zinc-100">
                  {displayName}
                </h4>
                {highestRole && (
                  <UserRoleIcon role={highestRole} showLabel showTooltip={false} />
                )}
              </div>
              <p className="truncate font-mono text-xs text-zinc-500 dark:text-zinc-400">
                @{nickname}
              </p>
              <div className="flex items-center gap-1.5 pt-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">
                <span className={`h-2 w-2 rounded-full ${isAway ? "bg-zinc-400 dark:bg-zinc-500" : "bg-emerald-500"}`} />
                {isAway ? "Away" : "Online"}
                {awayReason && (
                  <span className="truncate font-normal text-zinc-400 dark:text-zinc-500" title={awayReason}>
                    — {awayReason}
                  </span>
                )}
              </div>
            </div>

            <div className="my-4 h-px bg-zinc-200 dark:bg-zinc-700/70" />

            <div className="space-y-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                User information
              </p>
              <div className="space-y-2 rounded-lg bg-zinc-100/80 p-3 dark:bg-[#2b2d31]">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-zinc-500 dark:text-zinc-400">Username</span>
                  <span className="truncate font-mono text-zinc-800 dark:text-zinc-200">{nickname}</span>
                </div>
                {displayName !== nickname && (
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-zinc-500 dark:text-zinc-400">Real name</span>
                    <span className="truncate text-zinc-800 dark:text-zinc-200">{displayName}</span>
                  </div>
                )}
                {freshMember.profile.host && (
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-zinc-500 dark:text-zinc-400">Host</span>
                    <span className="max-w-[175px] truncate font-mono text-zinc-800 dark:text-zinc-200" title={freshMember.profile.host}>
                      {freshMember.profile.host}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {activeServer && (
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button
                  onClick={onOpenWhois}
                  size="sm"
                  variant="outline"
                  className="h-9 gap-x-1.5 border-zinc-200 bg-zinc-50 px-2 text-xs font-semibold text-zinc-700 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300"
                  title="View WHOIS details"
                >
                  <Info className="h-3.5 w-3.5" />
                  Details
                </Button>
                {!isSelf ? (
                  <Button
                    onClick={onOpenDM}
                    size="sm"
                    className="h-9 gap-x-1.5 bg-indigo-600 px-2 text-xs font-semibold text-white transition hover:bg-indigo-700"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    Message
                  </Button>
                ) : (
                  <div className="flex items-center justify-center rounded-md bg-zinc-100 text-xs font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                    Your profile
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </HoverCardContent>
      </HoverCard>
  );
};

