import { ImageUploadConfig } from "../types";
import { uploadToCatbox } from "./catbox-service";
import { uploadToLitterbox } from "./litterbox-service";
import { uploadToMicrobin } from "./microbin-service";
import { uploadToZipline } from "./zipline-service";
import { uploadToS3 } from "./s3-service";

export async function uploadImage(file: File, config: ImageUploadConfig): Promise<string> {
  if (!config || config.provider === "disabled") {
    throw new Error("Image uploading is currently disabled in settings.");
  }

  switch (config.provider) {
    case "catbox":
      return uploadToCatbox(file, config);
    case "litterbox":
      return uploadToLitterbox(file, config);
    case "microbin":
      return uploadToMicrobin(file, config);
    case "zipline":
      return uploadToZipline(file, config);
    case "s3":
      return uploadToS3(file, config);
    default:
      throw new Error(`Unsupported upload provider: ${config.provider}`);
  }
}

export * from "./catbox-service";
export * from "./litterbox-service";
export * from "./microbin-service";
export * from "./zipline-service";
export * from "./s3-service";
