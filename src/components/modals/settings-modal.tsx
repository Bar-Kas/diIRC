import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useModal } from "@/hooks/use-modal-store";
import { useMockStore } from "@/lib/mock-store";
import { Settings, EyeOff } from "lucide-react";

export const SettingsModal = () => {
  const { isOpen, onClose, type } = useModal();
  const compactMode = useMockStore((state) => state.compactMode);
  const setCompactMode = useMockStore((state) => state.setCompactMode);

  const isModalOpen = isOpen && type === "settings";

  const handleClose = () => {
    onClose();
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-white dark:bg-[#313338] text-zinc-900 dark:text-zinc-100 p-0 overflow-hidden max-w-md border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-xl">
        <DialogHeader className="pt-6 px-6 space-y-1">
          <DialogTitle className="text-2xl text-center font-bold text-zinc-900 dark:text-zinc-100 flex items-center justify-center gap-x-2">
            <Settings className="w-6 h-6 text-indigo-500" />
            Settings
          </DialogTitle>
          <DialogDescription className="text-center text-zinc-500 dark:text-zinc-400 text-xs sm:text-sm">
            Manage application appearance and display preferences.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-6 space-y-4">
          <div className="flex flex-row items-center justify-between rounded-xl border border-zinc-200 dark:border-zinc-700/60 bg-zinc-50 dark:bg-[#2b2d31] p-4 shadow-sm transition">
            <div className="space-y-0.5 pr-4">
              <div className="flex items-center gap-x-2">
                <EyeOff className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                <label className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 cursor-pointer">
                  Compact Mode
                </label>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Hide all user avatars in the chat window.
              </p>
            </div>
            <Switch
              checked={compactMode}
              onCheckedChange={(checked) => setCompactMode(checked)}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
