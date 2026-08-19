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
  const { isOpen, onClose, type, data } = useModal();

  const isModalOpen = isOpen && type === "ircError";
  const title = data.title || "IRC Error";
  const description =
    data.description ||
    data.errorMessage ||
    "Cannot send message because you are disconnected from the IRC server. Please check your connection and try again.";

  const handleClose = () => {
    onClose("ircError");
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="bg-white dark:bg-[#313338] text-black dark:text-white p-0 overflow-hidden rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800">
        <DialogHeader className="pt-8 px-6 space-y-2">
          <DialogTitle className="text-2xl text-center font-bold flex items-center justify-center gap-x-2 text-rose-500">
            <AlertTriangle className="w-6 h-6 shrink-0" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-center text-zinc-500 dark:text-zinc-400 mt-2">
            {description}
          </DialogDescription>
        </DialogHeader>
        <div className="p-6 flex justify-center mt-2">
          <Button onClick={handleClose} variant="primary" className="w-full">
            Got it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
