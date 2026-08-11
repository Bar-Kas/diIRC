import { useState } from "react";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Monitor, ShieldCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MediaRoomProps {
  chatId: string;
  video: boolean;
  audio: boolean;
}

export const MediaRoom = ({ video, audio }: MediaRoomProps) => {
  const [isMuted, setIsMuted] = useState(!audio);
  const [isVideoOff, setIsVideoOff] = useState(!video);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  return (
    <div className="flex-1 flex flex-col bg-[#111214] h-full relative overflow-hidden">
      {/* Top Bar */}
      <div className="h-12 border-b border-zinc-800 flex items-center justify-between px-4 bg-[#1e1f22]">
        <div className="flex items-center gap-x-2 text-sm font-semibold text-zinc-200">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          Encrypted Voice & Video Stream
        </div>
        <div className="flex items-center gap-x-2 text-xs text-zinc-400">
          <Users className="h-4 w-4" />
          3 Connected
        </div>
      </div>

      {/* Participant Video Grid */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 p-4 items-center justify-center overflow-y-auto">
        {/* User 1 */}
        <div className="relative aspect-video rounded-xl bg-zinc-900 overflow-hidden border border-zinc-800 flex items-center justify-center group shadow-lg">
          {!isVideoOff ? (
            <img
              src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=600&auto=format&fit=crop&q=80"
              alt="Kawish Ali"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center gap-y-2">
              <div className="h-20 w-20 rounded-full bg-indigo-500 flex items-center justify-center text-white text-2xl font-bold">
                KA
              </div>
              <span className="text-xs text-zinc-400">Camera Off</span>
            </div>
          )}
          <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-md text-xs text-white font-medium flex items-center gap-x-2">
            <span>Kawish Ali (You)</span>
            {isMuted && <MicOff className="h-3.5 w-3.5 text-rose-500" />}
          </div>
        </div>

        {/* User 2 */}
        <div className="relative aspect-video rounded-xl bg-zinc-900 overflow-hidden border border-zinc-800 flex items-center justify-center group shadow-lg">
          <img
            src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600&auto=format&fit=crop&q=80"
            alt="Sarah Connor"
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-md text-xs text-white font-medium">
            Sarah Connor
          </div>
        </div>
      </div>

      {/* Media Controls Bar */}
      <div className="h-20 bg-[#1e1f22] border-t border-zinc-800 flex items-center justify-center gap-x-4 px-4">
        <Button
          size="icon"
          variant={isMuted ? "destructive" : "secondary"}
          onClick={() => setIsMuted(!isMuted)}
          className="h-12 w-12 rounded-full"
        >
          {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </Button>

        <Button
          size="icon"
          variant={isVideoOff ? "destructive" : "secondary"}
          onClick={() => setIsVideoOff(!isVideoOff)}
          className="h-12 w-12 rounded-full"
        >
          {isVideoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
        </Button>

        <Button
          size="icon"
          variant={isScreenSharing ? "default" : "secondary"}
          onClick={() => setIsScreenSharing(!isScreenSharing)}
          className="h-12 w-12 rounded-full"
        >
          <Monitor className="h-5 w-5" />
        </Button>

        <Button
          size="icon"
          variant="destructive"
          className="h-12 w-12 rounded-full bg-rose-600 hover:bg-rose-700"
        >
          <PhoneOff className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
};
