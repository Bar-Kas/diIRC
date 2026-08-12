import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import { useEffect, useState } from "react";
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
import { Switch } from "@/components/ui/switch";
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

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingValues, setPendingValues] = useState<z.infer<typeof formSchema> | null>(null);

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
    if (server && isModalOpen) {
      const defaultNicks = server.nicknames && server.nicknames.length > 0 
        ? server.nicknames.map(n => ({ value: n }))
        : [{ value: server.nicknames?.[0] || "ReactUser" }];

      const defaultChannels = server.channels && server.channels.length > 0
        ? server.channels.map(c => ({ value: c.name }))
        : [];

      form.reset({
        name: server.name || "",
        host: server.host || "127.0.0.1",
        port: server.port || 6667,
        nicknames: defaultNicks,
        password: server.password || "",
        channels: defaultChannels,
        useTls: server.useTls ?? false,
      });
    }
  }, [server, isModalOpen, form]);

  const isLoading = form.formState.isSubmitting;

  const onFormSubmit = (values: z.infer<typeof formSchema>) => {
    // Only prompt confirmation if changes were actually made
    if (!form.formState.isDirty) {
      form.reset();
      onClose();
      return;
    }

    setPendingValues(values);
    setConfirmOpen(true);
  };

  const handleConfirmSave = async () => {
    if (!pendingValues) return;
    try {
      if (server?.id) {
        const channelArray = pendingValues.channels
          .map(c => c.value.trim().replace(/^#/, ""))
          .filter(Boolean);

        const nickArray = pendingValues.nicknames
          .map(n => n.value.trim())
          .filter(Boolean);

        updateServer(server.id, {
          name: pendingValues.name,
          host: pendingValues.host,
          port: pendingValues.port,
          nicknames: nickArray,
          password: pendingValues.password || "",
          useTls: pendingValues.useTls,
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
      setConfirmOpen(false);
      setPendingValues(null);
      form.reset();
      onClose();
    } catch (error) {
      console.log(error);
    }
  };

  const handleClose = () => {
    setConfirmOpen(false);
    setPendingValues(null);
    form.reset();
    onClose();
  };

  return (
    <>
      <Dialog open={isModalOpen} onOpenChange={handleClose}>
        <DialogContent
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="bg-white dark:bg-[#313338] text-zinc-900 dark:text-zinc-100 p-0 overflow-hidden max-w-md max-h-[90vh] flex flex-col border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-xl"
        >
          <DialogHeader className="pt-6 px-6 space-y-1">
            <DialogTitle className="text-2xl text-center font-bold text-zinc-900 dark:text-zinc-100">
              Edit Server Settings
            </DialogTitle>
            <DialogDescription className="text-center text-zinc-500 dark:text-zinc-400 text-xs sm:text-sm">
              Update connection parameters and configuration for your IRC server.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onFormSubmit)} className="space-y-4 flex-1 overflow-y-auto px-6 py-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="uppercase text-xs font-bold text-zinc-600 dark:text-zinc-300 tracking-wider">
                      Server Name
                    </FormLabel>
                    <FormControl>
                      <Input
                        disabled={isLoading}
                        className="bg-zinc-100 dark:bg-[#1e1f22] border border-zinc-300/80 dark:border-zinc-700/60 focus-visible:ring-2 focus-visible:ring-indigo-500 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 font-medium h-10"
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
                        <FormLabel className="uppercase text-xs font-bold text-zinc-600 dark:text-zinc-300 tracking-wider">
                          Host / Address
                        </FormLabel>
                        <FormControl>
                          <Input
                            disabled={isLoading}
                            className="bg-zinc-100 dark:bg-[#1e1f22] border border-zinc-300/80 dark:border-zinc-700/60 focus-visible:ring-2 focus-visible:ring-indigo-500 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 font-medium h-10"
                            placeholder="127.0.0.1"
                            {...field}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val.includes(':')) {
                                const [h, p] = val.split(':');
                                field.onChange(h);
                                form.setValue('port', parseInt(p) || 6667, { shouldDirty: true });
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
                        <FormLabel className="uppercase text-xs font-bold text-zinc-600 dark:text-zinc-300 tracking-wider">
                          Port
                        </FormLabel>
                        <FormControl>
                          <Input
                            id="edit-port-input"
                            type="number"
                            disabled={isLoading}
                            className="bg-zinc-100 dark:bg-[#1e1f22] border border-zinc-300/80 dark:border-zinc-700/60 focus-visible:ring-2 focus-visible:ring-indigo-500 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 font-medium h-10"
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
                    <FormLabel className="uppercase text-xs font-bold text-zinc-600 dark:text-zinc-300 tracking-wider">
                      Password (Optional)
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        disabled={isLoading}
                        className="bg-zinc-100 dark:bg-[#1e1f22] border border-zinc-300/80 dark:border-zinc-700/60 focus-visible:ring-2 focus-visible:ring-indigo-500 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 font-medium h-10 w-full"
                        placeholder="Optional"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex flex-col gap-2">
                <FormLabel className="uppercase text-xs font-bold text-zinc-600 dark:text-zinc-300 tracking-wider flex items-center justify-between">
                  Nicknames
                  <Plus 
                    className="w-4 h-4 cursor-pointer text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100 transition" 
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
                              className="bg-zinc-100 dark:bg-[#1e1f22] border border-zinc-300/80 dark:border-zinc-700/60 focus-visible:ring-2 focus-visible:ring-indigo-500 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 font-medium h-10"
                              placeholder={index === 0 ? "ReactUser" : "Fallback Nick"}
                              {...field}
                            />
                            {index > 0 && (
                              <Trash 
                                className="w-4 h-4 cursor-pointer text-zinc-400 hover:text-rose-500 transition shrink-0" 
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
                <FormLabel className="uppercase text-xs font-bold text-zinc-600 dark:text-zinc-300 tracking-wider flex items-center justify-between">
                  Channels
                  <Plus 
                    className="w-4 h-4 cursor-pointer text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100 transition" 
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
                                className="w-4 h-4 cursor-pointer text-zinc-400 hover:text-rose-500 transition shrink-0" 
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
                  <FormItem className="flex flex-row items-center justify-between rounded-xl border border-zinc-300/80 dark:border-zinc-700/60 bg-zinc-50 dark:bg-[#2b2d31] p-3.5 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel className="text-sm font-semibold text-zinc-900 dark:text-zinc-200 cursor-pointer">
                        Use TLS / SSL
                      </FormLabel>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Encrypt connection via TLS/SSL (default port 6697)
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={(checked) => {
                          field.onChange(checked);
                          if (checked && form.getValues("port") === 6667) {
                            form.setValue("port", 6697, { shouldDirty: true });
                          } else if (!checked && form.getValues("port") === 6697) {
                            form.setValue("port", 6667, { shouldDirty: true });
                          }
                        }}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter className="bg-zinc-100/90 dark:bg-[#2b2d31] border-t border-zinc-200 dark:border-zinc-800/80 -mx-6 -mb-2 px-6 py-4 mt-4 flex items-center justify-between">
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
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Confirmation Modal */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="bg-white dark:bg-[#313338] text-zinc-900 dark:text-zinc-100 p-0 overflow-hidden max-w-sm border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-xl z-[60]"
        >
          <DialogHeader className="pt-6 px-6 space-y-2">
            <DialogTitle className="text-xl text-center font-bold text-zinc-900 dark:text-zinc-100">
              Czy na pewno chcesz zapisać zmiany?
            </DialogTitle>
            <DialogDescription className="text-center text-zinc-500 dark:text-zinc-400 text-sm">
              Wprowadzone zmiany w ustawieniach serwera <span className="font-semibold text-indigo-600 dark:text-indigo-400">{server?.name}</span> zostaną zapisane.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="bg-zinc-100/90 dark:bg-[#2b2d31] border-t border-zinc-200 dark:border-zinc-800/80 px-6 py-4 flex items-center justify-between mt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmOpen(false)}
              disabled={isLoading}
              className="text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white"
            >
              Anuluj
            </Button>
            <Button
              type="button"
              onClick={handleConfirmSave}
              disabled={isLoading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-5 shadow-sm"
            >
              Tak, zapisz
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
