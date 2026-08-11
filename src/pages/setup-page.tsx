import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMockStore } from "@/lib/mock-store";
import { InitialModal } from "@/components/modals/initial-modal";

export const SetupPage = () => {
  const servers = useMockStore((state) => state.servers);
  const navigate = useNavigate();

  useEffect(() => {
    if (servers.length > 0) {
      navigate(`/servers/${servers[0].id}`, { replace: true });
    }
  }, [servers, navigate]);

  if (servers.length > 0) {
    return null;
  }

  return (
    <div className="h-full flex items-center justify-center bg-[#313338]">
      <InitialModal isOpen={true} />
    </div>
  );
};
