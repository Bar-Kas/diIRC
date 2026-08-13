import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/file-upload";
import { useModal } from "@/hooks/use-modal-store";
import { useMockStore } from "@/lib/mock-store";

const formSchema = z.object({
  fileUrl: z.string().min(1, {
    message: "Attachment is required."
  })
});

export const MessageFileModal = () => {
  const { isOpen, onClose, type, data } = useModal();
  const addMessage = useMockStore((state) => state.addMessage);
  const addDirectMessage = useMockStore((state) => state.addDirectMessage);
  const servers = useMockStore((state) => state.servers);

  const isModalOpen = isOpen && type === "messageFile";
  const { query } = data;

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fileUrl: "",
    }
  });

  const handleClose = () => {
    form.reset();
    onClose();
  };

  const isLoading = form.formState.isSubmitting;

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      const activeServer = query?.serverId ? servers.find((s) => s.id === query.serverId) : servers[0];
      const currentProfile = useMockStore.getState().currentProfile;
      let currentMember = activeServer?.members.find((m) => m.profileId === currentProfile.id) || activeServer?.members[0];

      if (activeServer?.nicknames?.[0] && currentMember) {
        currentMember = {
          ...currentMember,
          profile: {
            ...currentMember.profile,
            name: activeServer.nicknames[0],
          },
        };
      }

      if (query?.channelId && currentMember) {
        addMessage(String(query.channelId), currentMember, "Attachment", values.fileUrl);
      } else if (query?.conversationId && currentMember) {
        addDirectMessage(String(query.conversationId), currentMember, "Attachment", values.fileUrl);
      }

      handleClose();
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-white dark:bg-[#313338] text-zinc-900 dark:text-zinc-100 p-0 overflow-hidden max-w-md border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-xl">
        <DialogHeader className="pt-6 px-6 space-y-1">
          <DialogTitle className="text-2xl text-center font-bold text-zinc-900 dark:text-zinc-100">
            Add an attachment
          </DialogTitle>
          <DialogDescription className="text-center text-zinc-500 dark:text-zinc-400">
            Send a file as a message
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-2">
            <div className="space-y-6 px-6">
              <div className="flex items-center justify-center text-center">
                <FormField
                  control={form.control}
                  name="fileUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <FileUpload
                          endpoint="messageFile"
                          value={field.value}
                          onChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>
            <DialogFooter className="bg-zinc-100/90 dark:bg-[#2b2d31] border-t border-zinc-200 dark:border-zinc-800/80 px-6 py-4 flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                onClick={handleClose}
                disabled={isLoading}
                className="text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white"
              >
                Cancel
              </Button>
              <Button variant="primary" disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6 shadow-sm">
                Send
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
