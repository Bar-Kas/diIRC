import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { useModal } from "@/hooks/use-modal-store";
import { useMockStore } from "@/lib/mock-store";
import { Settings, EyeOff, Link2, Server, Globe } from "lucide-react";

export const SettingsModal = () => {
  const { isOpen, onClose, type } = useModal();
  const compactMode = useMockStore((state) => state.compactMode);
  const setCompactMode = useMockStore((state) => state.setCompactMode);

  const enableLinkPreviews = useMockStore((state) => state.enableLinkPreviews);
  const setEnableLinkPreviews = useMockStore((state) => state.setEnableLinkPreviews);

  const enableWebPagePreviews = useMockStore((state) => state.enableWebPagePreviews);
  const setEnableWebPagePreviews = useMockStore((state) => state.setEnableWebPagePreviews);

  const linkPreviewApiUrl = useMockStore((state) => state.linkPreviewApiUrl);
  const setLinkPreviewApiUrl = useMockStore((state) => state.setLinkPreviewApiUrl);

  const isModalOpen = isOpen && type === "settings";

  const handleClose = () => {
    onClose();
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-white dark:bg-[#313338] text-zinc-900 dark:text-zinc-100 p-0 overflow-hidden max-w-md border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-xl">
        <DialogHeader className="pt-6 px-6 space-y-1">
          <DialogTitle className="text-2xl text-center font-bold text-zinc-900 dark:text-zinc-100 flex items-center justify-center gap-x-2">
            <Settings className="w-6 h-6 text-indigo-500" />
            Settings
          </DialogTitle>
          <DialogDescription className="text-center text-zinc-500 dark:text-zinc-400 text-xs sm:text-sm">
            Manage application appearance and display preferences.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Compact Mode */}
          <div className="flex flex-row items-center justify-between rounded-xl border border-zinc-200 dark:border-zinc-700/60 bg-zinc-50 dark:bg-[#2b2d31] p-4 shadow-sm transition">
            <div className="space-y-0.5 pr-4">
              <div className="flex items-center gap-x-2">
                <EyeOff className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                <label className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 cursor-pointer">
                  Compact Mode
                </label>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Hide all user avatars in the chat window.
              </p>
            </div>
            <Switch
              checked={compactMode}
              onCheckedChange={(checked) => setCompactMode(checked)}
            />
          </div>

          {/* Switch 1: Enable Link Previews (All embeds) */}
          <div className="flex flex-row items-center justify-between rounded-xl border border-zinc-200 dark:border-zinc-700/60 bg-zinc-50 dark:bg-[#2b2d31] p-4 shadow-sm transition">
            <div className="space-y-0.5 pr-4">
              <div className="flex items-center gap-x-2">
                <Link2 className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                <label className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 cursor-pointer">
                  Link Previews (Embeds)
                </label>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Show media previews (images, videos, YouTube, websites) in chat.
              </p>
            </div>
            <Switch
              checked={enableLinkPreviews}
              onCheckedChange={(checked) => setEnableLinkPreviews(checked)}
            />
          </div>

          {/* Switch 2: Web Page Metadata API Previews */}
          {enableLinkPreviews && (
            <div className="flex flex-row items-center justify-between rounded-xl border border-zinc-200 dark:border-zinc-700/60 bg-zinc-50 dark:bg-[#2b2d31] p-4 shadow-sm transition">
              <div className="space-y-0.5 pr-4">
                <div className="flex items-center gap-x-2">
                  <Globe className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                  <label className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 cursor-pointer">
                    Fetch Web Page Metadata (API)
                  </label>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  Use API to fetch title, description, and thumbnails for web pages. Direct images and YouTube don't use the API.
                </p>
              </div>
              <Switch
                checked={enableWebPagePreviews}
                onCheckedChange={(checked) => setEnableWebPagePreviews(checked)}
              />
            </div>
          )}

          {/* Custom Link Preview API Endpoint Input */}
          {enableLinkPreviews && enableWebPagePreviews && (
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-700/60 bg-zinc-50 dark:bg-[#2b2d31] p-4 space-y-2 shadow-sm transition">
              <div className="flex items-center gap-x-2">
                <Server className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                <label className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Preview API Endpoint
                </label>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Open-Source metadata API URL for fetching web page previews.
              </p>
              <Input
                value={linkPreviewApiUrl}
                onChange={(e) => setLinkPreviewApiUrl(e.target.value)}
                placeholder="https://api.microlink.io"
                className="bg-white dark:bg-[#1e1f22] border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 text-xs mt-2 focus-visible:ring-indigo-500"
              />
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                Self-hostable open-source engine: <code className="text-indigo-500 font-mono">microlink/api</code>
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
