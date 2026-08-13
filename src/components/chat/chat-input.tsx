import * as z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Paperclip, Loader2 } from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { readImage } from "@tauri-apps/plugin-clipboard-manager";
import { readFile } from "@tauri-apps/plugin-fs";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useModal } from "@/hooks/use-modal-store";
import { EmojiPicker } from "@/components/emoji-picker";
import { useMockStore } from "@/lib/mock-store";
import { uploadImage } from "@/lib/upload/services";

interface ChatInputProps {
  query: Record<string, string>;
  name: string;
  type: "conversation" | "channel";
}

const formSchema = z.object({
  content: z.string().min(1),
});

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg", ".ico"];

function isImagePath(path: string): boolean {
  const lower = path.toLowerCase();
  return IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export const ChatInput = ({
  query,
  name,
  type,
}: ChatInputProps) => {
  const { onOpen } = useModal();
  const addMessage = useMockStore((state) => state.addMessage);
  const addDirectMessage = useMockStore((state) => state.addDirectMessage);
  const servers = useMockStore((state) => state.servers);
  const currentProfile = useMockStore((state) => state.currentProfile);
  const uploadConfig = useMockStore((state) => state.uploadConfig);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      content: "",
    }
  });

  // Focus input automatically on channel/conversation switch
  const activeId = query?.channelId || query?.conversationId;
  useEffect(() => {
    form.setFocus("content");
  }, [activeId, form]);

  const isLoading = form.formState.isSubmitting || isUploading;

  // Handle uploading a File object (from file picker or constructed from bytes)
  const processFileUpload = useCallback(async (file: File) => {
    if (uploadConfig.provider === "disabled") {
      setUploadError("Uploading is disabled in settings. Enable an upload provider in Settings.");
      setTimeout(() => setUploadError(null), 5000);
      return;
    }

    try {
      setIsUploading(true);
      setUploadError(null);
      const url = await uploadImage(file, uploadConfig);
      
      const currentContent = form.getValues("content");
      const newContent = currentContent ? `${currentContent} ${url}` : url;
      form.setValue("content", newContent);
      form.setFocus("content");
    } catch (err: any) {
      console.error("Upload error:", err);
      setUploadError(err?.message || "Failed to upload image.");
      setTimeout(() => setUploadError(null), 5000);
    } finally {
      setIsUploading(false);
    }
  }, [uploadConfig, form]);

  // Handle uploading a file from a filesystem path (Tauri native drag-drop gives paths)
  const processFilePathUpload = useCallback(async (filePath: string) => {
    if (uploadConfig.provider === "disabled") {
      setUploadError("Uploading is disabled in settings. Enable an upload provider in Settings.");
      setTimeout(() => setUploadError(null), 5000);
      return;
    }

    if (!isImagePath(filePath)) {
      setUploadError("Only image files are supported for upload.");
      setTimeout(() => setUploadError(null), 5000);
      return;
    }

    try {
      setIsUploading(true);
      setUploadError(null);

      // Read the file contents from disk via Tauri fs plugin
      const fileBytes = await readFile(filePath);
      const fileName = filePath.split("/").pop() || "image.png";
      const ext = fileName.split(".").pop()?.toLowerCase() || "png";
      const mimeMap: Record<string, string> = {
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        gif: "image/gif",
        webp: "image/webp",
        bmp: "image/bmp",
        svg: "image/svg+xml",
        ico: "image/x-icon",
      };
      const mimeType = mimeMap[ext] || "application/octet-stream";

      const file = new File([fileBytes], fileName, { type: mimeType });
      const url = await uploadImage(file, uploadConfig);

      const currentContent = form.getValues("content");
      const newContent = currentContent ? `${currentContent} ${url}` : url;
      form.setValue("content", newContent);
      form.setFocus("content");
    } catch (err: any) {
      console.error("File path upload error:", err);
      setUploadError(err?.message || "Failed to upload file.");
      setTimeout(() => setUploadError(null), 5000);
    } finally {
      setIsUploading(false);
    }
  }, [uploadConfig, form]);

  // Handle clipboard image paste via Tauri native clipboard plugin
  const processClipboardPaste = useCallback(async () => {
    if (uploadConfig.provider === "disabled") return;

    try {
      const clipImage = await readImage();
      if (!clipImage) return;

      const rgbaData = await clipImage.rgba();
      if (!rgbaData || rgbaData.length === 0) return;

      // Convert RGBA data to a PNG-like blob
      const blob = new Blob([rgbaData], { type: "image/png" });
      const file = new File([blob], `clipboard-${Date.now()}.png`, { type: "image/png" });

      await processFileUpload(file);
    } catch (err: any) {
      // Silently ignore if clipboard has no image (user pasted text)
      console.debug("Clipboard paste (no image):", err?.message);
    }
  }, [uploadConfig, processFileUpload]);

  // --- Tauri native drag-drop listener ---
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupDragDrop = async () => {
      try {
        const appWindow = getCurrentWebviewWindow();
        unlisten = await appWindow.onDragDropEvent((event) => {
          if (event.payload.type === "drop") {
            const paths = event.payload.paths;
            if (paths && paths.length > 0) {
              processFilePathUpload(paths[0]);
            }
          }
        });
      } catch (err) {
        console.error("Failed to setup drag-drop listener:", err);
      }
    };

    setupDragDrop();

    return () => {
      if (unlisten) unlisten();
    };
  }, [processFilePathUpload]);

  // --- Keyboard shortcut: Ctrl+V to paste image from clipboard ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "v") {
        // Try to read image from native clipboard
        processClipboardPaste();
        // Don't preventDefault — let normal text paste still work
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [processClipboardPaste]);

  // Triggered when user selects a file via paperclip system file picker
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFileUpload(file);
    }
    if (e.target) {
      e.target.value = "";
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      const activeServer = query?.serverId ? servers.find((s) => s.id === query.serverId) : servers[0];
      if (!activeServer) return;

      let currentMember = activeServer.members.find((m) => m.profileId === currentProfile.id) || activeServer.members[0];
      const primaryNick = activeServer.nicknames?.[0];
      if (primaryNick && currentMember) {
        currentMember = {
          ...currentMember,
          profile: {
            ...currentMember.profile,
            name: primaryNick,
          },
        };
      }

      if (type === "channel" && query?.channelId) {
        addMessage(query.channelId, currentMember, values.content);
        try {
          await invoke("send_message", { 
            serverId: activeServer.id,
            channel: name.startsWith("#") ? name : `#${name}`, 
            message: values.content 
          });
        } catch (err) {
          console.error("IRC Send error:", err);
        }
      } else if (type === "conversation" && query?.conversationId) {
        addDirectMessage(query.conversationId, currentMember, values.content);
      }

      form.reset({ content: "" });
      setTimeout(() => {
        form.setFocus("content");
      }, 0);
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        {/* Hidden system file picker */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <div className="relative p-4 pb-6">
                  {/* Plus button for attachments modal */}
                  <button
                    type="button"
                    onClick={() => onOpen("messageFile", { query })}
                    className="absolute top-7 left-8 h-[24px] w-[24px] bg-zinc-500 dark:bg-zinc-400 hover:bg-zinc-600 dark:hover:bg-zinc-300 transition rounded-full p-1 flex items-center justify-center"
                    title="Add attachment"
                  >
                    <Plus className="text-white dark:text-[#313338]" />
                  </button>

                  <Input
                    disabled={isLoading}
                    autoFocus
                    className="pl-14 pr-24 py-6 bg-zinc-200/90 dark:bg-zinc-700/75 border-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-zinc-600 dark:text-zinc-200"
                    placeholder={
                      isUploading
                        ? "Uploading image..."
                        : `Message ${type === "conversation" ? name : "#" + name}`
                    }
                    {...field}
                  />

                  {/* Upload error banner if any */}
                  {uploadError && (
                    <div className="absolute left-8 bottom-1 text-[11px] font-semibold text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20 truncate max-w-[80%]">
                      ⚠️ {uploadError}
                    </div>
                  )}

                  {/* Right side controls: Paperclip (System File Picker) + Emoji Picker */}
                  <div className="absolute top-7 right-8 flex items-center gap-x-2">
                    {/* Paperclip Button for opening system file dialog */}
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => fileInputRef.current?.click()}
                      className="h-7 w-7 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition flex items-center justify-center rounded-md hover:bg-zinc-300/50 dark:hover:bg-zinc-600/50"
                      title="Attach image file (System dialog)"
                    >
                      {isUploading ? (
                        <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                      ) : (
                        <Paperclip className="w-4 h-4" />
                      )}
                    </button>

                    <EmojiPicker
                      onChange={(emoji: string) => {
                        field.onChange(`${field.value ? field.value + " " : ""}${emoji}`);
                        form.setFocus("content");
                      }}
                    />
                  </div>
                </div>
              </FormControl>
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
};
