import { useParams, Outlet, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { NavigationSidebar } from "@/components/navigation/navigation-sidebar";
import { ServerSidebar } from "@/components/server/server-sidebar";
import { useMockStore } from "@/lib/mock-store";

export const MainLayout = () => {
  const { serverId } = useParams();
  const servers = useMockStore((state) => state.servers);
  const navigate = useNavigate();

  const activeServer = servers.find((s) => s.id === serverId) || servers[0];

  useEffect(() => {
    if (!servers || servers.length === 0) {
      navigate("/", { replace: true });
    } else if (!activeServer) {
      navigate(`/servers/${servers[0].id}`, { replace: true });
    }
  }, [serverId, activeServer, servers, navigate]);

  if (!activeServer) {
    return null;
  }

  return (
    <div className="h-full">
      <div className="hidden md:flex h-full w-[72px] z-30 flex-col fixed inset-y-0 left-0">
        <NavigationSidebar />
      </div>
      <div className="hidden md:flex h-full w-60 z-20 flex-col fixed inset-y-0 left-[72px]">
        <ServerSidebar serverId={activeServer.id} />
      </div>
      <main className="md:pl-[312px] h-full">
        <Outlet />
      </main>
    </div>
  );
};
