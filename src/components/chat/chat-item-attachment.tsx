import { FileIcon } from "lucide-react";
import { useModal } from "@/hooks/use-modal-store";
import { ImageContextMenu } from "@/components/image-context-menu";
import { openExternalUrl } from "@/lib/system-utils";
import { SmartImage } from "@/components/chat/smart-image";

interface ChatItemAttachmentProps {
  fileUrl: string;
  content: string;
}

export const ChatItemAttachment = ({ fileUrl, content }: ChatItemAttachmentProps) => {
  const { onOpen } = useModal();
  const fileType = fileUrl.split(".").pop()?.toLowerCase();
  const isPDF = fileType === "pdf";
  const isImage = !isPDF;

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
              alt={content}
              className="max-h-[320px] max-w-full w-auto h-auto object-contain rounded-lg transition hover:opacity-95 block"
            />
          </button>
        </ImageContextMenu>
      </div>
    );
  }

  if (isPDF) {
    return (
      <div className="relative flex items-center p-2 mt-1 rounded-md bg-background/10">
        <FileIcon className="h-10 w-10 fill-indigo-200 stroke-indigo-400" />
        <button 
          type="button"
          onClick={() => openExternalUrl(fileUrl)}
          className="ml-2 text-sm text-indigo-500 dark:text-indigo-400 hover:underline text-left"
        >
          PDF File
        </button>
      </div>
    );
  }

  return null;
};
