export enum MemberRole {
  ADMIN = "ADMIN",
  MODERATOR = "MODERATOR",
  GUEST = "GUEST"
}

export enum ChannelType {
  TEXT = "TEXT",
  AUDIO = "AUDIO",
  VIDEO = "VIDEO"
}

export interface Profile {
  id: string;
  userId: string;
  name: string;
  imageUrl: string;
  email: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Member {
  id: string;
  role: MemberRole;
  profileId: string;
  profile: Profile;
  serverId: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Channel {
  id: string;
  name: string;
  type: ChannelType;
  profileId: string;
  serverId: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Message {
  id: string;
  content: string;
  fileUrl?: string | null;
  memberId: string;
  member: Member;
  channelId: string;
  deleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DirectMessage {
  id: string;
  content: string;
  fileUrl?: string | null;
  memberId: string;
  member: Member;
  conversationId: string;
  deleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  id: string;
  memberOneId: string;
  memberOne: Member;
  memberTwoId: string;
  memberTwo: Member;
  directMessages?: DirectMessage[];
}

export interface Server {
  id: string;
  name: string;
  imageUrl: string;
  inviteCode: string;
  profileId: string;
  channels: Channel[];
  members: Member[];
  createdAt?: string;
  updatedAt?: string;
}

export type ServerWithMembersWithProfiles = Server;
