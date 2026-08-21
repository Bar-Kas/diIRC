import React from "react";
import { Channel, Member, Profile, Server } from "@/types";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useMockStore } from "@/lib/mock-store";
import { UserRoleIcon, getHighestChannelRole } from "@/components/user-role-icon";
import { UserContextMenu } from "@/components/user-context-menu";

interface UserHoverCardProps {
  member: Member & { profile: Profile };
  server?: Server;
  channel?: Channel;
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
}

export const getMemberDisplayName = (
  member: Member & { profile: Profile },
  server?: Server
): string => {
  const currentProfile = useMockStore.getState().currentProfile;
  const isSelf =
    member.profileId === currentProfile.id ||
    (server?.nicknames?.[0] &&
      member.profile.name.toLowerCase() === server.nicknames[0].toLowerCase());

  if (isSelf && server?.realname && server.realname.trim().length > 0) {
    return server.realname;
  }

  if (member.profile.realname && member.profile.realname.trim().length > 0) {
    return member.profile.realname;
  }

  return member.profile.name;
};

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

  const activeServer = server || servers[0];
  const activeChannel = customChannel || activeServer?.channels.find((c) => c.id === params?.channelId);
  const nickname = member.profile.name;

  const userModes = activeChannel ? channelUserModesMap[activeChannel.id]?.[nickname.toLowerCase()] || [] : [];
  const highestRole = getHighestChannelRole(userModes);

  const displayName = getMemberDisplayName(member, activeServer);
  const isSelf =
    member.profileId === currentProfile.id ||
    (activeServer?.nicknames?.[0] &&
      member.profile.name.toLowerCase() === activeServer.nicknames[0].toLowerCase());

  const onOpenDM = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (!activeServer || isSelf) return;

    let targetMember = activeServer.members.find(
      (m) => m.id === member.id || m.profile.name.toLowerCase() === member.profile.name.toLowerCase()
    );

    if (!targetMember) {
      targetMember = useMockStore.getState().addServerMember(activeServer.id, nickname);
    }

    if (!targetMember) return;

    openConversation(activeServer.id, targetMember.id);
    navigate(`/servers/${activeServer.id}/conversations/${targetMember.id}`);
  };

  return (
    <HoverCard openDelay={150} closeDelay={300}>
      <UserContextMenu member={member} server={activeServer} channel={activeChannel}>
        <HoverCardTrigger asChild>
          {children}
        </HoverCardTrigger>
      </UserContextMenu>
      <HoverCardContent
        side={side}
        align={align}
        sideOffset={4}
        className="w-72 p-0 overflow-hidden shadow-2xl border border-zinc-200 dark:border-zinc-700/80 bg-white dark:bg-[#1e1f22]"
      >
          {/* Card Header Banner */}
          <div className="h-16 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 relative" />

          {/* Card Body */}
          <div className="px-4 pb-4 pt-0 relative">
            {/* Avatar floating above boundary */}
            <div className="-mt-10 mb-3 flex items-end justify-between">
              <div className="ring-4 ring-white dark:ring-[#1e1f22] rounded-full overflow-hidden shadow-lg bg-[#1e1f22]">
                <UserAvatar
                  src={member.profile.imageUrl}
                  name={displayName}
                  className="h-16 w-16 md:h-16 md:w-16"
                />
              </div>
              {!isSelf && activeServer && (
                <Button
                  onClick={onOpenDM}
                  size="sm"
                  className="h-8 gap-x-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-medium shadow-sm transition"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Message
                </Button>
              )}
            </div>

            {/* User Names & Details */}
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-x-2">
                <h4 className="font-bold text-base text-zinc-900 dark:text-zinc-100 leading-tight truncate">
                  {displayName}
                </h4>
                {highestRole && (
                  <UserRoleIcon role={highestRole} showLabel showTooltip={false} />
                )}
              </div>
              <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
                @{nickname}
              </p>
            </div>

            {/* Additional details section */}
            <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 text-[11px] text-zinc-500 dark:text-zinc-400 space-y-1">
              <div className="flex justify-between">
                <span className="font-medium">Username:</span>
                <span className="font-mono text-zinc-700 dark:text-zinc-300">{nickname}</span>
              </div>
              {displayName !== nickname && (
                <div className="flex justify-between">
                  <span className="font-medium">RealName:</span>
                  <span className="font-sans text-zinc-700 dark:text-zinc-300">{displayName}</span>
                </div>
              )}
            </div>
          </div>
        </HoverCardContent>
      </HoverCard>
  );
};

