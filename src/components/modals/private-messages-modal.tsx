import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useModal } from "@/hooks/use-modal-store";
import { MessageSquare } from "lucide-react";

export const PrivateMessagesModal = () => {
  const { isOpen, onClose, type } = useModal();
  const isModalOpen = isOpen && type === "privateMessages";

  const handleClose = () => {
    onClose("privateMessages");
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="bg-white dark:bg-[#313338] text-zinc-900 dark:text-zinc-100 p-0 max-w-md overflow-hidden rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800">
        <DialogHeader className="pt-6 px-6 pb-2">
          <DialogTitle className="text-xl font-bold flex items-center gap-x-2">
            <MessageSquare className="w-5 h-5 text-indigo-500" />
            Private messages
          </DialogTitle>
        </DialogHeader>

        <div className="p-6 flex flex-col items-center justify-center text-center space-y-2">
          <p className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
            Coming soon
          </p>
        </div>

        <div className="p-4 bg-zinc-100 dark:bg-[#2b2d31] flex justify-end border-t border-zinc-200 dark:border-zinc-800">
          <Button onClick={handleClose} variant="secondary" className="px-5 text-xs font-semibold">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
