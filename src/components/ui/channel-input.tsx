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
      <div className="flex items-center w-full bg-zinc-100 dark:bg-[#1e1f22] border border-zinc-300/80 dark:border-zinc-700/60 rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent transition-all">
        <div className="px-3 bg-zinc-200/80 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 flex items-center justify-center self-stretch border-r border-zinc-300/80 dark:border-zinc-700/60">
          <Hash className="w-4 h-4" />
        </div>
        <Input
          ref={ref}
          onChange={handleChange}
          placeholder={placeholder}
          className="bg-transparent border-0 focus-visible:ring-0 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus-visible:ring-offset-0 rounded-none px-3 h-10 font-medium"
          {...props}
        />
      </div>
    );
  }
);
ChannelInput.displayName = "ChannelInput";
