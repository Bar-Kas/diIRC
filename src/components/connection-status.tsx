import { useConnectionStatus } from "@/hooks/use-connection-status";
import { useMockStore } from "@/lib/mock-store";
import { cn } from "@/lib/utils";

export const ConnectionStatus = () => {
  const { irc, resourceServer, internet } = useConnectionStatus();
  const statusDisplayMode = useMockStore((state) => state.statusDisplayMode) || "always";

  const hasError = !irc || !resourceServer || !internet;

  if (statusDisplayMode === "disabled") {
    return null;
  }

  if (statusDisplayMode === "on_error" && !hasError) {
    return null;
  }

  const statuses = [
    {
      id: "irc",
      name: "IRC server",
      status: irc,
    },
    {
      id: "resource",
      name: "Resource server",
      status: resourceServer,
    },
    {
      id: "internet",
      name: "Internet",
      status: internet,
    },
  ];

  return (
    <div className="relative group">
      <div
        className={cn(
          "flex items-center gap-x-2.5 px-3 py-1.5 rounded-full",
          "border border-zinc-200 dark:border-zinc-700/80",
          "bg-white/80 dark:bg-[#1e1f22]/90 backdrop-blur-md",
          "shadow-sm hover:shadow-md transition-all duration-300 ease-in-out cursor-default",
          "select-none"
        )}
      >
        {statuses.map((item, index) => (
          <div key={item.id} className="flex items-center">
            {/* Separator dot between items in expanded state */}
            {index > 0 && (
              <span className="w-0 opacity-0 group-hover:w-auto group-hover:opacity-100 group-hover:mr-2.5 text-zinc-300 dark:text-zinc-700 transition-all duration-300 select-none">
                •
              </span>
            )}

            {/* Static Status Dot */}
            <div className="flex items-center justify-center">
              <span
                className={cn(
                  "w-2.5 h-2.5 rounded-full shrink-0 transition-colors duration-200",
                  item.status ? "bg-emerald-500" : "bg-rose-500"
                )}
              />
            </div>

            {/* Expanded Label Text (Expands horizontally on hover without status text) */}
            <div className="max-w-0 opacity-0 group-hover:max-w-[150px] group-hover:opacity-100 group-hover:ml-2 transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap text-xs">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                {item.name}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
