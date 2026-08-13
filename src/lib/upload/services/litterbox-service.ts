import { ImageUploadConfig } from "../types";

export async function uploadToLitterbox(file: File, config: ImageUploadConfig): Promise<string> {
  const formData = new FormData();
  formData.append("reqtype", "fileupload");
  formData.append("time", config.litterboxTime || "24h");
  formData.append("fileToUpload", file);

  const response = await fetch("https://litterbox.catbox.moe/resources/internals/api.php", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Litterbox upload failed with status ${response.status}`);
  }

  const url = await response.text();
  const trimmed = url.trim();
  if (!trimmed.startsWith("http")) {
    throw new Error(`Litterbox returned invalid response: ${trimmed}`);
  }

  return trimmed;
}
