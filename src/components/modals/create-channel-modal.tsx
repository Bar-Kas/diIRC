import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { ChannelType } from "@/types";
import { useParams, useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { HelpCircle } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { ChannelInput } from "@/components/ui/channel-input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useModal } from "@/hooks/use-modal-store";
import { useMockStore } from "@/lib/mock-store";

const formSchema = z.object({
  name: z.string().min(1, {
    message: "Channel name is required."
  }),
  joinTemporary: z.boolean().default(false)
});

export const CreateChannelModal = () => {
  const { isOpen, onClose, type, data } = useModal();
  const navigate = useNavigate();
  const params = useParams();
  const addChannel = useMockStore((state) => state.addChannel);
  const servers = useMockStore((state) => state.servers);

  const isModalOpen = isOpen && type === "createChannel";
  const { server: modalServer } = data;

  const activeServerId = params?.serverId || modalServer?.id || servers[0]?.id;

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      joinTemporary: false,
    }
  });

  const isLoading = form.formState.isSubmitting;

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      if (activeServerId) {
        const cleanChannelName = values.name.trim().replace(/^#/, "");
        const newChannel = addChannel(
          activeServerId,
          cleanChannelName,
          ChannelType.TEXT,
          values.joinTemporary
        );
        
        try {
          await invoke("join_channel", {
            serverId: activeServerId,
            channel: cleanChannelName
          });
        } catch (e) {
          console.error("Failed to join channel on IRC:", e);
        }

        form.reset();
        onClose();
        navigate(`/servers/${activeServerId}/channels/${newChannel.id}`);
      }
    } catch (error) {
      console.log(error);
    }
  };

  const handleClose = () => {
    form.reset();
    onClose();
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-white text-black p-0 overflow-hidden">
        <DialogHeader className="pt-8 px-6">
          <DialogTitle className="text-2xl text-center font-bold">
            Join Channel
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-6 px-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel
                      className="uppercase text-xs font-bold text-zinc-500 dark:text-secondary/70"
                    >
                      Channel name
                    </FormLabel>
                    <FormControl>
                      <ChannelInput
                        disabled={isLoading}
                        placeholder="Enter channel name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="joinTemporary"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="flex items-center gap-x-2">
                      <FormLabel className="text-sm font-semibold cursor-pointer">
                        Join temporary
                      </FormLabel>
                      <TooltipProvider>
                        <Tooltip delayDuration={50}>
                          <TooltipTrigger type="button">
                            <HelpCircle className="w-4 h-4 text-zinc-500 hover:text-zinc-700 transition cursor-pointer" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs text-xs">
                            Po restarcie aplikacji użytkownik nie zostanie automatycznie dołączony do kanału jeżeli ta opcja jest zaznaczona.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <FormControl>
                      <input
                        type="checkbox"
                        checked={field.value}
                        onChange={(e) => field.onChange(e.target.checked)}
                        className="h-4 w-4 cursor-pointer rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter className="bg-gray-100 px-6 py-4">
              <Button variant="primary" disabled={isLoading}>
                Join
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
