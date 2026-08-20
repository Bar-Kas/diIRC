import { Settings, Sparkles } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useModal } from "@/hooks/use-modal-store";
import { Button } from "@/components/ui/button";

export const ChannelSettingsModal = () => {
  const { isOpen, onClose, type, data } = useModal();

  const isModalOpen = isOpen && type === "channelSettings";
  const { channel } = data;

  const handleClose = () => {
    onClose("channelSettings");
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="bg-white dark:bg-[#313338] text-black dark:text-white p-0 overflow-hidden sm:max-w-md">
        <DialogHeader className="pt-8 px-6">
          <DialogTitle className="text-xl text-center font-bold flex items-center justify-center gap-2">
            <Settings className="w-5 h-5 text-indigo-500" />
            Channel settings
          </DialogTitle>
          <p className="text-center text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            General settings for <span className="font-semibold text-indigo-500">#{channel?.name}</span>
          </p>
        </DialogHeader>

        <div className="px-6 py-8 flex flex-col items-center justify-center text-center space-y-3">
          <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-100">
            Coming soon
          </h3>
        </div>

        <div className="bg-zinc-100 dark:bg-zinc-800/40 px-6 py-3 flex justify-end">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            className="text-xs"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
