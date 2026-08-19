import { create } from "zustand";

export interface AttachedImage {
  id: string;
  previewUrl: string;
  url?: string;
  name: string;
  isUploading: boolean;
}

export interface DraftData {
  content: string;
  attachedImages: AttachedImage[];
}

interface DraftStore {
  drafts: Record<string, DraftData>;
  setDraft: (id: string, draft: DraftData) => void;
  getDraft: (id: string) => DraftData;
  clearDraft: (id: string) => void;
}

export const useDraftStore = create<DraftStore>((set, get) => ({
  drafts: {},
  setDraft: (id, draft) =>
    set((state) => ({
      drafts: {
        ...state.drafts,
        [id]: draft,
      },
    })),
  getDraft: (id) =>
    get().drafts[id] || { content: "", attachedImages: [] },
  clearDraft: (id) =>
    set((state) => {
      const newDrafts = { ...state.drafts };
      delete newDrafts[id];
      return { drafts: newDrafts };
    }),
}));
