const IMAGE_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".bmp",
  ".svg",
  ".ico",
];

const KNOWN_IMAGE_HOSTS = [
  "images.unsplash.com",
  "i.imgur.com",
  "litter.catbox.moe",
  "files.catbox.moe",
];

/**
 * Checks if a URL points directly to an image file or known image host.
 */
export function isImageUrl(url: string): boolean {
  if (!url) return false;
  
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

  return false;
}
