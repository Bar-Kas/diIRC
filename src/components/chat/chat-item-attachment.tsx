import { FileIcon } from "lucide-react";

interface ChatItemAttachmentProps {
  fileUrl: string;
  content: string;
}

export const ChatItemAttachment = ({ fileUrl, content }: ChatItemAttachmentProps) => {
  const fileType = fileUrl.split(".").pop()?.toLowerCase();
  const isPDF = fileType === "pdf";
  const isImage = !isPDF;

  if (isImage) {
    return (
      <a 
        href={fileUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="relative rounded-md mt-1 overflow-hidden border flex items-center bg-secondary h-48 w-48"
      >
        <img
          src={fileUrl}
          alt={content}
          className="w-full h-full object-cover"
        />
      </a>
    );
  }

  if (isPDF) {
    return (
      <div className="relative flex items-center p-2 mt-1 rounded-md bg-background/10">
        <FileIcon className="h-10 w-10 fill-indigo-200 stroke-indigo-400" />
        <a 
          href={fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-2 text-sm text-indigo-500 dark:text-indigo-400 hover:underline"
        >
          PDF File
        </a>
      </div>
    );
  }

  return null;
};
