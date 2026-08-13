import { ImageUploadConfig } from "../types";

export async function uploadToMicrobin(file: File, config: ImageUploadConfig): Promise<string> {
  if (!config.microbinUrl) {
    throw new Error("Microbin URL is not configured.");
  }

  let baseUrl = config.microbinUrl.trim().replace(/\/+$/, "");
  const formData = new FormData();
  formData.append("file", file);
  if (config.microbinPassword) {
    formData.append("auth", config.microbinPassword);
    formData.append("password", config.microbinPassword);
  }

  const headers: Record<string, string> = {};
  if (config.microbinPassword) {
    headers["Authorization"] = `Bearer ${config.microbinPassword}`;
  }

  const response = await fetch(`${baseUrl}/upload`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Microbin upload failed with status ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "";
  let resultUrl = "";

  if (contentType.includes("application/json")) {
    const json = await response.json();
    resultUrl = json.url || json.fileUrl || json.link || (json.id ? `${baseUrl}/file/${json.id}` : "");
  } else {
    const text = await response.text();
    if (text.startsWith("http")) {
      resultUrl = text.trim();
    } else if (text.startsWith("/")) {
      resultUrl = `${baseUrl}${text.trim()}`;
    } else {
      // Look for created ID in text response or redirect location
      const redirectUrl = response.url;
      if (redirectUrl && redirectUrl !== `${baseUrl}/upload`) {
        resultUrl = redirectUrl;
      }
    }
  }

  if (!resultUrl) {
    throw new Error("Could not parse direct file URL from Microbin response.");
  }

  // Ensure link is direct raw file link if /p/ was returned
  if (resultUrl.includes("/p/")) {
    const ext = file.name.split(".").pop() || "png";
    const id = resultUrl.split("/p/").pop()?.split("/")[0]?.split("?")[0];
    if (id) {
      resultUrl = `${baseUrl}/file/${id}.${ext}`;
    }
  }

  return resultUrl;
}
