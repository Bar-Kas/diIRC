import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { User } from "lucide-react";

interface UserAvatarProps {
  src?: string;
  name?: string;
  className?: string;
}

export const getAvatarBgStyle = (seed: string = "") => {
  if (!seed) return { backgroundColor: "hsl(239, 84%, 67%)" };
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return { backgroundColor: `hsl(${hue}, 60%, 46%)` };
};

export const UserAvatar = ({
  src,
  name,
  className
}: UserAvatarProps) => {
  const style = getAvatarBgStyle(name || "");

  return (
    <Avatar 
      className={cn(
        "h-7 w-7 md:h-10 md:w-10 flex items-center justify-center select-none shrink-0",
        className
      )}
      style={style}
    >
      {src && <AvatarImage src={src} className="object-cover" />}
      <User className="h-1/2 w-1/2 text-white stroke-[2.5]" />
    </Avatar>
  );
};

