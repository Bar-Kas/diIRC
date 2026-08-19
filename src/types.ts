
export enum ChannelType {
  TEXT = "TEXT"
}

export type BufferKind = "channel" | "conversation";
export type BufferKey = string;

export interface BufferRef {
  key: BufferKey;
  serverId: string;
  kind: BufferKind;
  id: string;
  target: string;
}

export interface MessageAnchor {
  timestamp: string;
  messageId?: string;
  sender?: string;
  fingerprint?: string;
}

export interface BufferReadState {
  initialized: boolean;
  lastReadTimestamp: string | null;
  lastReadMessageId?: string;
  unreadCount: number;
  mentionCount: number;
  firstUnread: MessageAnchor | null;
  latestMessageTimestamp: string | null;
  latestMessageId?: string;
}

export interface ScrollGeometry {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  distanceFromBottom: number;
  distanceFromTop: number;
}

export interface ScrollViewportState {
  bufferKey: BufferKey;
  geometry: ScrollGeometry;
  isAtBottom: boolean;
  isAtTop: boolean;
  revision: number;
}

export interface MentionMatch {
  matched: boolean;
  source: "nickname" | "keyword" | null;
  value?: string;
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
  sourceTimestamp?: string;
  mention?: MentionMatch;
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
  isSystem?: boolean;
  sourceTimestamp?: string;
  mention?: MentionMatch;
  createdAt: string;
  updatedAt: string;
}

export interface LogEntry {
  timestamp: string;
  sender: string;
  content: string;
}

export interface LogPage {
  entries: LogEntry[];
  nextOffset: number | null;
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
  highlightKeywords?: string[];
}

export type ServerWithMembersWithProfiles = Server;


