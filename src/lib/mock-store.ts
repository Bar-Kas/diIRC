import { create } from "zustand";
import { 
  Server, 
  Channel, 
  Member, 
  Message, 
  DirectMessage, 
  Profile, 
  ChannelType, 
  MemberRole 
} from "@/types";
import { 
  INITIAL_SERVERS, 
  INITIAL_MESSAGES, 
  INITIAL_DIRECT_MESSAGES, 
  MOCK_PROFILE 
} from "./mock-data";
import { v4 as uuidv4 } from "uuid";

interface MockState {
  currentProfile: Profile;
  servers: Server[];
  messages: Record<string, Message[]>;
  directMessages: Record<string, DirectMessage[]>;

  // Server Actions
  addServer: (name: string, imageUrl: string) => Server;
  updateServer: (serverId: string, name: string, imageUrl: string) => void;
  deleteServer: (serverId: string) => void;
  joinServerByInvite: (inviteCode: string) => Server | null;
  updateInviteCode: (serverId: string) => string;

  // Channel Actions
  addChannel: (serverId: string, name: string, type: ChannelType) => Channel;
  updateChannel: (serverId: string, channelId: string, name: string, type: ChannelType) => void;
  deleteChannel: (serverId: string, channelId: string) => void;

  // Member Actions
  updateMemberRole: (serverId: string, memberId: string, role: MemberRole) => void;
  removeMember: (serverId: string, memberId: string) => void;

  // Message Actions
  addMessage: (channelId: string, member: Member, content: string, fileUrl?: string | null) => Message;
  editMessage: (channelId: string, messageId: string, content: string) => void;
  deleteMessage: (channelId: string, messageId: string) => void;

  // Direct Message Actions
  addDirectMessage: (conversationId: string, member: Member, content: string, fileUrl?: string | null) => DirectMessage;
  editDirectMessage: (conversationId: string, messageId: string, content: string) => void;
  deleteDirectMessage: (conversationId: string, messageId: string) => void;
}

