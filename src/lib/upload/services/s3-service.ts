import { ImageUploadConfig } from "../types";

export async function uploadToS3(file: File, config: ImageUploadConfig): Promise<string> {
  if (!config.s3Endpoint || !config.s3Bucket) {
    throw new Error("S3 Endpoint and Bucket are required.");
  }

  const endpoint = config.s3Endpoint.trim().replace(/\/+$/, "");
  const bucket = config.s3Bucket.trim();
  const fileExt = file.name.split(".").pop() || "png";
  const filename = `uploads/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${fileExt}`;

  // If public URL prefix is configured, use it for direct upload POST/PUT
  let targetUrl = `${endpoint}/${bucket}/${filename}`;
  if (config.s3PublicUrlPrefix) {
    const publicPrefix = config.s3PublicUrlPrefix.trim().replace(/\/+$/, "");
    targetUrl = `${publicPrefix}/${filename}`;
  }

  const headers: Record<string, string> = {
    "Content-Type": file.type || "application/octet-stream",
  };

  if (config.s3AccessKey && config.s3SecretKey) {
    headers["Authorization"] = `AWS ${config.s3AccessKey}:${config.s3SecretKey}`;
  }

  const response = await fetch(`${endpoint}/${bucket}/${filename}`, {
    method: "PUT",
    headers,
    body: file,
  });

  if (!response.ok) {
    throw new Error(`S3 upload failed with status ${response.status}`);
  }

  return targetUrl;
}
