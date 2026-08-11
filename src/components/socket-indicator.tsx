import { Badge } from "@/components/ui/badge";

export const SocketIndicator = () => {
  return (
    <Badge 
      variant="outline" 
      className="bg-emerald-600/10 text-emerald-500 border-emerald-500/20 px-2 py-0.5 text-xs flex items-center gap-x-1 font-medium"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
      Static UI Mode
    </Badge>
  );
};
