import { Member, Profile, Server, UserDisplayNameMode } from "@/types";
import { useMockStore, getServerActiveNick } from "@/lib/mock-store";

export const getMemberDisplayName = (
  member: Member & { profile: Profile },
  server?: Server
): string => {
  if (!member || !member.profile) return "";
  const nickname = member.profile.name;

  const state = useMockStore.getState();
  const globalMode: UserDisplayNameMode = state.userDisplayNameMode || "nickname";
  const serverMode = server?.displayNameMode || "default";

  const effectiveMode: UserDisplayNameMode =
    serverMode === "default" ? globalMode : serverMode;

  if (effectiveMode === "realname") {
    const activeNick = server ? getServerActiveNick(server) : "";
    const currentProfile = state.currentProfile;
    const isSelf =
      (currentProfile && member.profileId === currentProfile.id) ||
      (activeNick && nickname.toLowerCase() === activeNick.toLowerCase());

    if (isSelf && server?.realname && server.realname.trim().length > 0 && server.realname.toLowerCase() !== "realname") {
      return server.realname;
    }

    if (member.profile.realname && member.profile.realname.trim().length > 0 && member.profile.realname.toLowerCase() !== "realname") {
      return member.profile.realname;
    }

    return nickname;
  }

  if (effectiveMode === "username") {
    if (member.profile.host && member.profile.host.trim().length > 0 && member.profile.host !== "127.0.0.1") {
      const atIdx = member.profile.host.indexOf("@");
      if (atIdx > 0) {
        const ident = member.profile.host.substring(0, atIdx).replace(/^~/, "").trim();
        if (ident.length > 0) return ident;
      }
      return member.profile.host;
    }
    if (member.profile.userId && member.profile.userId.trim().length > 0 && !member.profile.userId.startsWith("user-")) {
      return member.profile.userId;
    }
    return nickname;
  }

  return nickname;
};
