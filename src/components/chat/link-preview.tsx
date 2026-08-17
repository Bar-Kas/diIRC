import React, { useState, useEffect } from "react";
import { ExternalLink, Globe } from "lucide-react";
import { useMockStore } from "@/lib/mock-store";
import { isImageUrl } from "@/lib/image-utils";
import { useModal } from "@/hooks/use-modal-store";
import { ImageContextMenu } from "@/components/image-context-menu";
import { openExternalUrl } from "@/lib/system-utils";
import { SmartImage } from "@/components/chat/smart-image";

interface LinkPreviewProps {
  url: string;
}

interface OpenGraphData {
  title?: string;
  description?: string;
  image?: string;
  publisher?: string;
  logo?: string;
}

// In-memory cache for fetched OpenGraph metadata to avoid duplicate network calls
const ogCache = new Map<string, OpenGraphData | null>();

export const LinkPreview: React.FC<LinkPreviewProps> = ({ url }) => {
  const { onOpen } = useModal();
  const linkPreviewApiUrl = useMockStore((state) => state.linkPreviewApiUrl);
  const enableWebPagePreviews = useMockStore((state) => state.enableWebPagePreviews);

  const [ogData, setOgData] = useState<OpenGraphData | null>(ogCache.get(url) || null);
  const [loading, setLoading] = useState<boolean>(!ogCache.has(url));
  const [error, setError] = useState<boolean>(false);

  // 1. Helper: Detect Direct Image URLs
  const isImage = (link: string) => isImageUrl(link);

  // 2. Helper: Detect Direct Video URLs
  const isVideo = (link: string) => {
    const cleanUrl = link.split("?")[0].toLowerCase();
    return (
      cleanUrl.endsWith(".mp4") ||
      cleanUrl.endsWith(".webm") ||
      cleanUrl.endsWith(".mov") ||
      cleanUrl.endsWith(".ogg")
    );
  };

  // 3. Helper: Detect YouTube URLs and extract video ID
  const getYouTubeId = (link: string): string | null => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = link.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  const youtubeId = getYouTubeId(url);
  const isDirectImage = isImage(url);
  const isDirectVideo = isVideo(url);

  useEffect(() => {
    // Skip external API fetch if link is direct image, video, or YouTube
    if (isDirectImage || isDirectVideo || youtubeId) {
      setLoading(false);
      return;
    }

    if (!enableWebPagePreviews) {
      setLoading(false);
      return;
    }

    if (ogCache.has(url)) {
      setOgData(ogCache.get(url) || null);
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);

    const fetchMetadata = async () => {
      try {
        const baseUrl = (linkPreviewApiUrl || "https://api.microlink.io").replace(/\/$/, "");
        const requestUrl = `${baseUrl}?url=${encodeURIComponent(url)}`;
        const res = await fetch(requestUrl);

        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }

        const json = await res.json();
        
        // Support standard Microlink JSON response format
        let extracted: OpenGraphData | null = null;
        if (json?.data) {
          extracted = {
            title: json.data.title || undefined,
            description: json.data.description || undefined,
            image: json.data.image?.url || json.data.logo?.url || undefined,
            publisher: json.data.publisher || json.data.siteName || undefined,
            logo: json.data.logo?.url || undefined,
          };
        } else if (json?.title || json?.description || json?.image) {
          // Fallback for custom self-hosted simple OpenGraph JSON microservices
          extracted = {
            title: json.title,
            description: json.description,
            image: json.image?.url || json.image,
            publisher: json.publisher || json.site_name,
            logo: json.logo,
          };
        }

        if (isMounted) {
          ogCache.set(url, extracted);
          setOgData(extracted);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          ogCache.set(url, null);
          setError(true);
          setLoading(false);
        }
      }
    };

    fetchMetadata();

    return () => {
      isMounted = false;
    };
  }, [url, linkPreviewApiUrl, isDirectImage, isDirectVideo, youtubeId]);

  // A) Render Direct Image Preview
  if (isDirectImage) {
    return (
      <div className="mt-2 w-fit max-w-md rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800/80 group relative shadow-sm">
        <ImageContextMenu url={url}>
          <button
            type="button"
            onClick={() => onOpen("imagePreview", { url })}
            className="block relative cursor-zoom-in text-left w-full h-full"
          >
            <SmartImage
              src={url}
              alt="Embedded Content"
              className="max-h-[320px] max-w-full w-auto h-auto object-contain rounded-lg transition hover:opacity-95 block"
              loading="lazy"
            />
          </button>
        </ImageContextMenu>
      </div>
    );
  }

  // B) Render Direct Video Preview
  if (isDirectVideo) {
    return (
      <div className="mt-2 max-w-md rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-black">
        <video
          src={url}
          controls
          className="max-h-[320px] w-full rounded-lg"
          preload="metadata"
        />
      </div>
    );
  }

  // C) Render YouTube Responsive Player
  if (youtubeId) {
    return (
      <div className="mt-2 max-w-md rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-black shadow-md">
        <div className="relative w-full pt-[56.25%]">
          <iframe
            src={`https://www.youtube.com/embed/${youtubeId}`}
            title="YouTube video player"
            className="absolute top-0 left-0 w-full h-full border-0 rounded-lg"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    );
  }

  // D) Render Skeleton Loader for Web Page Preview
  if (loading) {
    return (
      <div className="mt-2 max-w-md rounded-md bg-zinc-100 dark:bg-[#2b2d31] border-l-4 border-l-indigo-500/50 p-3 space-y-2 border border-zinc-200 dark:border-zinc-800/80 animate-pulse">
        <div className="h-3 bg-zinc-300 dark:bg-zinc-700/60 rounded w-1/4" />
        <div className="h-4 bg-zinc-300 dark:bg-zinc-700/60 rounded w-3/4" />
        <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-full" />
      </div>
    );
  }

  // E) If web page previews disabled, network error, or no OpenGraph data found, do not render card
  if (!enableWebPagePreviews || error || !ogData || (!ogData.title && !ogData.description && !ogData.image)) {
    return null;
  }

  // F) Render Discord-Style Rich OpenGraph Card
  let domain = "";
  try {
    domain = new URL(url).hostname.replace(/^www\./, "");
  } catch (_) {
    domain = url;
  }

  return (
    <div className="mt-2 max-w-md rounded-md bg-zinc-100 dark:bg-[#2b2d31] border-l-4 border-l-indigo-500 p-3.5 flex flex-col gap-y-2 border border-zinc-200/80 dark:border-zinc-800/80 shadow-sm text-xs group transition hover:border-zinc-300 dark:hover:border-zinc-700">
      {/* Publisher / Domain Header */}
      <div className="flex items-center gap-x-1.5 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
        {ogData.logo ? (
          <img src={ogData.logo} alt="" className="w-3.5 h-3.5 rounded-full object-cover" />
        ) : (
          <Globe className="w-3.5 h-3.5 text-zinc-400" />
        )}
        <span>{ogData.publisher || domain}</span>
      </div>

      {/* Title */}
      {ogData.title && (
        <button
          type="button"
          onClick={() => openExternalUrl(url)}
          className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline text-sm leading-snug flex items-center gap-x-1.5 text-left"
        >
          <span>{ogData.title}</span>
          <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition shrink-0" />
        </button>
      )}

      {/* Description */}
      {ogData.description && (
        <p className="text-zinc-600 dark:text-zinc-300 text-xs leading-relaxed line-clamp-3">
          {ogData.description}
        </p>
      )}

      {/* Preview Image */}
      {ogData.image && (
        <div className="mt-1 w-fit max-w-full rounded-md overflow-hidden border border-zinc-200 dark:border-zinc-700/60 max-h-[220px]">
          <ImageContextMenu url={ogData.image}>
            <button
              type="button"
              onClick={() => onOpen("imagePreview", { url: ogData.image })}
              className="block cursor-zoom-in text-left w-full h-full"
            >
              <SmartImage
                src={ogData.image}
                alt={ogData.title || "Link preview image"}
                className="w-full h-full max-h-[220px] object-contain transition hover:scale-[1.01] block"
                loading="lazy"
              />
            </button>
          </ImageContextMenu>
        </div>
      )}
    </div>
  );
};
