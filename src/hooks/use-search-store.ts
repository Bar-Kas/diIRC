import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

import {
  isEmptyCriteria,
  parseSearchQuery,
  removeChipFromQuery,
  type ParsedSearchQuery,
} from "@/lib/search/search-query";
import { useMockStore } from "@/lib/mock-store";

/** Mirror of Rust `SearchHit` (camelCase serde). */
export interface SearchHit {
  timestamp: string;
  sender: string;
  content: string;
  offset: number;
}

/**
 * Resolves a raw `from:` value against server members by NICK and REALNAME
 * (case-insensitive). Exact match on either wins; otherwise substring match.
 * Falls back to the raw value so log-only nicks (not in the member list) still work.
 */
const resolveSenders = (rawSender: string, serverId: string): string[] => {
  const needle = rawSender.replace(/^@/, "").trim().toLowerCase();
  if (!needle) return [];
  const members = useMockStore.getState().servers.find((s) => s.id === serverId)?.members ?? [];

  const exact = new Set<string>();
  const partial = new Set<string>();
  for (const member of members) {
    const nick = member.profile?.name;
    const realname = member.profile?.realname;
    if (!nick) continue;
    const nickLower = nick.toLowerCase();
    const realLower = realname?.toLowerCase();
    if (nickLower === needle || (realLower && realLower === needle)) {
      exact.add(nick);
    } else if (nickLower.includes(needle) || (realLower && realLower.includes(needle))) {
      partial.add(nick);
    }
  }

  if (exact.size > 0) return [...exact];
  if (partial.size > 0) return [...partial];
  return [needle];
};

/** Hard cap mirrored from the Rust default — used to show the "results truncated" hint. */
export const SEARCH_RESULT_LIMIT = 200;

export type SearchStatus = "idle" | "loading" | "done" | "error";
export type SearchSort = "newest" | "oldest";

export interface SearchContext {
  type: "channel" | "conversation";
  chatId: string;
  serverId: string;
  target: string;
}

const EMPTY_PARSED: ParsedSearchQuery = {
  criteria: {
    terms: [],
    phrases: [],
    excludeTerms: [],
    excludePhrases: [],
    regexes: [],
    excludeRegexes: [],
  },
  chips: [],
};

const SEARCH_BATCH_SIZE = 100;

interface SearchStore {
  open: boolean;
  rawQuery: string;
  parsed: ParsedSearchQuery;
  hits: SearchHit[];
  status: SearchStatus;
  error: string | null;
  sort: SearchSort;
  hasMore: boolean;
  loadingMore: boolean;
  searchContext: SearchContext | null;
  /** Chat key the current results belong to (stale-result guard across chat switches). */
  resultsChatKey: string | null;
  requestToken: number;
  /** Message id queued for scroll+flash in ChatMessages (consumed once). */
  pendingJumpMessageId: string | null;

  openSearch: () => void;
  closeSearch: () => void;
  toggleSearch: () => void;
  /** Updates the query text only — execution is debounced by the caller. */
  setQuery: (rawQuery: string) => void;
  removeChipToken: (token: string) => void;
  runSearch: (context: SearchContext, overrideSort?: SearchSort) => Promise<void>;
  loadMore: (context?: SearchContext) => Promise<void>;
  clearResults: () => void;
  setSort: (sort: SearchSort, context?: SearchContext) => void;
  /** Loads a window around the hit's log offset and queues the flash-highlight jump. */
  jumpToHit: (hit: SearchHit, context: SearchContext) => Promise<void>;
  clearPendingJump: () => void;
}

