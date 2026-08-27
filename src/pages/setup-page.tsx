import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Server, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMockStore } from "@/lib/mock-store";
import { useModal } from "@/hooks/use-modal-store";

export const SetupPage = () => {
  const servers = useMockStore((state) => state.servers);
  const navigate = useNavigate();
  const { onOpen } = useModal();

  useEffect(() => {
    if (servers.length > 0) {
      navigate(`/servers/${servers[0].id}`, { replace: true });
    }
  }, [servers, navigate]);

  if (servers.length > 0) {
    return null;
  }

  return (
    <div className="flex-1 bg-white dark:bg-[#313338] flex flex-col items-center justify-center h-full p-6 text-center">
      <div className="flex flex-col items-center max-w-md space-y-4">
        <div className="w-16 h-16 rounded-full bg-zinc-200 dark:bg-zinc-700/50 flex items-center justify-center mb-2">
          <Server className="w-8 h-8 text-zinc-500 dark:text-zinc-400" />
        </div>
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          No servers added
        </h2>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm max-w-xs">
          You haven't added any IRC servers yet. Add a server to start chatting.
        </p>
        <Button
          onClick={() => onOpen("createServer")}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-5 py-2 flex items-center gap-x-2"
        >
          <Plus className="w-4 h-4" />
          Add server
        </Button>
      </div>
    </div>
  );
};

