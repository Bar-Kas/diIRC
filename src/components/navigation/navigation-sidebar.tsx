import { useState, useRef } from "react";
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

  const dragRef = useRef<{
    activeId: string;
    sourceIndex: number;
    startY: number;
    isDragging: boolean;
  } | null>(null);

  const findTargetServer = (
    clientY: number,
    activeId: string
  ): { targetId: string; position: "above" | "below" } | null => {
    const items = Array.from(document.querySelectorAll<HTMLElement>("[data-server-id]"));
    if (items.length <= 1) return null;

    for (const item of items) {
      const id = item.getAttribute("data-server-id");
      if (!id || id === activeId) continue;

      const rect = item.getBoundingClientRect();
      if (clientY >= rect.top && clientY <= rect.bottom) {
        const isAbove = clientY < rect.top + rect.height / 2;
        return { targetId: id, position: isAbove ? "above" : "below" };
      }
    }

    // Check above first or below last item
    const otherItems = items.filter((el) => el.getAttribute("data-server-id") !== activeId);
    if (otherItems.length > 0) {
      const first = otherItems[0];
      const firstRect = first.getBoundingClientRect();
      if (clientY < firstRect.top) {
        return { targetId: first.getAttribute("data-server-id")!, position: "above" };
      }
      const last = otherItems[otherItems.length - 1];
      const lastRect = last.getBoundingClientRect();
      if (clientY > lastRect.bottom) {
        return { targetId: last.getAttribute("data-server-id")!, position: "below" };
      }
    }

    return null;
  };

  const handlePointerDown = (e: React.PointerEvent, id: string, index: number) => {
    if (e.button !== 0) return; // only left click
    dragRef.current = {
      activeId: id,
      sourceIndex: index,
      startY: e.clientY,
      isDragging: false,
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (!dragRef.current) return;
      const dist = Math.abs(moveEvent.clientY - dragRef.current.startY);
      if (!dragRef.current.isDragging) {
        if (dist > 4) {
          dragRef.current.isDragging = true;
          setDraggedServerId(dragRef.current.activeId);
          document.body.style.userSelect = "none";
          document.body.style.cursor = "grabbing";
        } else {
          return;
        }
      }

      const target = findTargetServer(moveEvent.clientY, dragRef.current.activeId);
      if (target) {
        setDragOverServerId(target.targetId);
        setDropPosition(target.position);
      } else {
        setDragOverServerId(null);
        setDropPosition(null);
      }
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);

      document.body.style.userSelect = "";
      document.body.style.cursor = "";

      const state = dragRef.current;
      dragRef.current = null;

      if (!state || !state.isDragging) {
        setDraggedServerId(null);
        setDragOverServerId(null);
        setDropPosition(null);
        return;
      }

      const target = findTargetServer(upEvent.clientY, state.activeId);
      if (target) {
        const targetIndex = servers.findIndex((s) => s.id === target.targetId);
        const sourceIndex = state.sourceIndex;
        if (targetIndex !== -1 && sourceIndex !== -1) {
          let destinationIndex = targetIndex;
          if (sourceIndex < targetIndex) {
            destinationIndex = target.position === "above" ? targetIndex - 1 : targetIndex;
          } else if (sourceIndex > targetIndex) {
            destinationIndex = target.position === "above" ? targetIndex : targetIndex + 1;
          }
          if (destinationIndex !== sourceIndex) {
            reorderServers(sourceIndex, destinationIndex);
          }
        }
      }

      setDraggedServerId(null);
      setDragOverServerId(null);
      setDropPosition(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
  };

  return (
    <div
      className="space-y-4 flex flex-col items-center h-full text-primary w-full dark:bg-[#1E1F22] bg-[#E3E5E8] py-3 select-none"
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
                onPointerDown={handlePointerDown}
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
