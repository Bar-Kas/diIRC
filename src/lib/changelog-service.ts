import { useState, useEffect } from "react";
import tauriConfig from "../../src-tauri/tauri.conf.json";

export interface ChangelogVersion {
  version: string;
  cleanVersion: string;
  filename: string;
  content: string;
}

export interface ChangelogState {
  versions: ChangelogVersion[];
  hasCurrentVersion: boolean;
  currentVersion: string;
  loading: boolean;
  error: string | null;
}

const GIST_API_URL = "https://api.github.com/gists/fcb9ad4e53791a8c0295f4308fff1159";

/**
 * Parse version string into numeric array for semver comparison.
 * e.g., "v0.2.7" -> [0, 2, 7]
 */
export function parseVersionNumbers(versionStr: string): number[] {
  const clean = versionStr.replace(/^v/i, "").trim();
  return clean.split(".").map((part) => {
    const num = parseInt(part, 10);
    return isNaN(num) ? 0 : num;
  });
}

/**
 * Compare two version strings descending (newest version first).
 */
export function compareVersionsDescending(a: string, b: string): number {
  const numsA = parseVersionNumbers(a);
  const numsB = parseVersionNumbers(b);
  const maxLength = Math.max(numsA.length, numsB.length);

  for (let i = 0; i < maxLength; i++) {
    const valA = numsA[i] ?? 0;
    const valB = numsB[i] ?? 0;
    if (valA > valB) return -1;
    if (valA < valB) return 1;
  }
  return 0;
}

export const getCurrentAppVersion = (): string => {
  return tauriConfig.version || "0.2.7";
};

/** Global state cache & listener subscription pattern */
let cachedChangelogState: ChangelogState | null = null;
let fetchPromise: Promise<ChangelogState> | null = null;
const listeners = new Set<(state: ChangelogState) => void>();

function notifyListeners(state: ChangelogState) {
  cachedChangelogState = state;
  listeners.forEach((fn) => fn(state));
}

export async function fetchChangelogData(forceRefresh = false): Promise<ChangelogState> {
  if (cachedChangelogState && !forceRefresh) {
    return cachedChangelogState;
  }

  if (fetchPromise && !forceRefresh) {
    return fetchPromise;
  }

  const currentVer = getCurrentAppVersion();
  const cleanCurrentVer = currentVer.replace(/^v/i, "").trim();

  if (forceRefresh && cachedChangelogState) {
    notifyListeners({
      ...cachedChangelogState,
      loading: true,
      error: null,
    });
  }

  fetchPromise = (async () => {
    try {
      // Append query timestamp parameter to bypass browser HTTP cache without CORS preflight headers
      const url = `${GIST_API_URL}?_t=${Date.now()}`;
      const response = await fetch(url, {
        headers: {
          Accept: "application/vnd.github+json",
        },
      }).catch(() => {
        throw new Error("Unable to connect to GitHub. Please check your internet connection and try again.");
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Changelog Gist repository not found (HTTP 404).");
        }
        throw new Error(`Failed to fetch changelog (HTTP ${response.status}).`);
      }

      const data = await response.json();
      const filesObj = data?.files || {};

      const versionList: ChangelogVersion[] = [];

      for (const [filename, fileData] of Object.entries<any>(filesObj)) {
        if (filename.endsWith(".md") || /^v?\d+/i.test(filename)) {
          const rawVersion = filename.replace(/\.md$/i, "").trim();
          const cleanVer = rawVersion.replace(/^v/i, "").trim();

          let content = fileData.content || "";

          // Fallback only if content is missing/truncated from Gist API payload
          if (!content && fileData.raw_url) {
            const rawUrlWithBuster = `${fileData.raw_url}${fileData.raw_url.includes("?") ? "&" : "?"}_t=${Date.now()}`;
            const rawRes = await fetch(rawUrlWithBuster).catch(() => null);

            if (rawRes && rawRes.ok) {
              content = await rawRes.text();
            }
          }

          versionList.push({
            version: rawVersion.startsWith("v") ? rawVersion : `v${rawVersion}`,
            cleanVersion: cleanVer,
            filename,
            content,
          });
        }
      }

      versionList.sort((a, b) => compareVersionsDescending(a.version, b.version));

      const hasCurrentVersion = versionList.some(
        (item) => item.cleanVersion.toLowerCase() === cleanCurrentVer.toLowerCase()
      );

      const state: ChangelogState = {
        versions: versionList,
        hasCurrentVersion,
        currentVersion: currentVer,
        loading: false,
        error: null,
      };

      notifyListeners(state);
      return state;
    } catch (err: any) {
      console.error("Changelog fetch error:", err);
      const errorMessage = err?.message || "Failed to load changelog. Please check your network connection.";
      const errorState: ChangelogState = {
        versions: cachedChangelogState?.versions || [],
        hasCurrentVersion: cachedChangelogState?.hasCurrentVersion || false,
        currentVersion: currentVer,
        loading: false,
        error: errorMessage,
      };
      notifyListeners(errorState);
      return errorState;
    } finally {
      fetchPromise = null;
    }
  })();

  return fetchPromise;
}

/** Hook to easily consume changelog data with synchronized state across components */
export function useChangelog() {
  const currentVer = getCurrentAppVersion();
  const [state, setState] = useState<ChangelogState>(() => {
    return (
      cachedChangelogState || {
        versions: [],
        hasCurrentVersion: false,
        currentVersion: currentVer,
        loading: true,
        error: null,
      }
    );
  });

  useEffect(() => {
    const handleUpdate = (newState: ChangelogState) => {
      setState(newState);
    };

    listeners.add(handleUpdate);

    if (!cachedChangelogState && !fetchPromise) {
      fetchChangelogData();
    }

    return () => {
      listeners.delete(handleUpdate);
    };
  }, []);

  return {
    ...state,
    refresh: () => fetchChangelogData(true),
  };
}
