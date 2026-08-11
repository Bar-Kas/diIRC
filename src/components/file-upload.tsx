import { useRef } from "react";
import { FileIcon, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FileUploadProps {
  onChange: (url?: string) => void;
  value: string;
  endpoint: "messageFile" | "serverImage";
}

export const FileUpload = ({
  onChange,
  value,
}: FileUploadProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const fileType = value?.split(".").pop()?.split("?")[0];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const localUrl = URL.createObjectURL(file);
      onChange(localUrl);
    }
  };

  if (value && fileType !== "pdf") {
    return (
      <div className="relative h-24 w-24 mx-auto">
        <img
          src={value}
          alt="Upload"
          className="rounded-full object-cover h-24 w-24 shadow-md border-2 border-indigo-500"
        />
        <button
          onClick={() => onChange("")}
          className="bg-rose-500 text-white p-1.5 rounded-full absolute top-0 right-0 shadow-sm hover:bg-rose-600 transition"
          type="button"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  if (value && fileType === "pdf") {
    return (
      <div className="relative flex items-center p-2 mt-2 rounded-md bg-background/10 border">
        <FileIcon className="h-10 w-10 fill-indigo-200 stroke-indigo-400" />
        <a 
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-2 text-sm text-indigo-500 dark:text-indigo-400 hover:underline truncate max-w-[200px]"
        >
          Attachment.pdf
        </a>
        <button
          onClick={() => onChange("")}
          className="bg-rose-500 text-white p-1 rounded-full absolute -top-2 -right-2 shadow-sm"
          type="button"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div 
      onClick={() => inputRef.current?.click()}
      className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500 dark:hover:border-indigo-500 transition group bg-zinc-50 dark:bg-zinc-900/50"
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        onChange={handleFileChange}
      />
      <div className="p-3 bg-indigo-500/10 rounded-full group-hover:bg-indigo-500/20 transition mb-2">
        <UploadCloud className="h-8 w-8 text-indigo-500" />
      </div>
      <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">
        Choose a file or drag and drop
      </p>
      <p className="text-xs text-zinc-400 mt-1">
        PNG, JPG, GIF or PDF
      </p>
      <Button 
        type="button" 
        variant="secondary" 
        size="sm" 
        className="mt-3 text-xs"
        onClick={(e) => {
          e.stopPropagation();
          inputRef.current?.click();
        }}
      >
        Select File
      </Button>
    </div>
  );
};
