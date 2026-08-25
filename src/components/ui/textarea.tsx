import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className,
      autoComplete = "off",
      autoCorrect = "off",
      autoCapitalize = "off",
      spellCheck = false,
      ...props
    },
    ref
  ) => {
    return (
      <textarea
        autoComplete={autoComplete}
        autoCorrect={autoCorrect}
        autoCapitalize={autoCapitalize}
        spellCheck={spellCheck}
        className={cn(
          "flex min-h-[44px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
