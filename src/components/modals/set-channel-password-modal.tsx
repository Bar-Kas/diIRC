import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { KeyRound, ShieldCheck, Trash2, Loader2, AlertCircle } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useModal } from "@/hooks/use-modal-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMockStore } from "@/lib/mock-store";

export const SetChannelPasswordModal = () => {
  const { isOpen, onClose, type, data } = useModal();
  const updateChannelKey = useMockStore((state) => state.updateChannelKey);

  const isModalOpen = isOpen && type === "setChannelPassword";
  const { server, channel } = data;

  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isModalOpen && channel) {
      setPassword(channel.key || "");
      setErrorMessage(null);
      setIsLoading(false);
    }
  }, [isModalOpen, channel]);

  const handleClose = () => {
    setPassword("");
    setErrorMessage(null);
    setIsLoading(false);
    onClose("setChannelPassword");
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!server?.id || !channel?.id || !password.trim()) return;

    try {
      setIsLoading(true);
      setErrorMessage(null);

      const trimmedKey = password.trim();

      await invoke("set_channel_key", {
        serverId: server.id,
        channel: channel.name,
        key: trimmedKey,
      });

      updateChannelKey(server.id, channel.id, trimmedKey);
      setIsLoading(false);
      onClose("setChannelPassword");
    } catch (err: any) {
      console.error("Failed to set channel password:", err);
      setIsLoading(false);
      setErrorMessage(err?.toString() || "Failed to set password. Make sure you are channel operator.");
    }
  };

  const handleRemovePassword = async () => {
    if (!server?.id || !channel?.id) return;

    try {
      setIsLoading(true);
      setErrorMessage(null);

      await invoke("set_channel_key", {
        serverId: server.id,
        channel: channel.name,
        key: null,
      });

      updateChannelKey(server.id, channel.id, undefined);
      setIsLoading(false);
      onClose("setChannelPassword");
    } catch (err: any) {
      console.error("Failed to remove channel password:", err);
      setIsLoading(false);
      setErrorMessage(err?.toString() || "Failed to remove password. Make sure you are channel operator.");
    }
  };

  const hasExistingKey = !!channel?.key;

  return (
    <Dialog open={isModalOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-white dark:bg-[#313338] text-black dark:text-white p-0 overflow-hidden sm:max-w-md">
        <DialogHeader className="pt-8 px-6">
          <DialogTitle className="text-2xl text-center font-bold flex items-center justify-center gap-2">
            <KeyRound className="w-6 h-6 text-indigo-500" />
            Channel Password
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSetPassword} className="space-y-4 px-6 py-2">
          <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
            Set or remove password protection for <span className="font-semibold text-indigo-500">#{channel?.name}</span>.
          </p>

          {errorMessage && (
            <div className="flex items-center gap-x-2 text-red-500 bg-red-500/10 p-3 rounded-md border border-red-500/20 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {hasExistingKey && (
            <div className="flex items-center justify-between p-3 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-600 dark:text-emerald-400">
              <div className="flex items-center gap-x-2">
                <ShieldCheck className="w-4 h-4" />
                <span>Password currently set</span>
              </div>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleRemovePassword}
                disabled={isLoading}
                className="h-8 gap-x-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remove
              </Button>
            </div>
          )}

          <div className="space-y-2">
            <label className="uppercase text-xs font-bold text-zinc-500 dark:text-zinc-400">
              {hasExistingKey ? "New Channel Password" : "Channel Password"}
            </label>
            <Input
              disabled={isLoading}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password..."
              className="bg-zinc-300/50 dark:bg-zinc-700/50 border-0 focus-visible:ring-1 focus-visible:ring-offset-0 text-black dark:text-white"
              autoFocus
            />
          </div>

          <DialogFooter className="pt-4 pb-4">
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !password.trim()}
              className="bg-indigo-500 hover:bg-indigo-600 text-white"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Set Password"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
