import {
  Activity,
  AtSign,
  Clock3,
  Globe2,
  Hash,
  Info,
  Loader2,
  Server,
  ShieldCheck,
  User,
} from "lucide-react";
import type { ComponentType } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { useModal } from "@/hooks/use-modal-store";
import { useMockStore } from "@/lib/mock-store";
import { getMemberDisplayName } from "@/lib/display-name-utils";
import { cn } from "@/lib/utils";

const formatIdleTime = (seconds?: number) => {
  if (seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return null;

  const total = Math.floor(seconds);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
};

const displayValue = (value?: string | null) => value?.trim() || "Not provided";

export const WhoisModal = () => {
  const { isOpen, onClose, type, data } = useModal();
  const servers = useMockStore((state) => state.servers);
  const whois = data?.whois;
  const server = data?.serverId ? servers.find((item) => item.id === data.serverId) : undefined;
  const isModalOpen = isOpen && type === "whois" && !!whois;
  const isLoading = Boolean(whois?.loading);
  const idleTime = formatIdleTime(whois?.idleSeconds);
  const nick = whois?.nick || "Unknown user";
  const profileMember = server?.members.find(
    (member) => member.profile.name.toLowerCase() === nick.toLowerCase()
  );
  const profileDisplayName = profileMember ? getMemberDisplayName(profileMember, server) : nick;
  const channels = whois?.channels?.filter(Boolean) || [];

  const handleClose = () => onClose("whois");

  return (
    <Dialog open={isModalOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="bg-white dark:bg-[#313338] text-black dark:text-white p-0 overflow-hidden rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 w-[94vw] max-w-2xl max-h-[90vh] flex flex-col">
        <div className="relative overflow-hidden bg-indigo-600 px-6 pt-6 pb-7 text-white">
          <div className="absolute -right-12 -top-16 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-indigo-300/20 blur-3xl" />

          <DialogHeader className="relative z-10 text-left space-y-4">
            <div className="flex items-start gap-4 pr-8">
              <UserAvatar
                src={whois?.imageUrl || profileMember?.profile.imageUrl}
                name={profileDisplayName}
                className="h-16 w-16 shrink-0 rounded-2xl border border-white/25 shadow-lg"
              />
              <div className="min-w-0 flex-1">
                <DialogTitle className="truncate text-2xl font-bold tracking-tight">
                  {nick}
                </DialogTitle>
                <DialogDescription className="mt-1 flex items-center gap-1.5 truncate text-sm text-white/75">
                  <AtSign className="h-3.5 w-3.5 shrink-0" />
                  {isLoading ? "Loading WHOIS information" : "WHOIS information"}
                  {server?.name ? ` on ${server.name}` : ""}
                </DialogDescription>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {isLoading ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-2.5 py-1 text-xs font-semibold text-white">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Loading
                    </span>
                  ) : (
                    <span className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
                      whois?.away
                        ? "border-amber-200/30 bg-amber-300/20 text-amber-50"
                        : "border-emerald-200/30 bg-emerald-300/20 text-emerald-50"
                    )}>
                      <span className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        whois?.away ? "bg-amber-200" : "bg-emerald-200"
                      )} />
                      {whois?.away ? "Away" : "Online"}
                    </span>
                  )}
                  {!isLoading && whois?.isOperator && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-2.5 py-1 text-xs font-semibold text-white">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      IRC operator
                    </span>
                  )}
                </div>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6 discord-scrollbar-chat">
          {isLoading ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500 dark:text-indigo-300" />
              <div>
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Waiting for the IRC server
                </p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  WHOIS details will appear here as soon as they arrive.
                </p>
              </div>
            </div>
          ) : (
            <>
          {whois?.away && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
              <Activity className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                  Away message
                </p>
                <p className="mt-1 break-words text-sm">{displayValue(whois.awayReason)}</p>
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <InfoCard icon={User} label="Username" value={displayValue(whois?.username)} />
            <InfoCard icon={Globe2} label="Host" value={displayValue(whois?.host)} mono />
            <InfoCard icon={Info} label="Real name" value={displayValue(whois?.realname)} />
            <InfoCard icon={Clock3} label="Idle time" value={idleTime || "Not provided"} />
          </div>

          {(whois?.server || whois?.serverInfo) && (
            <section className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-[#2b2d31]/80">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-indigo-500/10 p-2 text-indigo-500 dark:bg-indigo-400/10 dark:text-indigo-300">
                  <Server className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Server
                  </p>
                  <p className="mt-1 break-words text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {displayValue(whois.server)}
                  </p>
                  {whois.serverInfo && (
                    <p className="mt-1 break-words text-xs text-zinc-500 dark:text-zinc-400">
                      {whois.serverInfo}
                    </p>
                  )}
                </div>
              </div>
            </section>
          )}

          {channels.length > 0 && (
            <section className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-[#2b2d31]/80">
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-indigo-500 dark:text-indigo-300" />
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Channels ({channels.length})
                </p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {channels.map((channel) => (
                  <span
                    key={channel}
                    className="inline-flex items-center rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 dark:border-indigo-900/70 dark:bg-indigo-950/40 dark:text-indigo-300"
                  >
                    {channel}
                  </span>
                ))}
              </div>
            </section>
          )}
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-zinc-200 bg-zinc-50 px-6 py-4 dark:border-zinc-800 dark:bg-[#2b2d31]">
          <p className="hidden text-xs text-zinc-500 dark:text-zinc-400 sm:block">
            {isLoading ? "Waiting for response from the IRC server" : "Details returned by the IRC server"}
          </p>
          <Button onClick={handleClose} variant="secondary" className="ml-auto px-5">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

type InfoCardProps = {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  mono?: boolean;
};

const InfoCard = ({ icon: Icon, label, value, mono = false }: InfoCardProps) => (
  <div className="flex min-w-0 items-start gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#2b2d31]">
    <div className="rounded-lg bg-zinc-100 p-2 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
      <Icon className="h-4 w-4" />
    </div>
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <p className={cn(
        "mt-1 break-words text-sm text-zinc-900 dark:text-zinc-100",
        mono && "font-mono text-xs"
      )}>
        {value}
      </p>
    </div>
  </div>
);
