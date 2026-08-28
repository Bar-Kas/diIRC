import { useState } from "react";
import { Settings, ShieldCheck } from "lucide-react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { ModeToggle } from "@/components/mode-toggle";
import { Separator } from "@/components/ui/separator";
import { ActionTooltip } from "@/components/action-tooltip";
import { useMockStore } from "@/lib/mock-store";
import { useModal } from "@/hooks/use-modal-store";

import { NavigationAction } from "./navigation-action";
import { NavigationItem } from "./navigation-item";

export const NavigationSidebar = () => {
  const servers = useMockStore((state) => state.servers);
  const reorderServers = useMockStore((state) => state.reorderServers);
  const { onOpen } = useModal();

  const [draggedServerId, setDraggedServerId] = useState<string | null>(null);
  const [dragOverServerId, setDragOverServerId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<"above" | "below" | null>(null);

  const handleDragStart = (e: React.DragEvent, id: string, _index: number) => {
    setDraggedServerId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  };

  const handleDragOver = (e: React.DragEvent, id: string, _index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (draggedServerId === id) {
      setDragOverServerId(null);
      setDropPosition(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const isAbove = e.clientY < rect.top + rect.height / 2;
    setDragOverServerId(id);
    setDropPosition(isAbove ? "above" : "below");
  };

  const handleDragLeave = (_e: React.DragEvent, id: string) => {
    if (dragOverServerId === id) {
      setDragOverServerId(null);
      setDropPosition(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetId: string, targetIndex: number) => {
    e.preventDefault();
    if (!draggedServerId || draggedServerId === targetId) {
      setDraggedServerId(null);
      setDragOverServerId(null);
      setDropPosition(null);
      return;
    }

    const sourceIndex = servers.findIndex((s) => s.id === draggedServerId);
    if (sourceIndex === -1) return;

    let destinationIndex = targetIndex;
    if (dropPosition === "above") {
      destinationIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
    } else {
      destinationIndex = sourceIndex > targetIndex ? targetIndex + 1 : targetIndex;
    }

    reorderServers(sourceIndex, destinationIndex);
    setDraggedServerId(null);
    setDragOverServerId(null);
    setDropPosition(null);
  };

  const handleDragEnd = () => {
    setDraggedServerId(null);
    setDragOverServerId(null);
    setDropPosition(null);
  };

  return (
    <div
      className="space-y-4 flex flex-col items-center h-full text-primary w-full dark:bg-[#1E1F22] bg-[#E3E5E8] py-3"
    >
      <NavigationAction />
      <Separator
        className="h-[2px] bg-zinc-300 dark:bg-zinc-700 rounded-md w-10 mx-auto"
      />
      <ScrollArea className="flex-1 w-full no-scrollbar">
        <div className="pt-1.5">
          {servers.map((server, index) => (
            <div key={server.id} className="mb-4">
              <NavigationItem
                id={server.id}
                name={server.name}
                imageUrl={server.imageUrl}
                index={index}
                isDragging={draggedServerId === server.id}
                dropPosition={dragOverServerId === server.id ? dropPosition : null}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
              />
            </div>
          ))}
        </div>
      </ScrollArea>
      <div className="pb-3 mt-auto flex items-center flex-col gap-y-4">
        <ModeToggle />
        <ActionTooltip side="right" align="center" label="Role icons">
          <button
            onClick={() => onOpen("roleIcons")}
            className="group flex items-center justify-center"
          >
            <div className="flex mx-3 h-[48px] w-[48px] rounded-[24px] group-hover:rounded-[16px] transition-all overflow-hidden items-center justify-center bg-background dark:bg-neutral-700 group-hover:bg-emerald-500">
              <ShieldCheck className="text-zinc-500 dark:text-zinc-400 group-hover:text-white transition" size={24} />
            </div>
          </button>
        </ActionTooltip>
        <ActionTooltip side="right" align="center" label="Settings">
          <button
            onClick={() => onOpen("settings")}
            className="group flex items-center justify-center"
          >
            <div className="flex mx-3 h-[48px] w-[48px] rounded-[24px] group-hover:rounded-[16px] transition-all overflow-hidden items-center justify-center bg-background dark:bg-neutral-700 group-hover:bg-indigo-500">
              <Settings className="text-zinc-500 dark:text-zinc-400 group-hover:text-white transition" size={24} />
            </div>
          </button>
        </ActionTooltip>
      </div>
    </div>
  );
};
