import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useModal } from "@/hooks/use-modal-store";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export const IrcErrorModal = () => {
  const { isOpen, onClose, type } = useModal();

  const isModalOpen = isOpen && type === "ircError";

  return (
    <Dialog open={isModalOpen} onOpenChange={onClose}>
      <DialogContent className="bg-white dark:bg-[#313338] text-black dark:text-white p-0 overflow-hidden rounded-xl shadow-2xl border-none">
        <DialogHeader className="pt-8 px-6">
          <DialogTitle className="text-2xl text-center font-bold flex items-center justify-center gap-x-2 text-rose-500">
            <AlertTriangle className="w-6 h-6" />
            IRC Connection Error
          </DialogTitle>
          <DialogDescription className="text-center text-zinc-500 dark:text-zinc-400 mt-2">
            Cannot send message because you are disconnected from the IRC server. Please check your connection and try again.
          </DialogDescription>
        </DialogHeader>
        <div className="p-6 flex justify-center mt-2">
          <Button onClick={onClose} variant="primary" className="w-full">
            Got it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
