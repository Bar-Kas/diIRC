import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useParams } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useModal } from "@/hooks/use-modal-store";
import { useConnectionStatus } from "@/hooks/use-connection-status";
import { useMockStore } from "@/lib/mock-store";
import { AlertCircle, CheckCircle2, RefreshCw, Shield, Wifi, Globe } from "lucide-react";

export const ConnectionDetailsModal = () => {
  const { isOpen, onClose, type } = useModal();
  const { serverId } = useParams();
  const { irc, ircError, resourceServer, internet } = useConnectionStatus();

  const servers = useMockStore((state) => state.servers);
  const currentProfile = useMockStore((state) => state.currentProfile);
  const uploadConfig = useMockStore((state) => state.uploadConfig);
  const setIrcConnected = useMockStore((state) => state.setIrcConnected);

  const activeServer = (serverId ? servers.find((s) => s.id === serverId) : null) || servers[0];
  const [isReconnecting, setIsReconnecting] = useState(false);

  const isModalOpen = isOpen && type === "connectionDetails";

  const handleReconnect = async () => {
    if (!activeServer || isReconnecting) return;
    setIsReconnecting(true);

    const nicks = activeServer.nicknames && activeServer.nicknames.length > 0
      ? activeServer.nicknames
      : [activeServer.nicknames?.[0] || currentProfile.name.replace(/\s+/g, "") || "ReactUser"];

    try {
      await invoke("disconnect_irc", { serverId: activeServer.id }).catch(() => { });
      await new Promise((res) => setTimeout(res, 300));
      await invoke("connect_irc", {
        params: {
          serverId: activeServer.id,
          host: activeServer.host || "127.0.0.1",
          port: activeServer.port || 6667,
          nicknames: nicks,
          realname: activeServer.realname || "",
          password: activeServer.password || "",
          channels: activeServer.channels.map((c) => ({
            name: c.name,
            password: c.key || null,
          })),
          useTls: activeServer.useTls || false,
          parseLegacyZncTimestamps: activeServer.parseLegacyZncTimestamps || false,
        },
      });
    } catch (err: any) {
      console.error("Reconnection failed:", err);
      const errMsg = err instanceof Error ? err.message : String(err);
      setIrcConnected(activeServer.id, false, errMsg);
    } finally {
      setIsReconnecting(false);
    }
  };

  const handleClose = () => {
    onClose("connectionDetails");
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="bg-white dark:bg-[#313338] text-black dark:text-white p-0 max-w-xl overflow-hidden rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800">
        <DialogHeader className="pt-6 px-6 pb-2">
          <DialogTitle className="text-xl font-bold flex items-center gap-x-2">
            <Wifi className="w-5 h-5 text-indigo-500" />
            Connection details
          </DialogTitle>
        </DialogHeader>

        <div className="p-6 space-y-4">
          {/* IRC Status Card */}
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#2b2d31] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-x-2.5">
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-500">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    IRC server
                  </h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                    {activeServer?.name} ({activeServer?.host || "127.0.0.1"}:{activeServer?.port || 6667})
                    {activeServer?.useTls && " • TLS"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-x-2">
                <span
                  className={`inline-flex items-center gap-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${irc
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                    : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                    }`}
                >
                  {irc ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                  {irc ? "Connected" : "Disconnected"}
                </span>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleReconnect}
                  disabled={isReconnecting}
                  className="h-8 px-2.5 text-xs gap-x-1"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isReconnecting ? "animate-spin" : ""}`} />
                  {isReconnecting ? "Connecting..." : "Reconnect"}
                </Button>
              </div>
            </div>

            {/* Connection Error Banner */}
            {!irc && ircError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs space-y-1">
                <div className="font-semibold flex items-center gap-x-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  Connection error details
                </div>
                <p className="font-mono text-[11px] break-all opacity-90 pl-5">
                  {ircError}
                </p>
              </div>
            )}
          </div>

          {/* Secondary Services (Resource Server & Internet) */}
          <div className="grid grid-cols-2 gap-3">
            {/* Resource Server Card */}
            <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#2b2d31] flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  Resource server
                </p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 capitalize">
                  {uploadConfig.provider}
                </p>
              </div>
              <span
                className={`inline-flex items-center gap-x-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${resourceServer
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  }`}
              >
                {resourceServer ? "Connected" : "Disabled"}
              </span>
            </div>

            {/* Internet Status Card */}
            <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#2b2d31] flex items-center justify-between">
              <div className="flex items-center gap-x-2">
                <Globe className="w-4 h-4 text-zinc-500" />
                <div>
                  <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    Internet
                  </p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    {internet ? "Browser online" : "Offline"}
                  </p>
                </div>
              </div>
              <span
                className={`inline-flex items-center gap-x-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${internet
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                  }`}
              >
                {internet ? "Online" : "Offline"}
              </span>
            </div>
          </div>
        </div>

        <div className="p-4 bg-zinc-100 dark:bg-[#2b2d31] flex justify-end border-t border-zinc-200 dark:border-zinc-800">
          <Button onClick={handleClose} variant="secondary" className="px-5">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
