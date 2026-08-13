import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UIStore {
  showNavigationSidebar: boolean;
  showServerSidebar: boolean;
  showMembersSidebar: boolean;
  toggleNavigationSidebar: () => void;
  toggleServerSidebar: () => void;
  toggleMembersSidebar: () => void;
  setNavigationSidebar: (open: boolean) => void;
  setServerSidebar: (open: boolean) => void;
  setMembersSidebar: (open: boolean) => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      showNavigationSidebar: true,
      showServerSidebar: true,
      showMembersSidebar: true,
      toggleNavigationSidebar: () => set((state) => ({ showNavigationSidebar: !state.showNavigationSidebar })),
      toggleServerSidebar: () => set((state) => ({ showServerSidebar: !state.showServerSidebar })),
      toggleMembersSidebar: () => set((state) => ({ showMembersSidebar: !state.showMembersSidebar })),
      setNavigationSidebar: (open) => set({ showNavigationSidebar: open }),
      setServerSidebar: (open) => set({ showServerSidebar: open }),
      setMembersSidebar: (open) => set({ showMembersSidebar: open }),
    }),
    {
      name: "ui-sidebar-store",
    }
  )
);
