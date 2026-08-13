import { Profile, Server, Message, DirectMessage } from "@/types";

export const MOCK_PROFILE: Profile = {
  id: "profile-user-1",
  userId: "clerk-user-1",
  name: "User",
  imageUrl: "",
  email: "user@example.com",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const MOCK_MEMBERS_PROFILES: Profile[] = [
  MOCK_PROFILE,
  {
    id: "profile-user-2",
    userId: "clerk-user-2",
    name: "Sarah Connor",
    imageUrl: "",
    email: "sarah@example.com",
  },
  {
    id: "profile-user-3",
    userId: "clerk-user-3",
    name: "Alex Dev",
    imageUrl: "",
    email: "alex@example.com",
  },
  {
    id: "profile-user-4",
    userId: "clerk-user-4",
    name: "Emily Watson",
    imageUrl: "",
    email: "emily@example.com",
  }
];

export const INITIAL_SERVERS: Server[] = [];

export const INITIAL_MESSAGES: Record<string, Message[]> = {};

export const INITIAL_DIRECT_MESSAGES: Record<string, DirectMessage[]> = {};
