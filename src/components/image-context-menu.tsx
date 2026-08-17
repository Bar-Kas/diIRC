import React from "react";
import { Copy, ExternalLink, Download } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { openExternalUrl, copyToClipboard, saveImageToFile } from "@/lib/system-utils";

interface ImageContextMenuProps {
  url: string;
  children: React.ReactNode;
  filename?: string;
  className?: string;
}

export const ImageContextMenu: React.FC<ImageContextMenuProps> = ({
  url,
  children,
  filename,
  className,
}) => {
  if (!url) return <>{children}</>;

  const handleCopyLink = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await copyToClipboard(url);
  };

  const handleOpenInBrowser = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await openExternalUrl(url);
  };

  const handleSaveImage = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await saveImageToFile(url, filename);
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger className={className} asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56 select-none">
        <ContextMenuItem onClick={handleCopyLink} className="gap-x-2">
          <Copy className="w-4 h-4 text-zinc-400" />
          <span>Copy image link</span>
        </ContextMenuItem>
        <ContextMenuItem onClick={handleOpenInBrowser} className="gap-x-2">
          <ExternalLink className="w-4 h-4 text-zinc-400" />
          <span>Open in browser</span>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleSaveImage} className="gap-x-2">
          <Download className="w-4 h-4 text-zinc-400" />
          <span>Save image...</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};