export const useSearchStore = create<SearchStore>((set, get) => {
  const streamRemainingBatches = async (
    context: SearchContext,
    token: number,
    sort: SearchSort
  ) => {
    const requestedKey = `${context.type}:${context.chatId}`;

    while (true) {
      // Yield to the browser event loop for 40ms to keep UI 100% smooth and responsive
      await new Promise((resolve) => setTimeout(resolve, 40));

      const state = get();
      if (
        !state.open ||
        state.requestToken !== token ||
        state.resultsChatKey !== requestedKey ||
        state.hits.length === 0
      ) {
        return;
      }

      const offsets = state.hits.map((h) => h.offset);
      const beforeOffset = sort === "newest" ? Math.min(...offsets) : undefined;
      const afterOffset = sort === "oldest" ? Math.max(...offsets) : undefined;

      try {
        const { sender, ...restCriteria } = state.parsed.criteria;
        const criteria = {
          ...restCriteria,
          senders: sender ? resolveSenders(sender, context.serverId) : [],
          limit: SEARCH_BATCH_SIZE,
          order: sort,
          beforeOffset,
          afterOffset,
        };

        const batch = await invoke<SearchHit[]>("search_log", {
          serverId: context.serverId,
          channel: context.target,
          criteria,
        });

        const latest = get();
        if (
          !latest.open ||
          latest.requestToken !== token ||
          latest.resultsChatKey !== requestedKey
        ) {
          return;
        }

        if (batch.length === 0) {
          set({ hasMore: false, loadingMore: false });
          return;
        }

        const existingOffsets = new Set(latest.hits.map((h) => h.offset));
        const newHits = batch.filter((h) => !existingOffsets.has(h.offset));
        const combined = [...latest.hits, ...newHits];

        set({
          hits: combined,
          hasMore: batch.length >= SEARCH_BATCH_SIZE,
          loadingMore: batch.length >= SEARCH_BATCH_SIZE,
        });

        if (batch.length < SEARCH_BATCH_SIZE) {
          set({ hasMore: false, loadingMore: false });
          return;
        }
      } catch (err) {
        console.error("Background search batch failed:", err);
        set({ loadingMore: false });
        return;
      }
    }
  };

  return {
    open: false,
    rawQuery: "",
    parsed: EMPTY_PARSED,
    hits: [],
    status: "idle",
    error: null,
    sort: "newest",
    hasMore: false,
    loadingMore: false,
    searchContext: null,
    resultsChatKey: null,
    requestToken: 0,
    pendingJumpMessageId: null,

    openSearch: () => set({ open: true }),

    closeSearch: () =>
      set({
        open: false,
        rawQuery: "",
        parsed: EMPTY_PARSED,
        hits: [],
        status: "idle",
        error: null,
        hasMore: false,
        loadingMore: false,
        searchContext: null,
        resultsChatKey: null,
        requestToken: get().requestToken + 1, // invalidate in-flight requests
      }),

    toggleSearch: () => {
      if (get().open) {
        get().closeSearch();
      } else {
        set({ open: true });
      }
    },

    setQuery: (rawQuery) => set({ rawQuery }),

    removeChipToken: (token) =>
      set((state) => ({ rawQuery: removeChipFromQuery(state.rawQuery, token) })),

    runSearch: async (context, overrideSort) => {
      const activeSort = overrideSort ?? get().sort;
      const requestedKey = `${context.type}:${context.chatId}`;
      const parsed = parseSearchQuery(get().rawQuery);

      if (!get().rawQuery.trim() || isEmptyCriteria(parsed.criteria)) {
        set({
          parsed,
          hits: [],
          status: get().rawQuery.trim() ? "done" : "idle",
          error: null,
          hasMore: false,
          loadingMore: false,
          searchContext: context,
        });
        return;
      }

      const requestToken = get().requestToken + 1;
      set({
        parsed,
        status: "loading",
        error: null,
        requestToken,
        resultsChatKey: requestedKey,
        searchContext: context,
        hasMore: false,
        loadingMore: false,
      });

      try {
        const { sender, ...restCriteria } = parsed.criteria;
        const criteria = {
          ...restCriteria,
          senders: sender ? resolveSenders(sender, context.serverId) : [],
          limit: SEARCH_BATCH_SIZE,
          order: activeSort,
        };
        const hits = await invoke<SearchHit[]>("search_log", {
          serverId: context.serverId,
          channel: context.target,
          criteria,
        });

        const current = get();
        if (
          !current.open ||
          current.resultsChatKey !== requestedKey ||
          current.requestToken !== requestToken
        ) {
          return; // stale response
        }

        const hasMore = hits.length >= SEARCH_BATCH_SIZE;
        set({
          hits,
          status: "done",
          hasMore,
          loadingMore: hasMore,
        });

        if (hasMore) {
          void streamRemainingBatches(context, requestToken, activeSort);
        }
      } catch (error) {
        const current = get();
        if (
          !current.open ||
          current.resultsChatKey !== requestedKey ||
          current.requestToken !== requestToken
        ) {
          return;
        }
        console.error("IRC message search failed:", error);
        set({ status: "error", error: String(error), loadingMore: false });
      }
    },

    loadMore: async (passedContext) => {
      const current = get();
      const context = passedContext ?? current.searchContext;
      if (
        !context ||
        !current.open ||
        !current.hasMore ||
        current.loadingMore ||
        current.status !== "done" ||
        current.hits.length === 0
      ) {
        return;
      }

      const requestedKey = `${context.type}:${context.chatId}`;
      if (current.resultsChatKey !== requestedKey) return;

      set({ loadingMore: true });

      try {
        const { sender, ...restCriteria } = current.parsed.criteria;
        const sort = current.sort;
        const offsets = current.hits.map((h) => h.offset);

        const beforeOffset = sort === "newest" ? Math.min(...offsets) : undefined;
        const afterOffset = sort === "oldest" ? Math.max(...offsets) : undefined;

        const criteria = {
          ...restCriteria,
          senders: sender ? resolveSenders(sender, context.serverId) : [],
          limit: SEARCH_BATCH_SIZE,
          order: sort,
          beforeOffset,
          afterOffset,
        };

        const moreHits = await invoke<SearchHit[]>("search_log", {
          serverId: context.serverId,
          channel: context.target,
          criteria,
        });

        const latest = get();
        if (!latest.open || latest.resultsChatKey !== requestedKey) {
          return;
        }

        if (moreHits.length === 0) {
          set({ hasMore: false, loadingMore: false });
          return;
        }

        const existingOffsets = new Set(latest.hits.map((h) => h.offset));
        const filteredMore = moreHits.filter((h) => !existingOffsets.has(h.offset));
        const combined = [...latest.hits, ...filteredMore];

        set({
          hits: combined,
          hasMore: moreHits.length >= SEARCH_BATCH_SIZE,
          loadingMore: false,
        });
      } catch (error) {
        console.error("Failed to load more search hits:", error);
        set({ loadingMore: false });
      }
    },

    clearResults: () =>
      set({
        hits: [],
        status: "idle",
        error: null,
        parsed: EMPTY_PARSED,
        resultsChatKey: null,
        hasMore: false,
        loadingMore: false,
      }),

    setSort: (sort, context) => {
      const current = get();
      if (current.sort === sort) return;
      set({ sort });
      const activeContext = context ?? current.searchContext;
      if (activeContext && (current.status !== "idle" || current.rawQuery.trim())) {
        void get().runSearch(activeContext, sort);
      }
    },

    jumpToHit: async (hit, context) => {
      const messageId = `log-${context.serverId}-${context.chatId}-${hit.offset}`;
      try {
        const jumped = await useMockStore
          .getState()
          .jumpToMessage(
            context.type,
            context.chatId,
            context.serverId,
            context.target,
            hit.offset,
            messageId
          );
        if (jumped) {
          set({ pendingJumpMessageId: messageId });
        }
      } catch (error) {
        console.error("Failed to jump to searched message:", error);
      }
    },

    clearPendingJump: () => set({ pendingJumpMessageId: null }),
  };
});

export const useSearchStoreInstance = useSearchStore;
