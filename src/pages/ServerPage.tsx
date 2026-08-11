import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMockStore } from "@/lib/mock-store";
import { ChannelType } from "@/types";

export const ServerPage = () => {
  const { serverId } = useParams();
  const navigate = useNavigate();
  const servers = useMockStore((state) => state.servers);

  useEffect(() => {
    const server = servers.find((s) => s.id === serverId) || servers[0];

    if (server) {
      const initialChannel = 
        server.channels.find((c) => c.name === "general" && c.type === ChannelType.TEXT) ||
        server.channels[0];

      if (initialChannel) {
        navigate(`/servers/${server.id}/channels/${initialChannel.id}`, { replace: true });
      }
    } else {
      navigate("/", { replace: true });
    }
  }, [serverId, servers, navigate]);

  return null;
};
