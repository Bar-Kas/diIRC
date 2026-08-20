
export enum ChannelType {
  TEXT = "TEXT"
}

export interface Profile {
  id: string;
  userId: string;
  name: string;
  realname?: string;
  imageUrl: string;
  email: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Member {
  id: string;
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
  topic?: string;
  key?: string;
  modes?: string[];
  isTemporary?: boolean;
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
  isSystem?: boolean;
  createdAt: string;
  updatedAt: string;
  /** Byte offset in the native log (windowed pagination). */
  offset?: number;
}

export interface DirectMessage {
  id: string;
  content: string;
  fileUrl?: string | null;
  memberId: string;
  member: Member;
  conversationId: string;
  deleted: boolean;
  isSystem?: boolean;
  createdAt: string;
  updatedAt: string;
  /** Byte offset in the native log (windowed pagination). */
  offset?: number;
}

export interface LogEntry {
  timestamp: string;
  sender: string;
  content: string;
  /** Byte offset of the line start in the native log file (used for windowed pagination). */
  offset?: number;
}

export interface LogPage {
  entries: LogEntry[];
  nextOffset: number | null;
  /** Forward-pagination cursor: offset of the last returned line (continue from here). */
  nextAfter?: number | null;
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
  host?: string;
  port?: number;
  nicknames?: string[];
  realname?: string;
  password?: string;
  useTls?: boolean;
  autoJoinChannels?: string[];
}

export type ServerWithMembersWithProfiles = Server;

export type StatusDisplayMode = "always" | "on_error" | "disabled";


