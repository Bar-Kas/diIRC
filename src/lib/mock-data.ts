import { Profile, Server, Message, DirectMessage } from "@/types";

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

export const INITIAL_SERVERS: Server[] = [];

export const INITIAL_MESSAGES: Record<string, Message[]> = {};

export const INITIAL_DIRECT_MESSAGES: Record<string, DirectMessage[]> = {};
