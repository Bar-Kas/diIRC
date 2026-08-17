import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useModal } from "@/hooks/use-modal-store";
import { useMockStore } from "@/lib/mock-store";
import { ImageUploadProvider, LitterboxTime } from "@/lib/upload/types";
import { 
  Settings, 
  EyeOff, 
  Link2, 
  Server, 
  Globe, 
  UploadCloud, 
  AlertTriangle, 
  Key, 
  Plus, 
  Trash2, 
  ShieldCheck 
} from "lucide-react";

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

  const uploadConfig = useMockStore((state) => state.uploadConfig);
  const setUploadConfig = useMockStore((state) => state.setUploadConfig);

  const urlAuthRules = useMockStore((state) => state.urlAuthRules);
  const addUrlAuthRule = useMockStore((state) => state.addUrlAuthRule);
  const removeUrlAuthRule = useMockStore((state) => state.removeUrlAuthRule);

  // New URL Rule Form State
  const [newRulePrefix, setNewRulePrefix] = useState("");
  const [newRuleHeaderName, setNewRuleHeaderName] = useState("Authorization");
  const [newRuleHeaderValue, setNewRuleHeaderValue] = useState("");

  const isModalOpen = isOpen && type === "settings";

  const handleClose = () => {
    onClose();
  };

  const handleProviderChange = (provider: ImageUploadProvider) => {
    setUploadConfig({
      ...uploadConfig,
      provider,
    });
  };

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRulePrefix || !newRuleHeaderName || !newRuleHeaderValue) return;
    addUrlAuthRule({
      urlPrefix: newRulePrefix,
      headerName: newRuleHeaderName,
      headerValue: newRuleHeaderValue,
    });
    setNewRulePrefix("");
    setNewRuleHeaderValue("");
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-white dark:bg-[#313338] text-zinc-900 dark:text-zinc-100 p-0 overflow-hidden max-w-lg border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-xl">
        <DialogHeader className="pt-6 px-6 space-y-1">
          <DialogTitle className="text-2xl text-center font-bold text-zinc-900 dark:text-zinc-100 flex items-center justify-center gap-x-2">
            <Settings className="w-6 h-6 text-indigo-500" />
            Settings
          </DialogTitle>
          <DialogDescription className="text-center text-zinc-500 dark:text-zinc-400 text-xs sm:text-sm">
            Manage application preferences, image servers, and authorization rules.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-6 space-y-5 max-h-[75vh] overflow-y-auto">
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
                  Use API to fetch title, description, and thumbnails for web pages. Direct images don't use the API.
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
            </div>
          )}

          {/* SECTION: IMAGE UPLOADER SERVER */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-700/60 bg-zinc-50 dark:bg-[#2b2d31] p-4 space-y-4 shadow-sm transition">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-x-2">
                <UploadCloud className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                <label className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  Image Upload Provider
                </label>
              </div>
              {uploadConfig.provider === "litterbox" && (
                <span className="text-xs px-2 py-0.5 font-bold rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                  Temporary Hosting
                </span>
              )}
              {uploadConfig.provider === "pomf" && (
                <span className="text-xs px-2 py-0.5 font-bold rounded bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">
                  POMF Hosting
                </span>
              )}
            </div>

            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Select a service for uploading images pasted from clipboard or files. A direct link will be sent to the IRC chat.
            </p>

            {/* Provider Selection Dropdown */}
            <select
              value={uploadConfig.provider}
              onChange={(e) => handleProviderChange(e.target.value as ImageUploadProvider)}
              className="w-full bg-white dark:bg-[#1e1f22] border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="disabled">🚫 Disabled (Upload disabled)</option>
              <option value="litterbox" className="text-amber-600 font-bold">
                ⚠️ Litterbox (Public, expiration 1h - 72h)
              </option>
              <option value="pomf" className="text-indigo-600 font-bold">
                🐱 POMF / Pomf.cat (Public)
              </option>
            </select>

            {/* Litterbox Warning & Retention Config */}
            {uploadConfig.provider === "litterbox" && (
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 space-y-2 text-xs text-amber-600 dark:text-amber-400">
                <div className="flex items-center gap-x-1.5 font-bold">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                  Information (Litterbox Temporary):
                </div>
                <p className="text-[11px] leading-relaxed opacity-90">
                  Images expire automatically after the selected duration. They remain public until deleted.
                </p>

                <div className="pt-1 flex items-center justify-between">
                  <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                    Retention duration:
                  </label>
                  <select
                    value={uploadConfig.litterboxTime || "24h"}
                    onChange={(e) =>
                      setUploadConfig({ ...uploadConfig, litterboxTime: e.target.value as LitterboxTime })
                    }
                    className="bg-white dark:bg-[#1e1f22] border border-amber-500/40 rounded px-2 py-1 text-xs font-semibold text-zinc-900 dark:text-zinc-100"
                  >
                    <option value="1h">1 Hour</option>
                    <option value="12h">12 Hours</option>
                    <option value="24h">24 Hours (Default)</option>
                    <option value="72h">72 Hours (3 Days)</option>
                  </select>
                </div>
              </div>
            )}

            {/* POMF Configuration */}
            {uploadConfig.provider === "pomf" && (
              <div className="space-y-3 pt-1">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    POMF Server Address (Upload URL)
                  </label>
                  <Input
                    value={uploadConfig.pomfUrl || ""}
                    onChange={(e) => setUploadConfig({ ...uploadConfig, pomfUrl: e.target.value })}
                    placeholder="https://pomf.cat/upload.php"
                    className="bg-white dark:bg-[#1e1f22] border-zinc-300 dark:border-zinc-700 text-xs"
                  />
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Leave default address <code className="text-indigo-400">https://pomf.cat/upload.php</code> or enter your custom POMF instance address.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* SECTION: READING AUTHORIZATION (URL RULES) */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-700/60 bg-zinc-50 dark:bg-[#2b2d31] p-4 space-y-3 shadow-sm transition">
            <div className="flex items-center gap-x-2">
              <Key className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
              <label className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Image Read Authorization (URL Headers)
              </label>
            </div>

            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Define HTTP headers (e.g., tokens) to be sent when fetching and previewing images from specified URL prefixes.
            </p>

            {/* List of rules */}
            {urlAuthRules.length > 0 ? (
              <div className="space-y-2">
                {urlAuthRules.map((rule) => (
                  <div
                    key={rule.id}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-[#1e1f22] border border-zinc-200 dark:border-zinc-700/80 text-xs"
                  >
                    <div className="space-y-0.5 overflow-hidden pr-2">
                      <div className="font-bold text-indigo-500 truncate">{rule.urlPrefix}</div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
                        {rule.headerName}: {rule.headerValue.slice(0, 15)}...
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeUrlAuthRule(rule.id)}
                      className="h-7 w-7 text-rose-500 hover:bg-rose-500/10 shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-400 dark:text-zinc-500 italic">No read authorization rules configured.</p>
            )}

            {/* Form to add new rule */}
            <form onSubmit={handleAddRule} className="pt-2 space-y-2 border-t border-zinc-200 dark:border-zinc-700/60">
              <div className="space-y-1">
                <Input
                  value={newRulePrefix}
                  onChange={(e) => setNewRulePrefix(e.target.value)}
                  placeholder="URL Prefix (e.g. https://private-host.org/)"
                  className="bg-white dark:bg-[#1e1f22] border-zinc-300 dark:border-zinc-700 text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={newRuleHeaderName}
                  onChange={(e) => setNewRuleHeaderName(e.target.value)}
                  placeholder="Header (Authorization / X-Api-Key)"
                  className="bg-white dark:bg-[#1e1f22] border-zinc-300 dark:border-zinc-700 text-xs font-mono"
                />
                <Input
                  value={newRuleHeaderValue}
                  onChange={(e) => setNewRuleHeaderValue(e.target.value)}
                  placeholder="Value (Bearer token / key)"
                  className="bg-white dark:bg-[#1e1f22] border-zinc-300 dark:border-zinc-700 text-xs font-mono"
                />
              </div>
              <Button
                type="submit"
                variant="secondary"
                size="sm"
                className="w-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/60"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Authorization Rule
              </Button>
            </form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
