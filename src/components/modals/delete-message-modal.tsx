import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useModal } from "@/hooks/use-modal-store";
import { Button } from "@/components/ui/button";
import { useMockStore } from "@/lib/mock-store";

export const DeleteMessageModal = () => {
  const { isOpen, onClose, type, data } = useModal();
  const deleteMessage = useMockStore((state) => state.deleteMessage);
  const deleteDirectMessage = useMockStore((state) => state.deleteDirectMessage);

  const isModalOpen = isOpen && type === "deleteMessage";
  const { query } = data;

  const [isLoading, setIsLoading] = useState(false);

  const onClick = async () => {
    try {
      setIsLoading(true);
      if (query?.channelId && query?.messageId) {
        deleteMessage(String(query.channelId), String(query.messageId));
      } else if (query?.conversationId && query?.messageId) {
        deleteDirectMessage(String(query.conversationId), String(query.messageId));
      }

      onClose();
    } catch (error) {
      console.log(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={onClose}>
      <DialogContent className="bg-white dark:bg-[#313338] text-zinc-900 dark:text-zinc-100 p-0 overflow-hidden max-w-md border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-xl">
        <DialogHeader className="pt-6 px-6 space-y-2">
          <DialogTitle className="text-2xl text-center font-bold text-zinc-900 dark:text-zinc-100">
            Delete Message
          </DialogTitle>
          <DialogDescription className="text-center text-zinc-500 dark:text-zinc-400">
            Are you sure you want to do this? <br />
            The message will be permanently deleted.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="bg-zinc-100/90 dark:bg-[#2b2d31] border-t border-zinc-200 dark:border-zinc-800/80 px-6 py-4 flex items-center justify-between">
          <Button
            disabled={isLoading}
            onClick={onClose}
            variant="ghost"
            className="text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white"
          >
            Cancel
          </Button>
          <Button
            disabled={isLoading}
            onClick={onClick}
            className="bg-rose-600 hover:bg-rose-700 text-white font-medium px-6 shadow-sm"
          >
            Delete Message
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
