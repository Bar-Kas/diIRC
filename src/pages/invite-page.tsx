import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMockStore } from "@/lib/mock-store";

export const InvitePage = () => {
  const { inviteCode } = useParams();
  const navigate = useNavigate();
  const joinServerByInvite = useMockStore((state) => state.joinServerByInvite);

  useEffect(() => {
    if (inviteCode) {
      const server = joinServerByInvite(inviteCode);
      if (server) {
        navigate(`/servers/${server.id}`, { replace: true });
        return;
      }
    }
    navigate("/", { replace: true });
  }, [inviteCode, joinServerByInvite, navigate]);

  return (
    <div className="h-full flex items-center justify-center bg-[#313338] text-white">
      <p className="text-sm font-medium">Joining server...</p>
    </div>
  );
};
