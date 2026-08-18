import { FileIcon, ExternalLink } from "lucide-react";
import { useModal } from "@/hooks/use-modal-store";
import { ImageContextMenu } from "@/components/image-context-menu";
import { openExternalUrl, getFilenameFromUrl } from "@/lib/system-utils";
import { SmartImage } from "@/components/chat/smart-image";
import { isImageUrl, isVideoUrl } from "@/lib/image-utils";

interface ChatItemAttachmentProps {
  fileUrl: string;
  content: string;
}

export const ChatItemAttachment = ({ fileUrl, content }: ChatItemAttachmentProps) => {
  const { onOpen } = useModal();
  const isImage = isImageUrl(fileUrl);
  const isVideo = isVideoUrl(fileUrl);

  if (isImage) {
    return (
      <div className="mt-1 w-fit max-w-md rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <ImageContextMenu url={fileUrl}>
          <button 
            type="button"
            onClick={() => onOpen("imagePreview", { url: fileUrl })}
            className="block relative cursor-zoom-in text-left w-full h-full"
          >
            <SmartImage
              src={fileUrl}
              alt={content || "Attachment"}
              className="max-h-[320px] max-w-full w-auto h-auto object-contain rounded-lg transition hover:opacity-95 block"
            />
          </button>
        </ImageContextMenu>
      </div>
    );
  }

  if (isVideo) {
    return (
      <div className="mt-2 max-w-md rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-black">
        <video
          src={fileUrl}
          controls
          className="max-h-[320px] w-full rounded-lg"
          preload="metadata"
        />
      </div>
    );
  }

  // Generic File Attachment (PDF, ZIP, DOCX, TXT, etc.)
  const filename = getFilenameFromUrl(fileUrl, "Attachment");
  const ext = filename.split(".").pop()?.toUpperCase() || "FILE";

  return (
    <div className="relative flex items-center gap-x-3 p-3 mt-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60 max-w-sm group">
      <div className="p-2 rounded-md bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 shrink-0">
        <FileIcon className="h-6 w-6" />
      </div>
      <div className="flex flex-col min-w-0 flex-1">
        <button
          type="button"
          onClick={() => openExternalUrl(fileUrl)}
          className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline truncate text-left flex items-center gap-x-1"
        >
          <span className="truncate">{filename}</span>
          <ExternalLink className="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-100 transition" />
        </button>
        <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">
          {ext} File
        </span>
      </div>
    </div>
  );
};

