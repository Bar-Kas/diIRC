import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

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
  nicknames: z.array(
    z.object({
      value: z.string()
        .min(1, { message: "Nickname is required." })
        .refine((val) => !/\s/.test(val), { message: "Nickname cannot contain spaces." }),
    })
  ).min(1),
  realname: z.string().optional(),
  password: z.string().optional(),
  channels: z.array(z.object({ value: z.string() })).min(1),
  useTls: z.boolean().default(false),
});

export const CreateServerModal = () => {
  const { isOpen, onClose, type } = useModal();
  const navigate = useNavigate();
  const addServer = useMockStore((state) => state.addServer);
  const currentProfile = useMockStore((state) => state.currentProfile);

  const isModalOpen = isOpen && type === "createServer";

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      host: "127.0.0.1",
      port: 6667,
      nicknames: [{ value: currentProfile.name.replace(/\s+/g, "") || "ReactUser" }],
      realname: "",
      password: "",
      channels: [{ value: "test" }, { value: "general" }],
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
    if (isModalOpen) {
      form.reset({
        name: "",
        host: "127.0.0.1",
        port: 6667,
        nicknames: [{ value: currentProfile.name.replace(/\s+/g, "") || "ReactUser" }],
        realname: "",
        password: "",
        channels: [{ value: "test" }, { value: "general" }],
        useTls: false,
      });
    }
  }, [isModalOpen, form, currentProfile]);

  const isLoading = form.formState.isSubmitting;

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      const channelArray = values.channels
        .map(c => c.value.trim().replace(/^#/, ""))
        .filter(Boolean);

      const nickArray = values.nicknames
        .map(n => n.value.trim())
        .filter(Boolean);

      const newServer = addServer({
        name: values.name,
        host: values.host,
        port: values.port,
        nicknames: nickArray,
        realname: values.realname || "",
        password: values.password || "",
        useTls: values.useTls,
        autoJoinChannels: channelArray,
      });

      form.reset();
      onClose();
      navigate(`/servers/${newServer.id}`);
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
      <DialogContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="bg-white dark:bg-[#313338] text-zinc-900 dark:text-zinc-100 p-0 overflow-hidden max-w-md max-h-[90vh] flex flex-col border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-xl"
      >
        <DialogHeader className="pt-6 px-6 space-y-1">
          <DialogTitle className="text-2xl text-center font-bold text-zinc-900 dark:text-zinc-100">
            Add IRC server
          </DialogTitle>
          <DialogDescription className="text-center text-zinc-500 dark:text-zinc-400 text-xs sm:text-sm">
            Configure host, port, nickname, and channels to connect to your IRC server.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 flex-1 overflow-y-auto px-6 py-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="uppercase text-xs font-bold text-zinc-600 dark:text-zinc-300 tracking-wider">
                    Server name
                  </FormLabel>
                  <FormControl>
                    <Input
                      disabled={isLoading}
                      className="bg-zinc-100 dark:bg-[#1e1f22] border border-zinc-300/80 dark:border-zinc-700/60 focus-visible:ring-2 focus-visible:ring-indigo-500 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 font-medium h-10"
                      placeholder="e.g. Local Ergo or Libera Chat"
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
                        Host / address
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
                              form.setValue('port', parseInt(p) || 6667);
                              setTimeout(() => {
                                document.getElementById("port-input")?.focus();
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
                          id="port-input"
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
                    Password (optional)
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

            <FormField
              control={form.control}
              name="realname"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="uppercase text-xs font-bold text-zinc-600 dark:text-zinc-300 tracking-wider">
                    Real name (optional)
                  </FormLabel>
                  <FormControl>
                    <Input
                      disabled={isLoading}
                      className="bg-zinc-100 dark:bg-[#1e1f22] border border-zinc-300/80 dark:border-zinc-700/60 focus-visible:ring-2 focus-visible:ring-indigo-500 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 font-medium h-10 w-full"
                      placeholder="e.g. John Doe"
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
                            placeholder={index === 0 ? "ReactUser" : "Fallback nick"}
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
                          form.setValue("port", 6697);
                        } else if (!checked && form.getValues("port") === 6697) {
                          form.setValue("port", 6667);
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
                Connect & add
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
