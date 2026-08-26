import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useEffect, useState } from "react";
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
import { FileUpload } from "@/components/file-upload";
import { useMockStore } from "@/lib/mock-store";

const formSchema = z.object({
  name: z.string().min(1, { message: "Server name is required." }),
  host: z.string().min(1, { message: "Server address is required." }),
  port: z.coerce.number().min(1).max(65535),
  nickname: z.string()
    .min(1, { message: "Nickname is required." })
    .refine((val) => !/\s/.test(val), { message: "Nickname cannot contain spaces." }),
  realname: z.string().optional(),
  password: z.string().optional(),
  channels: z.string().optional(),
  useTls: z.boolean().default(false),
  autoConnect: z.boolean().default(true),
  autoReconnect: z.boolean().default(true),
  imageUrl: z.string().optional()
});

export const InitialModal = ({ isOpen = true, onClose }: { isOpen?: boolean; onClose?: () => void }) => {
  const [isMounted, setIsMounted] = useState(false);
  const navigate = useNavigate();
  const addServer = useMockStore((state) => state.addServer);
  const currentProfile = useMockStore((state) => state.currentProfile);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "Local IRC (Ergo)",
      host: "127.0.0.1",
      port: 6667,
      nickname: currentProfile.name.replace(/\s+/g, "") || "ReactUser",
      realname: "",
      password: "",
      channels: "#test, #general",
      useTls: false,
      autoConnect: true,
      autoReconnect: true,
      imageUrl: "",
    }
  });

  const isLoading = form.formState.isSubmitting;

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      const channelArray = values.channels
        ? values.channels.split(",").map((c) => c.trim()).filter(Boolean)
        : ["test", "general"];

      const newServer = addServer({
        name: values.name,
        host: values.host,
        port: values.port,
        nicknames: [values.nickname],
        realname: values.realname || "",
        password: values.password || "",
        useTls: values.useTls,
        autoConnect: values.autoConnect,
        autoReconnect: values.autoReconnect,
        autoJoinChannels: channelArray,
        imageUrl: values.imageUrl || "",
      });

      form.reset();
      if (onClose) onClose();
      navigate(`/servers/${newServer.id}`);
    } catch (error) {
      console.log(error);
    }
  };

  if (!isMounted) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="bg-white dark:bg-[#313338] text-zinc-900 dark:text-zinc-100 p-0 overflow-hidden max-w-md max-h-[90vh] flex flex-col border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-xl"
      >
        <DialogHeader className="pt-6 px-6 space-y-1 shrink-0">
          <DialogTitle className="text-2xl text-center font-bold text-zinc-900 dark:text-zinc-100">
            Connect to your first IRC server
          </DialogTitle>
          <DialogDescription className="text-center text-zinc-500 dark:text-zinc-400 text-xs sm:text-sm">
            Configure host, port, nickname, and channels to connect to your IRC server.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
            <div className="space-y-4 flex-1 overflow-y-auto px-6 py-2 min-h-0">
            <div className="flex items-center justify-center text-center">
              <FormField
                control={form.control}
                name="imageUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <FileUpload
                        endpoint="serverImage"
                        value={field.value || ""}
                        onChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

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
                        Host / address
                      </FormLabel>
                      <FormControl>
                        <Input
                          disabled={isLoading}
                          className="bg-zinc-100 dark:bg-[#1e1f22] border border-zinc-300/80 dark:border-zinc-700/60 focus-visible:ring-2 focus-visible:ring-indigo-500 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 font-medium h-10"
                          placeholder="127.0.0.1"
                          {...field}
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
              name="realname"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="uppercase text-xs font-bold text-zinc-600 dark:text-zinc-300 tracking-wider">
                    Real name (optional)
                  </FormLabel>
                  <FormControl>
                    <Input
                      disabled={isLoading}
                      className="bg-zinc-100 dark:bg-[#1e1f22] border border-zinc-300/80 dark:border-zinc-700/60 focus-visible:ring-2 focus-visible:ring-indigo-500 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 font-medium h-10"
                      placeholder="e.g. John Doe"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="nickname"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="uppercase text-xs font-bold text-zinc-600 dark:text-zinc-300 tracking-wider">
                      Nickname
                    </FormLabel>
                    <FormControl>
                      <Input
                        disabled={isLoading}
                        className="bg-zinc-100 dark:bg-[#1e1f22] border border-zinc-300/80 dark:border-zinc-700/60 focus-visible:ring-2 focus-visible:ring-indigo-500 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 font-medium h-10"
                        placeholder="ReactUser"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                        className="bg-zinc-100 dark:bg-[#1e1f22] border border-zinc-300/80 dark:border-zinc-700/60 focus-visible:ring-2 focus-visible:ring-indigo-500 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 font-medium h-10"
                        placeholder="Optional"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="channels"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="uppercase text-xs font-bold text-zinc-600 dark:text-zinc-300 tracking-wider">
                    Channels (comma separated)
                  </FormLabel>
                  <FormControl>
                    <Input
                      disabled={isLoading}
                      className="bg-zinc-100 dark:bg-[#1e1f22] border border-zinc-300/80 dark:border-zinc-700/60 focus-visible:ring-2 focus-visible:ring-indigo-500 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 font-medium h-10"
                      placeholder="#test, #general"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
            </div>

            <DialogFooter className="bg-zinc-100/90 dark:bg-[#2b2d31] border-t border-zinc-200 dark:border-zinc-800/80 px-6 py-4 flex items-center justify-end shrink-0">
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
