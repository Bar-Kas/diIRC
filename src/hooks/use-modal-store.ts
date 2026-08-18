import { Channel, ChannelType, Server } from "@/types";
import { create } from "zustand";

export type ModalType = 
  | "createServer" 
  | "invite" 
  | "editServer" 
  | "members" 
  | "createChannel" 
  | "leaveServer" 
  | "deleteServer" 
  | "deleteChannel" 
  | "settings"
  | "imagePreview"
  | "ircError";

interface ModalData {
  server?: Server;
  channel?: Channel;
  channelType?: ChannelType;
  apiUrl?: string;
  query?: Record<string, string | number | boolean | undefined>;
  url?: string;
}

interface ModalStore {
  type: ModalType | null;
  data: ModalData;
  isOpen: boolean;
  onOpen: (type: ModalType, data?: ModalData) => void;
  onClose: () => void;
}

export const useModal = create<ModalStore>((set) => ({
  type: null,
  data: {},
  isOpen: false,
  onOpen: (type, data = {}) => set({ isOpen: true, type, data }),
  onClose: () => set({ type: null, isOpen: false })
}));

export const useModalStore = useModal;

