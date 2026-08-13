import { ImageUploadConfig } from "../types";

export async function uploadToCatbox(file: File, config: ImageUploadConfig): Promise<string> {
  const formData = new FormData();
  formData.append("reqtype", "fileupload");
  if (config.catboxUserhash) {
    formData.append("userhash", config.catboxUserhash);
  }
  formData.append("fileToUpload", file);

  const response = await fetch("https://catbox.moe/user/api.php", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Catbox upload failed with status ${response.status}`);
  }

  const url = await response.text();
  const trimmed = url.trim();
  if (!trimmed.startsWith("http")) {
    throw new Error(`Catbox returned invalid response: ${trimmed}`);
  }

  return trimmed;
}