export const useMockStore = create<MockState>((set, get) => ({
  currentProfile: MOCK_PROFILE,
  servers: INITIAL_SERVERS,
  messages: INITIAL_MESSAGES,
  directMessages: INITIAL_DIRECT_MESSAGES,

  addServer: (name, imageUrl) => {
    const newServerId = `server-${uuidv4().slice(0, 8)}`;
    const newChannelId = `channel-${uuidv4().slice(0, 8)}`;
    const newMemberId = `member-${uuidv4().slice(0, 8)}`;

    const newServer: Server = {
      id: newServerId,
      name,
      imageUrl: imageUrl || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&auto=format&fit=crop&q=80",
      inviteCode: `invite-${uuidv4().slice(0, 8)}`,
      profileId: get().currentProfile.id,
      channels: [
        {
          id: newChannelId,
          name: "general",
          type: ChannelType.TEXT,
          profileId: get().currentProfile.id,
          serverId: newServerId,
        }
      ],
      members: [
        {
          id: newMemberId,
          role: MemberRole.ADMIN,
          profileId: get().currentProfile.id,
          profile: get().currentProfile,
          serverId: newServerId,
        }
      ]
    };

    set((state) => ({
      servers: [...state.servers, newServer],
    }));

    return newServer;
  },

  updateServer: (serverId, name, imageUrl) => {
    set((state) => ({
      servers: state.servers.map((s) =>
        s.id === serverId
          ? { ...s, name: name || s.name, imageUrl: imageUrl || s.imageUrl }
          : s
      ),
    }));
  },

  deleteServer: (serverId) => {
    set((state) => ({
      servers: state.servers.filter((s) => s.id !== serverId),
    }));
  },

  joinServerByInvite: (inviteCode) => {
    const existing = get().servers.find((s) => s.inviteCode === inviteCode);
    if (existing) return existing;

    // Create a mock server joined by invite if not already existing
    const newServer = get().addServer(`Joined Server (${inviteCode.slice(0, 5)})`, "");
    return newServer;
  },

  updateInviteCode: (serverId) => {
    const newCode = `invite-${uuidv4().slice(0, 8)}`;
    set((state) => ({
      servers: state.servers.map((s) =>
        s.id === serverId ? { ...s, inviteCode: newCode } : s
      ),
    }));
    return newCode;
  },

  addChannel: (serverId, name, type) => {
    const newChannel: Channel = {
      id: `channel-${uuidv4().slice(0, 8)}`,
      name: name.toLowerCase().replace(/\s+/g, "-"),
      type,
      profileId: get().currentProfile.id,
      serverId,
    };

    set((state) => ({
      servers: state.servers.map((s) =>
        s.id === serverId
          ? { ...s, channels: [...s.channels, newChannel] }
          : s
      ),
    }));

    return newChannel;
  },

  updateChannel: (serverId, channelId, name, type) => {
    set((state) => ({
      servers: state.servers.map((s) =>
        s.id === serverId
          ? {
              ...s,
              channels: s.channels.map((c) =>
                c.id === channelId
                  ? { ...c, name: name.toLowerCase().replace(/\s+/g, "-"), type }
                  : c
              ),
            }
          : s
      ),
    }));
  },

  deleteChannel: (serverId, channelId) => {
    set((state) => ({
      servers: state.servers.map((s) =>
        s.id === serverId
          ? { ...s, channels: s.channels.filter((c) => c.id !== channelId) }
          : s
      ),
    }));
  },

  updateMemberRole: (serverId, memberId, role) => {
    set((state) => ({
      servers: state.servers.map((s) =>
        s.id === serverId
          ? {
              ...s,
              members: s.members.map((m) =>
                m.id === memberId ? { ...m, role } : m
              ),
            }
          : s
      ),
    }));
  },

  removeMember: (serverId, memberId) => {
    set((state) => ({
      servers: state.servers.map((s) =>
        s.id === serverId
          ? { ...s, members: s.members.filter((m) => m.id !== memberId) }
          : s
      ),
    }));
  },

  addMessage: (channelId, member, content, fileUrl) => {
    const newMessage: Message = {
      id: `msg-${uuidv4().slice(0, 8)}`,
      content,
      fileUrl: fileUrl || null,
      memberId: member.id,
      member,
      channelId,
      deleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    set((state) => ({
      messages: {
        ...state.messages,
        [channelId]: [...(state.messages[channelId] || []), newMessage],
      },
    }));

    return newMessage;
  },

  editMessage: (channelId, messageId, content) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [channelId]: (state.messages[channelId] || []).map((m) =>
          m.id === messageId ? { ...m, content, updatedAt: new Date().toISOString() } : m
        ),
      },
    }));
  },

  deleteMessage: (channelId, messageId) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [channelId]: (state.messages[channelId] || []).map((m) =>
          m.id === messageId ? { ...m, content: "This message has been deleted.", deleted: true } : m
        ),
      },
    }));
  },

  addDirectMessage: (conversationId, member, content, fileUrl) => {
    const newDm: DirectMessage = {
      id: `dm-${uuidv4().slice(0, 8)}`,
      content,
      fileUrl: fileUrl || null,
      memberId: member.id,
      member,
      conversationId,
      deleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    set((state) => ({
      directMessages: {
        ...state.directMessages,
        [conversationId]: [...(state.directMessages[conversationId] || []), newDm],
      },
    }));

    return newDm;
  },

  editDirectMessage: (conversationId, messageId, content) => {
    set((state) => ({
      directMessages: {
        ...state.directMessages,
        [conversationId]: (state.directMessages[conversationId] || []).map((m) =>
          m.id === messageId ? { ...m, content, updatedAt: new Date().toISOString() } : m
        ),
      },
    }));
  },

  deleteDirectMessage: (conversationId, messageId) => {
    set((state) => ({
      directMessages: {
        ...state.directMessages,
        [conversationId]: (state.directMessages[conversationId] || []).map((m) =>
          m.id === messageId ? { ...m, content: "This message has been deleted.", deleted: true } : m
        ),
      },
    }));
  },
}));
