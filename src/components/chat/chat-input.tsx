import * as z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Paperclip, Loader2, X } from "lucide-react";
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
import { ImageContextMenu } from "@/components/image-context-menu";

interface ChatInputProps {
  query: Record<string, string>;
  name: string;
  type: "conversation" | "channel";
}

interface AttachedImage {
  id: string;
  previewUrl: string;
  url?: string;
  name: string;
  isUploading: boolean;
}

const formSchema = z.object({
  content: z.string().optional().default(""),
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
  const addMessage = useMockStore((state) => state.addMessage);
  const addDirectMessage = useMockStore((state) => state.addDirectMessage);
  const servers = useMockStore((state) => state.servers);
  const currentProfile = useMockStore((state) => state.currentProfile);
  const uploadConfig = useMockStore((state) => state.uploadConfig);

  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);
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

  const removeAttachment = useCallback((id: string) => {
    setAttachedImages((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((item) => item.id !== id);
    });
  }, []);

  const clearAllAttachments = useCallback(() => {
    setAttachedImages((prev) => {
      prev.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
      return [];
    });
  }, []);

  const isUploading = attachedImages.some((img) => img.isUploading);
  const isLoading = form.formState.isSubmitting || isUploading;

  // Handle uploading a File object (from file picker or constructed from bytes)
  const processFileUpload = useCallback(async (file: File) => {
    if (uploadConfig.provider === "disabled") {
      setUploadError("Uploading is disabled in settings. Enable an upload provider in Settings.");
      setTimeout(() => setUploadError(null), 5000);
      return;
    }

    const id = `img-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const previewUrl = URL.createObjectURL(file);

    setAttachedImages((prev) => [
      ...prev,
      {
        id,
        previewUrl,
        name: file.name,
        isUploading: true,
      },
    ]);
    setUploadError(null);

    try {
      const url = await uploadImage(file, uploadConfig);
      setAttachedImages((prev) =>
        prev.map((item) => (item.id === id ? { ...item, url, isUploading: false } : item))
      );
      form.setFocus("content");
    } catch (err: any) {
      console.error("Upload error:", err);
      setUploadError(err?.message || "Failed to upload image.");
      setAttachedImages((prev) => prev.filter((item) => item.id !== id));
      URL.revokeObjectURL(previewUrl);
      setTimeout(() => setUploadError(null), 5000);
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
      await processFileUpload(file);
    } catch (err: any) {
      console.error("File path upload error:", err);
      setUploadError(err?.message || "Failed to upload file.");
      setTimeout(() => setUploadError(null), 5000);
    }
  }, [uploadConfig, processFileUpload]);

  // Unmount cleanup for blob object URLs
  const attachedImagesRef = useRef(attachedImages);
  attachedImagesRef.current = attachedImages;

  useEffect(() => {
    return () => {
      attachedImagesRef.current.forEach((img) => {
        if (img.previewUrl) URL.revokeObjectURL(img.previewUrl);
      });
    };
  }, []);

  const lastPasteTimeRef = useRef<number>(0);

  // Handle clipboard image paste (Fast path via DOM File paste + Tauri native plugin fallback)
  const processClipboardPaste = useCallback(async (pastedFile?: File) => {
    if (uploadConfig.provider === "disabled") return;

    const now = Date.now();
    if (now - lastPasteTimeRef.current < 300) return;
    lastPasteTimeRef.current = now;

    // Fast path: User pasted an image file directly in the browser/webview
    if (pastedFile) {
      await processFileUpload(pastedFile);
      return;
    }

    // Fallback: Read image from native Tauri clipboard plugin
    try {
      const clipImage = await readImage();
      if (!clipImage) return;

      const size = await clipImage.size();
      const rgbaData = await clipImage.rgba();
      if (!rgbaData || rgbaData.length === 0 || !size.width || !size.height) return;

      // Encode raw RGBA bytes into a valid PNG blob using Canvas
      const canvas = document.createElement("canvas");
      canvas.width = size.width;
      canvas.height = size.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const imgData = ctx.createImageData(size.width, size.height);
      imgData.data.set(rgbaData);
      ctx.putImageData(imgData, 0, 0);

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) return;

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
              paths.forEach((path) => processFilePathUpload(path));
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

  // --- Listen for clipboard paste events (DOM paste & Ctrl+V shortcut) ---
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          const file = items[i].getAsFile();
          if (file) {
            processClipboardPaste(file);
            break;
          }
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "v") {
        // Short delay to let native paste event fire first if available
        setTimeout(() => {
          processClipboardPaste();
        }, 50);
      }
    };

    window.addEventListener("paste", handlePaste);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("paste", handlePaste);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [processClipboardPaste]);

  // Triggered when user selects file(s) via paperclip system file picker
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => processFileUpload(file));
    if (e.target) {
      e.target.value = "";
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    const textContent = values.content?.trim() || "";
    const readyImages = attachedImages.filter((img) => !img.isUploading && img.url);

    // Don't send if still uploading or if no text and no ready images
    if (attachedImages.some((img) => img.isUploading)) return;
    if (!textContent && readyImages.length === 0) return;

    const linesToSend: string[] = [];
    if (textContent) {
      linesToSend.push(textContent);
    }
    readyImages.forEach((img) => {
      if (img.url) linesToSend.push(img.url);
    });

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

      for (const line of linesToSend) {
        if (type === "channel" && query?.channelId) {
          addMessage(query.channelId, currentMember, line);
          try {
            await invoke("send_message", { 
              serverId: activeServer.id,
              channel: name.startsWith("#") ? name : `#${name}`, 
              message: line 
            });
          } catch (err) {
            console.error("IRC Send error:", err);
          }
        } else if (type === "conversation" && query?.conversationId) {
          addDirectMessage(query.conversationId, currentMember, line);
          try {
            await invoke("send_message", { 
              serverId: activeServer.id,
              channel: name, 
              message: line 
            });
          } catch (err) {
            console.error("IRC PM Send error:", err);
          }
        }
      }

      form.reset({ content: "" });
      clearAllAttachments();
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
          multiple
          className="hidden"
          onChange={handleFileChange}
        />

        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <div className="p-4 pb-6">
                  {/* Attachment Thumbnail Badges */}
                  {attachedImages.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-3 max-h-[180px] overflow-y-auto pt-3 px-2 pb-1">
                      {attachedImages.map((img) => (
                        <div
                          key={img.id}
                          className="p-2 bg-zinc-200/90 dark:bg-zinc-800/90 rounded-xl flex items-center gap-x-3 relative group border border-zinc-300/80 dark:border-zinc-700/80 shadow-md transition-all"
                        >
                          <ImageContextMenu url={img.url || img.previewUrl} filename={img.name}>
                            <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-black/10 shrink-0 border border-zinc-300 dark:border-zinc-700">
                              <img
                                src={img.previewUrl}
                                alt={img.name}
                                className="w-full h-full object-cover"
                              />
                              {img.isUploading && (
                                <div className="absolute inset-0 bg-black/50 backdrop-blur-[1px] flex items-center justify-center">
                                  <Loader2 className="w-5 h-5 animate-spin text-white" />
                                </div>
                              )}
                            </div>
                          </ImageContextMenu>
                          <div className="flex flex-col pr-5 max-w-[150px]">
                            <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                              {img.name}
                            </span>
                            <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                              {img.isUploading ? "Uploading..." : "Ready"}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeAttachment(img.id)}
                            className="absolute -top-2 -right-2 h-6 w-6 bg-rose-500 hover:bg-rose-600 text-white rounded-full flex items-center justify-center transition shadow-lg z-10"
                            title="Remove attachment"
                          >
                            <X className="w-3.5 h-3.5 stroke-[2.5]" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Input field with controls scoped directly to it */}
                  <div className="relative flex items-center">
                    <Input
                      disabled={isLoading && attachedImages.length === 0}
                      autoFocus
                      className="pl-4 pr-24 py-6 bg-zinc-200/90 dark:bg-zinc-700/75 border-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-zinc-600 dark:text-zinc-200"
                      placeholder={
                        isUploading
                          ? "Uploading images..."
                          : `Message ${type === "conversation" ? name : "#" + name}`
                      }
                      {...field}
                    />

                    {/* Right side controls: Paperclip (System File Picker) + Emoji Picker */}
                    <div className="absolute right-4 z-10 flex items-center gap-x-2">
                      {/* Paperclip Button for opening system file dialog */}
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => fileInputRef.current?.click()}
                        className="h-7 w-7 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition flex items-center justify-center rounded-md hover:bg-zinc-300/50 dark:hover:bg-zinc-600/50"
                        title="Attach image files (System dialog)"
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

                  {/* Upload error banner if any */}
                  {uploadError && (
                    <div className="mt-1 text-[11px] font-semibold text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20 truncate max-w-[80%]">
                      ⚠️ {uploadError}
                    </div>
                  )}
                </div>
              </FormControl>
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
};


