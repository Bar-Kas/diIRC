import { ChannelType, MemberRole, Profile, Server, Message, DirectMessage } from "@/types";

export const MOCK_PROFILE: Profile = {
  id: "profile-user-1",
  userId: "clerk-user-1",
  name: "Kawish Ali",
  imageUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
  email: "kawish@example.com",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const MOCK_MEMBERS_PROFILES: Profile[] = [
  MOCK_PROFILE,
  {
    id: "profile-user-2",
    userId: "clerk-user-2",
    name: "Sarah Connor",
    imageUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
    email: "sarah@example.com",
  },
  {
    id: "profile-user-3",
    userId: "clerk-user-3",
    name: "Alex Dev",
    imageUrl: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80",
    email: "alex@example.com",
  },
  {
    id: "profile-user-4",
    userId: "clerk-user-4",
    name: "Emily Watson",
    imageUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&auto=format&fit=crop&q=80",
    email: "emily@example.com",
  }
];

export const INITIAL_SERVERS: Server[] = [
  {
    id: "server-1",
    name: "Local IRC (Ergo)",
    imageUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&auto=format&fit=crop&q=80",
    inviteCode: "community-invite-123",
    profileId: MOCK_PROFILE.id,
    channels: [
      {
        id: "channel-1",
        name: "test",
        type: ChannelType.TEXT,
        profileId: MOCK_PROFILE.id,
        serverId: "server-1",
      },
      {
        id: "channel-2",
        name: "announcements",
        type: ChannelType.TEXT,
        profileId: MOCK_PROFILE.id,
        serverId: "server-1",
      },
      {
        id: "channel-3",
        name: "Lounge Voice",
        type: ChannelType.AUDIO,
        profileId: MOCK_PROFILE.id,
        serverId: "server-1",
      },
      {
        id: "channel-4",
        name: "Video Hangout",
        type: ChannelType.VIDEO,
        profileId: MOCK_PROFILE.id,
        serverId: "server-1",
      },
    ],
    members: [
      {
        id: "member-1",
        role: MemberRole.ADMIN,
        profileId: MOCK_PROFILE.id,
        profile: MOCK_PROFILE,
        serverId: "server-1",
      },
      {
        id: "member-2",
        role: MemberRole.MODERATOR,
        profileId: MOCK_MEMBERS_PROFILES[1].id,
        profile: MOCK_MEMBERS_PROFILES[1],
        serverId: "server-1",
      },
      {
        id: "member-3",
        role: MemberRole.GUEST,
        profileId: MOCK_MEMBERS_PROFILES[2].id,
        profile: MOCK_MEMBERS_PROFILES[2],
        serverId: "server-1",
      },
      {
        id: "member-4",
        role: MemberRole.GUEST,
        profileId: MOCK_MEMBERS_PROFILES[3].id,
        profile: MOCK_MEMBERS_PROFILES[3],
        serverId: "server-1",
      },
    ],
  },
  {
    id: "server-2",
    name: "Dev Hub & Tech",
    imageUrl: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=200&auto=format&fit=crop&q=80",
    inviteCode: "devhub-456",
    profileId: MOCK_MEMBERS_PROFILES[2].id,
    channels: [
      {
        id: "channel-201",
        name: "welcome",
        type: ChannelType.TEXT,
        profileId: MOCK_MEMBERS_PROFILES[2].id,
        serverId: "server-2",
      },
      {
        id: "channel-202",
        name: "react-vite",
        type: ChannelType.TEXT,
        profileId: MOCK_MEMBERS_PROFILES[2].id,
        serverId: "server-2",
      },
      {
        id: "channel-203",
        name: "Code Sync",
        type: ChannelType.AUDIO,
        profileId: MOCK_MEMBERS_PROFILES[2].id,
        serverId: "server-2",
      },
    ],
    members: [
      {
        id: "member-201",
        role: MemberRole.ADMIN,
        profileId: MOCK_MEMBERS_PROFILES[2].id,
        profile: MOCK_MEMBERS_PROFILES[2],
        serverId: "server-2",
      },
      {
        id: "member-202",
        role: MemberRole.GUEST,
        profileId: MOCK_PROFILE.id,
        profile: MOCK_PROFILE,
        serverId: "server-2",
      },
    ],
  },
  {
    id: "server-3",
    name: "Gaming Zone",
    imageUrl: "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=200&auto=format&fit=crop&q=80",
    inviteCode: "gaming-789",
    profileId: MOCK_MEMBERS_PROFILES[1].id,
    channels: [
      {
        id: "channel-301",
        name: "lfg-chat",
        type: ChannelType.TEXT,
        profileId: MOCK_MEMBERS_PROFILES[1].id,
        serverId: "server-3",
      },
      {
        id: "channel-302",
        name: "Squad 1",
        type: ChannelType.AUDIO,
        profileId: MOCK_MEMBERS_PROFILES[1].id,
        serverId: "server-3",
      },
    ],
    members: [
      {
        id: "member-301",
        role: MemberRole.ADMIN,
        profileId: MOCK_MEMBERS_PROFILES[1].id,
        profile: MOCK_MEMBERS_PROFILES[1],
        serverId: "server-3",
      },
      {
        id: "member-302",
        role: MemberRole.MODERATOR,
        profileId: MOCK_PROFILE.id,
        profile: MOCK_PROFILE,
        serverId: "server-3",
      },
    ],
  },
];

export const INITIAL_MESSAGES: Record<string, Message[]> = {
  "channel-1": [
    {
      id: "msg-irc-init",
      content: "🟢 Connected to local IRC server (ergochat/ergo at 127.0.0.1:6667). Active channel: #test. Type a message below to send!",
      memberId: "member-1",
      member: INITIAL_SERVERS[0].members[0],
      channelId: "channel-1",
      deleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  "channel-2": [
    {
      id: "msg-201",
      content: "📢 Announcement: The React 18 + Vite frontend migration was completed successfully!",
      memberId: "member-1",
      member: INITIAL_SERVERS[0].members[0],
      channelId: "channel-2",
      deleted: false,
      createdAt: new Date(Date.now() - 7200000).toISOString(),
      updatedAt: new Date(Date.now() - 7200000).toISOString(),
    }
  ]
};

export const INITIAL_DIRECT_MESSAGES: Record<string, DirectMessage[]> = {
  "conversation-member-2": [
    {
      id: "dm-1",
      content: "Hey Sarah! Testing out direct messages in our new React Vite SPA.",
      memberId: "member-1",
      member: INITIAL_SERVERS[0].members[0],
      conversationId: "conversation-member-2",
      deleted: false,
      createdAt: new Date(Date.now() - 1200000).toISOString(),
      updatedAt: new Date(Date.now() - 1200000).toISOString(),
    },
    {
      id: "dm-2",
      content: "Looks fantastic! The modal open/close states and navigation feel super snappy.",
      memberId: "member-2",
      member: INITIAL_SERVERS[0].members[1],
      conversationId: "conversation-member-2",
      deleted: false,
      createdAt: new Date(Date.now() - 600000).toISOString(),
      updatedAt: new Date(Date.now() - 600000).toISOString(),
    }
  ]
};
