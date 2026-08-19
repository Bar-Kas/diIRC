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
  | "ircError"
  | "editTopic";

interface ModalData {
  server?: Server;
  channel?: Channel;
  channelType?: ChannelType;
  apiUrl?: string;
  query?: Record<string, string | number | boolean | undefined>;
  url?: string;
  title?: string;
  description?: string;
  errorMessage?: string;
}

interface ModalStore {
  type: ModalType | null;
  data: ModalData;
  isOpen: boolean;
  onOpen: (type: ModalType, data?: ModalData) => void;
  onClose: (closingType?: ModalType | unknown) => void;
}

export const useModal = create<ModalStore>((set) => ({
  type: null,
  data: {},
  isOpen: false,
  onOpen: (type, data = {}) => set({ isOpen: true, type, data }),
  onClose: (closingType?: ModalType | unknown) =>
    set((state) => {
      if (typeof closingType === "string" && state.type && state.type !== closingType) {
        return state;
      }
      return { type: null, isOpen: false, data: {} };
    }),
}));

export const useModalStore = useModal;

