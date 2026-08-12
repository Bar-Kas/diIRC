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
import { FileUpload } from "@/components/file-upload";
import { useMockStore } from "@/lib/mock-store";

const formSchema = z.object({
  name: z.string().min(1, { message: "Server name is required." }),
  host: z.string().min(1, { message: "Server address is required." }),
  port: z.coerce.number().min(1).max(65535),
  nickname: z.string().min(1, { message: "Nickname is required." }),
  password: z.string().optional(),
  channels: z.string().optional(),
  useTls: z.boolean().default(false),
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
      password: "",
      channels: "#test, #general",
      useTls: false,
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
        nickname: values.nickname,
        password: values.password || "",
        useTls: values.useTls,
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
      <DialogContent className="bg-white text-black p-0 overflow-hidden max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader className="pt-6 px-6">
          <DialogTitle className="text-2xl text-center font-bold">
            Connect to your first IRC Server
          </DialogTitle>
          <DialogDescription className="text-center text-zinc-500">
            Configure host, port, nickname, and channels to connect to your IRC server.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 flex-1 overflow-y-auto px-6 py-2">
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

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="nickname"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="uppercase text-xs font-bold text-zinc-500">
                      Nickname
                    </FormLabel>
                    <FormControl>
                      <Input
                        disabled={isLoading}
                        className="bg-zinc-300/50 border-0 focus-visible:ring-0 text-black focus-visible:ring-offset-0"
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
                    <FormLabel className="uppercase text-xs font-bold text-zinc-500">
                      Password (Optional)
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        disabled={isLoading}
                        className="bg-zinc-300/50 border-0 focus-visible:ring-0 text-black focus-visible:ring-offset-0"
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
                  <FormLabel className="uppercase text-xs font-bold text-zinc-500">
                    Channels (Comma separated)
                  </FormLabel>
                  <FormControl>
                    <Input
                      disabled={isLoading}
                      className="bg-zinc-300/50 border-0 focus-visible:ring-0 text-black focus-visible:ring-offset-0"
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
                Connect & Add
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
