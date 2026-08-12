import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

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
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChannelInput } from "@/components/ui/channel-input";
import { Plus, Trash } from "lucide-react";
import { useModal } from "@/hooks/use-modal-store";
import { useMockStore } from "@/lib/mock-store";

const formSchema = z.object({
  name: z.string().min(1, { message: "Server name is required." }),
  host: z.string().min(1, { message: "Server address is required." }),
  port: z.coerce.number().min(1).max(65535),
  nicknames: z.array(z.object({ value: z.string().min(1, { message: "Nickname is required." }) })).min(1),
  password: z.string().optional(),
  channels: z.array(z.object({ value: z.string() })).min(1),
  useTls: z.boolean().default(false),
});

export const EditServerModal = () => {
  const { isOpen, onClose, type, data } = useModal();
  const updateServer = useMockStore((state) => state.updateServer);

  const isModalOpen = isOpen && type === "editServer";
  const { server } = data;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      host: "127.0.0.1",
      port: 6667,
      nicknames: [{ value: "ReactUser" }],
      password: "",
      channels: [{ value: "general" }],
      useTls: false,
    }
  });

  const { fields: nickFields, append: appendNick, remove: removeNick } = useFieldArray({
    name: "nicknames",
    control: form.control,
  });

  const { fields: channelFields, append: appendChannel, remove: removeChannel } = useFieldArray({
    name: "channels",
    control: form.control,
  });

  useEffect(() => {
    if (server) {
      form.setValue("name", server.name || "");
      form.setValue("host", server.host || "127.0.0.1");
      form.setValue("port", server.port || 6667);
      
      const defaultNicks = server.nicknames && server.nicknames.length > 0 
        ? server.nicknames.map(n => ({ value: n }))
        : [{ value: server.nicknames?.[0] || "ReactUser" }];
      form.setValue("nicknames", defaultNicks);

      form.setValue("password", server.password || "");

      const defaultChannels = server.channels && server.channels.length > 0
        ? server.channels.map(c => ({ value: c.name }))
        : [];
      form.setValue("channels", defaultChannels);

      form.setValue("useTls", server.useTls ?? false);
    }
  }, [server, form]);

  const isLoading = form.formState.isSubmitting;

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      if (server?.id) {
        const channelArray = values.channels
          .map(c => c.value.trim().replace(/^#/, ""))
          .filter(Boolean);

        const nickArray = values.nicknames
          .map(n => n.value.trim())
          .filter(Boolean);

        updateServer(server.id, {
          name: values.name,
          host: values.host,
          port: values.port,
          nicknames: nickArray,
          password: values.password || "",
          useTls: values.useTls,
          autoJoinChannels: channelArray,
        });

        // Join the channels on IRC in case new ones were added
        for (const channel of channelArray) {
          try {
            await invoke("join_channel", {
              serverId: server.id,
              channel
            });
          } catch (e) {
            console.error(`Failed to join channel ${channel} on IRC:`, e);
          }
        }
      }
      form.reset();
      onClose();
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
      <DialogContent className="bg-white text-black p-0 overflow-hidden max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader className="pt-6 px-6">
          <DialogTitle className="text-2xl text-center font-bold">
            Edit Server Settings
          </DialogTitle>
          <DialogDescription className="text-center text-zinc-500">
            Update connection parameters and configuration for your IRC server.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 flex-1 overflow-y-auto px-6 py-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="uppercase text-xs font-bold text-zinc-500 dark:text-secondary/70">
                    Server Name
                  </FormLabel>
                  <FormControl>
                    <Input
                      disabled={isLoading}
                      className="bg-zinc-300/50 border-0 focus-visible:ring-0 text-black focus-visible:ring-offset-0"
                      placeholder="e.g. Local Ergo"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <FormField
                  control={form.control}
                  name="host"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="uppercase text-xs font-bold text-zinc-500">
                        Host / Address
                      </FormLabel>
                      <FormControl>
                        <Input
                          disabled={isLoading}
                          className="bg-zinc-300/50 border-0 focus-visible:ring-0 text-black focus-visible:ring-offset-0"
                          placeholder="127.0.0.1"
                          {...field}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val.includes(':')) {
                              const [h, p] = val.split(':');
                              field.onChange(h);
                              form.setValue('port', parseInt(p) || 6667);
                              setTimeout(() => {
                                document.getElementById("edit-port-input")?.focus();
                              }, 0);
                            } else {
                              field.onChange(val);
                            }
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="col-span-1">
                <FormField
                  control={form.control}
                  name="port"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="uppercase text-xs font-bold text-zinc-500">
                        Port
                      </FormLabel>
                      <FormControl>
                        <Input
                          id="edit-port-input"
                          type="number"
                          disabled={isLoading}
                          className="bg-zinc-300/50 border-0 focus-visible:ring-0 text-black focus-visible:ring-offset-0"
                          placeholder="6667"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="uppercase text-xs font-bold text-zinc-500">
                    Password (Optional)
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      disabled={isLoading}
                      className="bg-zinc-300/50 border-0 focus-visible:ring-0 text-black focus-visible:ring-offset-0 w-full"
                      placeholder="Optional"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex flex-col gap-2">
              <FormLabel className="uppercase text-xs font-bold text-zinc-500 flex items-center justify-between">
                Nicknames
                <Plus 
                  className="w-4 h-4 cursor-pointer hover:text-zinc-800 transition" 
                  onClick={() => appendNick({ value: "" })} 
                />
              </FormLabel>
              {nickFields.map((field, index) => (
                <FormField
                  key={field.id}
                  control={form.control}
                  name={`nicknames.${index}.value`}
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <div className="flex items-center gap-2">
                          <Input
                            disabled={isLoading}
                            className="bg-zinc-300/50 border-0 focus-visible:ring-0 text-black focus-visible:ring-offset-0"
                            placeholder={index === 0 ? "ReactUser" : "Fallback Nick"}
                            {...field}
                          />
                          {index > 0 && (
                            <Trash 
                              className="w-4 h-4 cursor-pointer text-zinc-500 hover:text-rose-500 transition shrink-0" 
                              onClick={() => removeNick(index)} 
                            />
                          )}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </div>

            <div className="flex flex-col gap-2">
              <FormLabel className="uppercase text-xs font-bold text-zinc-500 flex items-center justify-between">
                Channels
                <Plus 
                  className="w-4 h-4 cursor-pointer hover:text-zinc-800 transition" 
                  onClick={() => appendChannel({ value: "" })} 
                />
              </FormLabel>
              {channelFields.map((field, index) => (
                <FormField
                  key={field.id}
                  control={form.control}
                  name={`channels.${index}.value`}
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <div className="flex items-center gap-2">
                          <ChannelInput
                            disabled={isLoading}
                            placeholder="general"
                            {...field}
                          />
                          {index > 0 && (
                            <Trash 
                              className="w-4 h-4 cursor-pointer text-zinc-500 hover:text-rose-500 transition shrink-0" 
                              onClick={() => removeChannel(index)} 
                            />
                          )}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </div>

            <FormField
              control={form.control}
              name="useTls"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel className="text-sm font-semibold">
                      Use TLS / SSL
                    </FormLabel>
                  </div>
                  <FormControl>
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={(e) => {
                        field.onChange(e.target.checked);
                        if (e.target.checked && form.getValues("port") === 6667) {
                          form.setValue("port", 6697);
                        } else if (!e.target.checked && form.getValues("port") === 6697) {
                          form.setValue("port", 6667);
                        }
                      }}
                      className="h-4 w-4 cursor-pointer rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter className="bg-gray-100 -mx-6 -mb-2 px-6 py-4 mt-4">
              <Button variant="primary" disabled={isLoading}>
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
