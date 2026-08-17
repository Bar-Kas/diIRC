import React, { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ImageOff, ImageIcon } from "lucide-react";

interface SmartImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  aspectRatio?: number;
  showIconPlaceholder?: boolean;
  onImageLoad?: () => void;
  onImageError?: () => void;
}

export const SmartImage: React.FC<SmartImageProps> = ({
  src,
  alt,
  className,
  containerClassName,
  aspectRatio: initialAspectRatio,
  showIconPlaceholder = true,
  onImageLoad,
  onImageError,
  style,
  ...props
}) => {
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  const [ratio, setRatio] = useState<number | undefined>(initialAspectRatio);

  useEffect(() => {
    setIsLoaded(false);
    setHasError(false);
    setRatio(initialAspectRatio);
  }, [src, initialAspectRatio]);

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const img = e.currentTarget;
    if (img.naturalWidth && img.naturalHeight) {
      setRatio(img.naturalWidth / img.naturalHeight);
    }
    setIsLoaded(true);
    if (onImageLoad) onImageLoad();
  };

  const handleError = () => {
    setHasError(true);
    setIsLoaded(true);
    if (onImageError) onImageError();
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-zinc-100 dark:bg-zinc-800/50 rounded-lg flex items-center justify-center transition-all duration-200",
        containerClassName
      )}
      style={{
        aspectRatio: ratio ? `${ratio}` : undefined,
        minHeight: !isLoaded && !ratio ? "160px" : undefined,
        ...style,
      }}
    >
      {/* Skeleton Loading State */}
      {!isLoaded && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2">
          <Skeleton className="w-full h-full absolute inset-0" />
          {showIconPlaceholder && (
            <ImageIcon className="w-6 h-6 text-zinc-400 dark:text-zinc-500 animate-pulse z-20" />
          )}
        </div>
      )}

      {/* Error State Placeholder */}
      {hasError ? (
        <div className="flex flex-col items-center justify-center p-4 text-zinc-400 dark:text-zinc-500 gap-1.5 text-xs text-center w-full h-full min-h-[120px] bg-zinc-100 dark:bg-zinc-900/60 rounded-lg border border-zinc-200 dark:border-zinc-800">
          <ImageOff className="w-6 h-6 opacity-60" />
          <span>Failed to load image</span>
        </div>
      ) : (
        /* Actual Image with Fade-in Effect */
        <img
          src={src}
          alt={alt}
          onLoad={handleLoad}
          onError={handleError}
          className={cn(
            "transition-opacity duration-300 block",
            isLoaded ? "opacity-100" : "opacity-0 absolute inset-0 w-full h-full object-cover",
            className
          )}
          {...props}
        />
      )}
    </div>
  );
};
