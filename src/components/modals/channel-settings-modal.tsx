import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Sliders, AlertCircle, Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useModal } from "@/hooks/use-modal-store";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMockStore } from "@/lib/mock-store";

interface FlagConfig {
  flag: string;
  label: string;
  description: string;
}

const CHANNEL_FLAGS: FlagConfig[] = [
  {
    flag: "i",
    label: "Invite only (+i)",
    description: "Only invited users can join this channel",
  },
  {
    flag: "m",
    label: "Moderated (+m)",
    description: "Only channel operators and voiced users can speak",
  },
  {
    flag: "n",
    label: "No external messages (+n)",
    description: "Prevent users outside the channel from sending messages",
  },
  {
    flag: "t",
    label: "Topic protection (+t)",
    description: "Only channel operators can change the channel topic",
  },
  {
    flag: "p",
    label: "Private channel (+p)",
    description: "Hides channel from public channel listings",
  },
  {
    flag: "s",
    label: "Secret channel (+s)",
    description: "Hides channel from public listings and query commands",
  },
  {
    flag: "a",
    label: "Anonymous channel (+a)",
    description: "Hides user nicknames in channel messages",
  },
  {
    flag: "q",
    label: "Quiet channel (+q)",
    description: "Suppresses join, part, and quit announcements",
  },
  {
    flag: "r",
    label: "Registered only (+r)",
    description: "Only registered and authenticated users can join",
  },
];

export const ChannelSettingsModal = () => {
  const { isOpen, onClose, type, data } = useModal();
  const channelModesMap = useMockStore((state) => state.channelModes);
  const updateChannelModes = useMockStore((state) => state.updateChannelModes);

  const isModalOpen = isOpen && type === "channelSettings";
  const { server, channel } = data;

  const [togglingFlags, setTogglingFlags] = useState<Record<string, boolean>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const activeFlags = new Set(channel ? channelModesMap[channel.id] || [] : []);

  useEffect(() => {
    if (isModalOpen && server?.id && channel?.name) {
      setErrorMessage(null);
      setTogglingFlags({});
      // Query current channel modes from IRC server
      const chanTarget = channel.name.startsWith("#") ? channel.name : `#${channel.name}`;
      invoke("send_mode", {
        serverId: server.id,
        target: chanTarget,
        mode: null,
        params: null,
      }).catch((err) => {
        console.error("Failed to query channel mode:", err);
      });
    }
  }, [isModalOpen, server?.id, channel?.name]);

  const handleClose = () => {
    setErrorMessage(null);
    setTogglingFlags({});
    onClose("channelSettings");
  };

  const handleToggleFlag = async (flag: string, enable: boolean) => {
    if (!server?.id || !channel?.name) return;

    try {
      setTogglingFlags((prev) => ({ ...prev, [flag]: true }));
      setErrorMessage(null);

      const chanTarget = channel.name.startsWith("#") ? channel.name : `#${channel.name}`;
      const modeCmd = `${enable ? "+" : "-"}${flag}`;

      await invoke("send_mode", {
        serverId: server.id,
        target: chanTarget,
        mode: modeCmd,
        params: null,
      });

      updateChannelModes(server.id, channel.name, modeCmd);
    } catch (err: any) {
      console.error(`Failed to toggle flag ${flag}:`, err);
      setErrorMessage(err?.toString() || "Failed to update channel mode. Make sure you are channel operator.");
    } finally {
      setTogglingFlags((prev) => ({ ...prev, [flag]: false }));
    }
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="bg-white dark:bg-[#313338] text-black dark:text-white p-0 overflow-hidden sm:max-w-lg">
        <DialogHeader className="pt-6 px-6">
          <DialogTitle className="text-xl text-center font-bold flex items-center justify-center gap-2">
            <Sliders className="w-5 h-5 text-indigo-500" />
            Channel settings
          </DialogTitle>
          <p className="text-center text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Manage channel flags for <span className="font-semibold text-indigo-500">#{channel?.name}</span>
          </p>
        </DialogHeader>

        <div className="px-6 py-2">
          {errorMessage && (
            <div className="flex items-center gap-x-2 text-red-500 bg-red-500/10 p-3 rounded-md border border-red-500/20 text-xs mb-3">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="max-h-[420px] overflow-y-auto pr-1 space-y-2.5 custom-scrollbar">
            {CHANNEL_FLAGS.map(({ flag, label, description }) => {
              const isChecked = activeFlags.has(flag);
              const isToggling = !!togglingFlags[flag];

              return (
                <div
                  key={flag}
                  className="flex items-center justify-between p-3 rounded-lg bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/50 hover:bg-zinc-200/50 dark:hover:bg-zinc-800 transition"
                >
                  <div className="space-y-0.5 max-w-[78%]">
                    <div className="flex items-center gap-x-2">
                      <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                        {label}
                      </span>
                      {isChecked && (
                        <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {description}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {isToggling ? (
                      <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
                    ) : (
                      <Switch
                        checked={isChecked}
                        onCheckedChange={(checked) => handleToggleFlag(flag, checked)}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-zinc-100 dark:bg-zinc-800/40 px-6 py-3 flex justify-end">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            className="text-xs"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
