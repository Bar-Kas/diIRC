import { ImageUploadConfig } from "../types";

export async function uploadToZipline(file: File, config: ImageUploadConfig): Promise<string> {
  if (!config.ziplineUrl) {
    throw new Error("Zipline URL is not configured.");
  }

  const baseUrl = config.ziplineUrl.trim().replace(/\/+$/, "");
  const formData = new FormData();
  formData.append("file", file);

  const headers: Record<string, string> = {};
  if (config.ziplineToken) {
    headers["authorization"] = config.ziplineToken;
  }

  const response = await fetch(`${baseUrl}/api/upload`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Zipline upload failed with status ${response.status}`);
  }

  const json = await response.json();
  const url = json.files?.[0] || json.url || json.file;

  if (!url) {
    throw new Error("Zipline response did not contain a file URL.");
  }

  if (url.startsWith("http")) {
    return url;
  }

  return `${baseUrl}${url.startsWith("/") ? "" : "/"}${url}`;
}
