import { ImageUploadConfig } from "../types";
import { uploadToLitterbox } from "./litterbox-service";
import { uploadToPomf } from "./pomf-service";

export async function uploadImage(file: File, config: ImageUploadConfig): Promise<string> {
  if (!config || config.provider === "disabled") {
    throw new Error("Image uploading is currently disabled in settings.");
  }

  switch (config.provider) {
    case "litterbox":
      return uploadToLitterbox(file, config);
    case "pomf":
      return uploadToPomf(file, config);
    default:
      throw new Error(`Unsupported upload provider: ${config.provider}`);
  }
}

export * from "./litterbox-service";
export * from "./pomf-service";
