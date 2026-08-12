import * as React from "react";
import { Hash } from "lucide-react";
import { Input } from "@/components/ui/input";

export interface ChannelInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

export const ChannelInput = React.forwardRef<HTMLInputElement, ChannelInputProps>(
  ({ className, onChange, placeholder = "general", ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let val = e.target.value;
      if (val.startsWith("#")) {
        val = val.substring(1);
      }
      const syntheticEvent = {
        ...e,
        target: {
          ...e.target,
          value: val,
        },
      };
      if (onChange) {
        onChange(syntheticEvent as React.ChangeEvent<HTMLInputElement>);
      }
    };

    return (
      <div className="flex items-center w-full bg-zinc-300/50 rounded-md overflow-hidden">
        <div className="px-3 bg-zinc-400/30 text-zinc-600 flex items-center justify-center self-stretch">
          <Hash className="w-4 h-4" />
        </div>
        <Input
          ref={ref}
          onChange={handleChange}
          placeholder={placeholder}
          className="bg-transparent border-0 focus-visible:ring-0 text-black focus-visible:ring-offset-0 rounded-none px-2"
          {...props}
        />
      </div>
    );
  }
);
ChannelInput.displayName = "ChannelInput";
