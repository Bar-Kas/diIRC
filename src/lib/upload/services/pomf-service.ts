import { ImageUploadConfig } from "../types";

export async function uploadToPomf(file: File, config: ImageUploadConfig): Promise<string> {
  let endpoint = config.pomfUrl?.trim() || "https://pomf.cat/upload.php";

  if (!endpoint.startsWith("http://") && !endpoint.startsWith("https://")) {
    endpoint = "https://" + endpoint;
  }

  let urlObj: URL;
  try {
    urlObj = new URL(endpoint);
  } catch {
    urlObj = new URL("https://pomf.cat/upload.php");
  }

  if (urlObj.pathname === "/" || urlObj.pathname === "") {
    urlObj.pathname = "/upload.php";
  }

  const targetUrl = urlObj.toString();

  const formData = new FormData();
  formData.append("files[]", file);

  const response = await fetch(targetUrl, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`POMF upload failed with status ${response.status}`);
  }

  const data = await response.json();

  if (!data || data.success === false || !Array.isArray(data.files) || data.files.length === 0) {
    const errorMsg = data?.description || data?.error || data?.errorcode || "Unknown POMF error";
    throw new Error(`POMF upload failed: ${errorMsg}`);
  }

  const fileItem = data.files[0];
  const fileUrl = fileItem.url || fileItem.url_full || fileItem.name;

  if (!fileUrl) {
    throw new Error("POMF returned response without file URL.");
  }

  if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) {
    return fileUrl;
  }

  if (fileUrl.startsWith("//")) {
    return `https:${fileUrl}`;
  }

  const origin = `${urlObj.protocol}//${urlObj.host}`;
  if (urlObj.host === "pomf.cat" || urlObj.host === "www.pomf.cat") {
    return `https://a.pomf.cat/${fileUrl.replace(/^\//, "")}`;
  }

  if (fileUrl.startsWith("/")) {
    return `${origin}${fileUrl}`;
  } else {
    return `${origin}/${fileUrl}`;
  }
}
