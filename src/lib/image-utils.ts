const IMAGE_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".bmp",
  ".svg",
  ".ico",
  ".tiff",
  ".avif",
];

const VIDEO_EXTENSIONS = [
  ".mp4",
  ".webm",
  ".mov",
  ".ogg",
  ".m4v",
  ".mkv",
];

const KNOWN_IMAGE_HOSTS = [
  "images.unsplash.com",
  "i.imgur.com",
  "imgur.com",
  "litter.catbox.moe",
  "files.catbox.moe",
  "postimg.cc",
  "i.postimg.cc",
  "i.ibb.co",
  "ibb.co",
  "cdn.discordapp.com",
  "media.discordapp.net",
  "prnt.sc",
  "gyazo.com",
  "media.tenor.com",
  "i.giphy.com",
];

// Reactive cache for dynamically verified image and video URLs
const verifiedImageUrlsCache = new Set<string>();
const verifiedVideoUrlsCache = new Set<string>();
const unverifiedUrlsCache = new Set<string>();

type MediaCacheListener = () => void;
const listeners = new Set<MediaCacheListener>();

export function subscribeImageCache(listener: MediaCacheListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

/**
 * Synchronously checks if a URL points to an image file or has been verified as image.
 */
export function isImageUrl(url: string): boolean {
  if (!url) return false;

  if (verifiedImageUrlsCache.has(url)) {
    return true;
  }
  
  // Clean URL of query parameters and hashes for extension matching
  const cleanUrl = url.split("?")[0].split("#")[0].toLowerCase();

  // Check extension
  if (IMAGE_EXTENSIONS.some((ext) => cleanUrl.endsWith(ext))) {
    return true;
  }

  // Check known image hosting services
  const lowerUrl = url.toLowerCase();
  if (KNOWN_IMAGE_HOSTS.some((host) => lowerUrl.includes(host))) {
    return true;
  }

  // Check query parameters (e.g. ?format=jpg, ?ext=png)
  try {
    const parsedUrl = new URL(url);
    const format = parsedUrl.searchParams.get("format") || parsedUrl.searchParams.get("ext");
    if (format && IMAGE_EXTENSIONS.some((ext) => ext.slice(1) === format.toLowerCase())) {
      return true;
    }
  } catch (_) {
    // Ignore invalid URL parsing
  }

  return false;
}

/**
 * Synchronously checks if a URL points to a video file or has been verified as video.
 */
export function isVideoUrl(url: string): boolean {
  if (!url) return false;

  if (verifiedVideoUrlsCache.has(url)) {
    return true;
  }

  const cleanUrl = url.split("?")[0].split("#")[0].toLowerCase();
  if (VIDEO_EXTENSIONS.some((ext) => cleanUrl.endsWith(ext))) {
    return true;
  }

  try {
    const parsedUrl = new URL(url);
    const format = parsedUrl.searchParams.get("format") || parsedUrl.searchParams.get("ext");
    if (format && VIDEO_EXTENSIONS.some((ext) => ext.slice(1) === format.toLowerCase())) {
      return true;
    }
  } catch (_) {}

  return false;
}

/**
 * Synchronously checks if a URL points to either an image or a video file.
 */
export function isMediaUrl(url: string): boolean {
  return isImageUrl(url) || isVideoUrl(url);
}

/**
 * Asynchronously checks if a URL points to an image resource.
 */
export function checkIsImageUrlAsync(url: string): Promise<boolean> {
  return checkIsMediaUrlAsync(url).then((res) => res === "image");
}

/**
 * Asynchronously checks if a URL points to a media resource ("image" | "video" | null).
 * Caches the result and notifies subscribers if a new media URL is verified.
 */
export function checkIsMediaUrlAsync(url: string): Promise<"image" | "video" | null> {
  if (!url) return Promise.resolve(null);

  if (isImageUrl(url)) return Promise.resolve("image");
  if (isVideoUrl(url)) return Promise.resolve("video");
  if (unverifiedUrlsCache.has(url)) return Promise.resolve(null);

  return new Promise<"image" | "video" | null>((resolve) => {
    // 1. Try lightweight HEAD request first
    fetch(url, { method: "HEAD" })
      .then((res) => {
        const contentType = res.headers.get("content-type");
        if (res.ok && contentType) {
          if (contentType.startsWith("image/")) {
            verifiedImageUrlsCache.add(url);
            notifyListeners();
            resolve("image");
            return;
          }
          if (contentType.startsWith("video/")) {
            verifiedVideoUrlsCache.add(url);
            notifyListeners();
            resolve("video");
            return;
          }
        }
        probeWithMediaElements(url, resolve);
      })
      .catch(() => {
        probeWithMediaElements(url, resolve);
      });
  });
}

function probeWithMediaElements(url: string, resolve: (val: "image" | "video" | null) => void) {
  // Try Image element first
  const img = new Image();
  img.onload = () => {
    verifiedImageUrlsCache.add(url);
    notifyListeners();
    resolve("image");
  };
  img.onerror = () => {
    // Fall back to Video element probe
    probeWithVideoElement(url, resolve);
  };
  img.src = url;
}

function probeWithVideoElement(url: string, resolve: (val: "image" | "video" | null) => void) {
  const video = document.createElement("video");
  video.onloadedmetadata = () => {
    verifiedVideoUrlsCache.add(url);
    notifyListeners();
    resolve("video");
  };
  video.onerror = () => {
    unverifiedUrlsCache.add(url);
    resolve(null);
  };
  video.src = url;
}


