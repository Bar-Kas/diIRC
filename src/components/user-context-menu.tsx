import React from "react";
import { Channel, Member, Profile, Server } from "@/types";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useMockStore } from "@/lib/mock-store";
import { inviteUserToChannel } from "@/lib/irc-actions";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";
import { MessageSquare, ShieldAlert, ShieldOff, Mic, MicOff, UserPlus, Hash } from "lucide-react";

interface UserContextMenuProps {
  member: Member & { profile: Profile };
  server?: Server;
  channel?: Channel;
  children: React.ReactNode;
}

export const UserContextMenu: React.FC<UserContextMenuProps> = ({
  member,
  server,
  channel,
  children,
}) => {
  const navigate = useNavigate();
  const currentProfile = useMockStore((state) => state.currentProfile);
  const servers = useMockStore((state) => state.servers);
  const openConversation = useMockStore((state) => state.openConversation);
  const channelUserModesMap = useMockStore((state) => state.channelUserModes);
  const channelOpsMap = useMockStore((state) => state.channelOps);
  const channelModesMap = useMockStore((state) => state.channelModes);

  const activeServer = server || servers[0];
  const nickname = member.profile.name;

  const ourNick = activeServer?.nicknames?.[0] || currentProfile.name;
  const ourUserModes = channel
    ? channelUserModesMap[channel.id]?.[ourNick.toLowerCase()] || []
    : [];

  const canManageOp = ourUserModes.some((m) => ["o", "a", "q"].includes(m.toLowerCase()));
  const canManageVoice = ourUserModes.some((m) => ["o", "a", "q", "h"].includes(m.toLowerCase()));

  const userModes = channel
    ? channelUserModesMap[channel.id]?.[nickname.toLowerCase()] || []
    : [];

  const isOp = userModes.includes("o");
  const isVoice = userModes.includes("v");

  const isSelf =
    member.profileId === currentProfile.id ||
    (activeServer?.nicknames?.[0] &&
      nickname.toLowerCase() === activeServer.nicknames[0].toLowerCase());

  // Channels on activeServer where our current user is operator AND channel is invite-only (+i)
  const eligibleInviteChannels = activeServer
    ? activeServer.channels.filter((c) => {
        const uModes = channelUserModesMap[c.id]?.[ourNick.toLowerCase()] || [];
        const isOpInUserModes = uModes.some((m) => ["o", "a", "q", "h"].includes(m.toLowerCase()));
        const isOpInOpsList = (channelOpsMap[c.id] || []).some(
          (op) => op.toLowerCase() === ourNick.toLowerCase()
        );
        const isOperator = isOpInUserModes || isOpInOpsList;

        const flags = channelModesMap[c.id] || c.modes || [];
        const isInviteOnly = flags.length > 0 ? flags.includes("i") : !!c.isTemporary;

        return isOperator && isInviteOnly;
      })
    : [];

  const onOpenDM = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeServer || isSelf) return;

    let targetMember = activeServer.members.find(
      (m) =>
        m.id === member.id ||
        m.profile.name.toLowerCase() === nickname.toLowerCase()
    );

    if (!targetMember) {
      targetMember = useMockStore
        .getState()
        .addServerMember(activeServer.id, nickname);
    }

    if (!targetMember) return;

    openConversation(activeServer.id, targetMember.id);
    navigate(`/servers/${activeServer.id}/conversations/${targetMember.id}`);
  };

  const handleInviteToChannel = async (e: React.MouseEvent, targetChannelName: string) => {
    e.stopPropagation();
    if (!activeServer || !nickname) return;
    await inviteUserToChannel(activeServer.id, nickname, targetChannelName);
  };

  const handleToggleOp = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeServer || !channel || !canManageOp) return;

    const channelTarget =
      channel.name.startsWith("#") || channel.name.startsWith("&")
        ? channel.name
        : `#${channel.name}`;

    try {
      await invoke("send_mode", {
        serverId: activeServer.id,
        target: channelTarget,
        mode: isOp ? "-o" : "+o",
        params: [nickname],
      });
    } catch (err) {
      console.error("Failed to toggle op via context menu:", err);
      invoke("refresh_channel_names", {
        serverId: activeServer.id,
        channel: channelTarget,
      }).catch(() => {});
    }
  };

  const handleToggleVoice = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeServer || !channel || !canManageVoice) return;

    const channelTarget =
      channel.name.startsWith("#") || channel.name.startsWith("&")
        ? channel.name
        : `#${channel.name}`;

    try {
      await invoke("send_mode", {
        serverId: activeServer.id,
        target: channelTarget,
        mode: isVoice ? "-v" : "+v",
        params: [nickname],
      });
    } catch (err) {
      console.error("Failed to toggle voice via context menu:", err);
      invoke("refresh_channel_names", {
        serverId: activeServer.id,
        channel: channelTarget,
      }).catch(() => {});
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-52 select-none">
        {!isSelf && activeServer && (
          <>
            <ContextMenuItem onClick={onOpenDM} className="gap-x-2">
              <MessageSquare className="w-4 h-4 text-zinc-500" />
              <span>Private message</span>
            </ContextMenuItem>

            <ContextMenuSub>
              <ContextMenuSubTrigger className="gap-x-2">
                <UserPlus className="w-4 h-4 text-zinc-500" />
                <span>Invite to channel</span>
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className="w-48">
                {eligibleInviteChannels.length > 0 ? (
                  eligibleInviteChannels.map((chan) => (
                    <ContextMenuItem
                      key={chan.id}
                      onClick={(e) => handleInviteToChannel(e, chan.name)}
                      className="gap-x-2 cursor-pointer"
                    >
                      <Hash className="w-4 h-4 text-zinc-500 shrink-0" />
                      <span className="truncate">#{chan.name}</span>
                    </ContextMenuItem>
                  ))
                ) : (
                  <ContextMenuItem disabled className="text-zinc-400 dark:text-zinc-500 text-xs">
                    No channels available
                  </ContextMenuItem>
                )}
              </ContextMenuSubContent>
            </ContextMenuSub>

            {channel && <ContextMenuSeparator />}
          </>
        )}

        {channel && (
          <>
            <ContextMenuItem onClick={handleToggleOp} disabled={!canManageOp} className="gap-x-2">
              {isOp ? (
                <>
                  <ShieldOff className="w-4 h-4 text-amber-500" />
                  <span>Remove operator (-o)</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="w-4 h-4 text-emerald-500" />
                  <span>Give operator (+o)</span>
                </>
              )}
            </ContextMenuItem>

            <ContextMenuItem onClick={handleToggleVoice} disabled={!canManageVoice} className="gap-x-2">
              {isVoice ? (
                <>
                  <MicOff className="w-4 h-4 text-red-500" />
                  <span>Remove voice (-v)</span>
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4 text-blue-500" />
                  <span>Give voice (+v)</span>
                </>
              )}
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
};
