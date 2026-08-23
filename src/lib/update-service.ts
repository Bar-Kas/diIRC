import { check, Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { openUrl } from "@tauri-apps/plugin-opener";

export interface UpdateProgress {
  status: "idle" | "checking" | "downloading" | "installing" | "ready" | "error";
  downloadedBytes: number;
  totalBytes: number;
  percentage: number;
  errorMessage?: string;
  isDebFallback?: boolean;
}

export const GITHUB_RELEASES_URL = "https://github.com/TheStami/diIRC/releases/latest";

/** Check if running inside Tauri context */
export const isTauriEnvironment = (): boolean => {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
};

/** Perform update check */
export const checkForAppUpdate = async (): Promise<Update | null> => {
  if (!isTauriEnvironment()) {
    console.warn("Update check skipped: Not running in Tauri desktop environment.");
    return null;
  }
  try {
    const update = await check();
    return update;
  } catch (error) {
    console.error("Error checking for updates:", error);
    throw error;
  }
};

/** Download and install update with progress callback */
export const installAppUpdate = async (
  update: Update,
  onProgress?: (progress: UpdateProgress) => void
): Promise<void> => {
  let downloadedBytes = 0;
  let totalBytes = 0;

  try {
    onProgress?.({
      status: "downloading",
      downloadedBytes: 0,
      totalBytes: 0,
      percentage: 0,
    });

    await update.downloadAndInstall((event) => {
      if (event.event === "Started") {
        totalBytes = event.data.contentLength || 0;
        onProgress?.({
          status: "downloading",
          downloadedBytes: 0,
          totalBytes,
          percentage: 0,
        });
      } else if (event.event === "Progress") {
        downloadedBytes += event.data.chunkLength;
        const percentage = totalBytes > 0 ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100)) : 0;
        onProgress?.({
          status: "downloading",
          downloadedBytes,
          totalBytes,
          percentage,
        });
      } else if (event.event === "Finished") {
        onProgress?.({
          status: "installing",
          downloadedBytes,
          totalBytes: downloadedBytes,
          percentage: 100,
        });
      }
    });

    onProgress?.({
      status: "ready",
      downloadedBytes,
      totalBytes: downloadedBytes,
      percentage: 100,
    });

    // Relaunch app to apply update
    await relaunch();
  } catch (error: any) {
    const errStr = String(error?.message || error || "");
    console.error("Failed to install update:", error);
    
    // Check if error is related to system package / permission on Linux (.deb)
    const isDebOrPermissionError = 
      errStr.includes("Permission denied") || 
      errStr.includes("dpkg") || 
      errStr.includes("usr") || 
      errStr.includes("read-only") || 
      errStr.includes("operation not permitted");

    onProgress?.({
      status: "error",
      downloadedBytes: 0,
      totalBytes: 0,
      percentage: 0,
      errorMessage: errStr || "Failed to download or install update.",
      isDebFallback: isDebOrPermissionError,
    });
    throw error;
  }
};

/** Open GitHub releases page in external browser */
export const openGitHubReleases = async (): Promise<void> => {
  try {
    await openUrl(GITHUB_RELEASES_URL);
  } catch {
    window.open(GITHUB_RELEASES_URL, "_blank");
  }
};
