import { RefObject, useCallback, useEffect, useRef, useState } from "react";
import { ScrollGeometry } from "@/types";

const BOTTOM_THRESHOLD = 30;

/**
 * Scroll position that counts as "near the top" and can trigger older-history
 * loading.
 */
const NEAR_TOP_THRESHOLD = 24;

/**
 * Window (ms) in which a scroll event produced by one of our own programmatic
 * writes is ignored for user-intent purposes. A single programmatic write
 * fires exactly one scroll event shortly after the write; without this guard,
 * content that grew asynchronously in the meantime (images, video, iframes)
 * would make that event read a distance above the leave threshold and
 * incorrectly disable auto-follow.
 */
const PROGRAMMATIC_SUPPRESS_MS = 200;

/**
 * Hard cap (ms) for the "jump to latest" landing monitor. The monitor keeps
 * the smooth animation on target while the virtualizer re-measures rows; it
 * stops early as soon as the view lands at the bottom.
 */
const JUMP_SETTLE_MAX_MS = 2000;

/**
 * When no `scrollToEnd` override is provided, the fallback smooth jump snaps
 * with an instant write once it is within this distance (px) of the bottom.
 */
const JUMP_SNAP_DISTANCE = 120;

type UseChatScrollOptions = {
  /** The scrollable message container. */
  scrollRef: RefObject<HTMLDivElement>;
  /**
   * The element whose box size changes as content renders (the messages
   * wrapper). Observed with `ResizeObserver` so delayed layout shifts (images,
   * video, iframes, code blocks) keep the view pinned when following.
   */
  contentRef?: RefObject<HTMLElement> | null;
  /**
   * Bumps whenever new tail content arrives (e.g. message count or the id of
   * the newest message). Used to trigger instant follow-scrolls.
   */
  contentVersion?: string | number;
  /** Resets auto-follow and scrolls to the bottom when the chat changes. */
  chatId?: string;
  /** Start with auto-follow enabled (default true). */
  initialScroll?: boolean;
  /** Whether older history can still be loaded (enables near-top detection). */
  shouldLoadMore?: boolean;
  /** Called when the user scrolls near the top while more history is available. */
  loadMore?: () => void;
  /**
   * Optional smooth-scroll implementation that re-targets while content is
   * re-measured (e.g. `virtualizer.scrollToEnd`). When provided it is used by
   * `scrollToLatest`; otherwise a plain `scrollTo({ behavior: "smooth" })` on
   * the scroll element is used, with a small snap fallback.
   */
  scrollToEnd?: (behavior: ScrollBehavior) => void;
  /** Reports geometry and user intent to the per-buffer read-state manager. */
  onViewportChange?: (geometry: ScrollGeometry, isAtBottom: boolean) => void;
};

type UseChatScrollResult = {
  /** True while the view should follow new content. */
  autoScrollEnabled: boolean;
  /** True when the viewport is within the bottom tolerance band. */
  isAtBottom: boolean;
  /** Smoothly scrolls to the newest content and re-enables following. */
  scrollToLatest: () => void;
};

/**
 * Generic chat scroll management:
 *
 * - Tracks user intent with hysteresis (`autoScrollEnabled` / `isAtBottom`).
 * - Follows new content with instant scrolling only while auto-follow is on.
 * - Suppresses the scroll event produced by each programmatic write so content
 *   that grows asynchronously (images/video) cannot flip auto-follow off.
 * - Keeps the view pinned during delayed layout changes via `ResizeObserver`.
 * - Coalesces writes in `requestAnimationFrame` to avoid layout thrashing.
 * - Disables browser scroll anchoring on the container (`overflow-anchor: none`
 *   is expected on the element the hook points at).
 * - Exposes `scrollToLatest` for a "jump to latest" floating button; the jump
 *   uses a smooth scroll that is re-targeted while rows re-measure and aborts
 *   as soon as the user interacts.
 */
export const useChatScroll = ({
  scrollRef,
  contentRef,
  contentVersion,
  chatId,
  initialScroll = true,
  shouldLoadMore = false,
  loadMore,
  scrollToEnd,
  onViewportChange,
}: UseChatScrollOptions): UseChatScrollResult => {
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(initialScroll);
  const [isAtBottom, setIsAtBottom] = useState(initialScroll);

  // Ref mirror so effects/callbacks always read the current value without
  // forcing re-runs on every state toggle.
  const autoScrollRef = useRef(initialScroll);
  const pendingFrameRef = useRef<number | null>(null);

  const isProgrammaticRef = useRef(false);

  // "Jump to latest" animation state.
  const jumpActiveRef = useRef(false);
  const userInteractedRef = useRef(false);
  const landingFrameRef = useRef<number | null>(null);
  const landingStartedAtRef = useRef(0);

  const setStick = useCallback((stick: boolean) => {

    autoScrollRef.current = stick;
    setAutoScrollEnabled(stick);
    setIsAtBottom(stick);
  }, []);

  const reportViewport = useCallback((element: HTMLDivElement, atBottom: boolean) => {
    const geometry: ScrollGeometry = {
      scrollTop: element.scrollTop,
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight,
      distanceFromBottom: Math.max(0, element.scrollHeight - Math.ceil(element.scrollTop) - element.clientHeight),
      distanceFromTop: Math.max(0, element.scrollTop),
    };
    onViewportChange?.(geometry, atBottom);
  }, [onViewportChange]);

  const scrollToBottomInstant = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    isProgrammaticRef.current = true;
    element.scrollTop = element.scrollHeight;
    requestAnimationFrame(() => {
      isProgrammaticRef.current = false;
    });
  }, [scrollRef]);

  const scheduleInstantScrollToBottom = useCallback(() => {
    if (pendingFrameRef.current !== null) return;
    pendingFrameRef.current = requestAnimationFrame(() => {
      pendingFrameRef.current = null;
      if (autoScrollRef.current) {
        scrollToBottomInstant();
      } else {
      }
    });
  }, [scrollToBottomInstant, isAtBottom, scrollRef]);

  // User intent tracking + older-history loading, driven by the scroll event.
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    const handleScroll = () => {
      const distance = Math.max(
        0,
        element.scrollHeight - Math.ceil(element.scrollTop) - element.clientHeight,
      );


      if (isProgrammaticRef.current) {
        return;
      }

      if (jumpActiveRef.current) {
        // Smooth "jump to latest" animation in progress: own these events so
        // early frames (large distance) never disable auto-follow mid-animation.
        if (distance <= BOTTOM_THRESHOLD) {
          setStick(true);
        }
        return;
      }
      if (distance <= BOTTOM_THRESHOLD) {
        setStick(true);
      } else {
        setStick(false);
      }

      const nextAtBottom = distance <= BOTTOM_THRESHOLD;
      reportViewport(element, nextAtBottom);

      if (shouldLoadMore && element.scrollTop <= NEAR_TOP_THRESHOLD) {
        loadMore?.();
      }
    };

    element.addEventListener("scroll", handleScroll, { passive: true });
    return () => element.removeEventListener("scroll", handleScroll);
  }, [scrollRef, setStick, shouldLoadMore, loadMore, reportViewport]);

  // Detect user interaction so a "jump to latest" animation can abort the
  // moment the user starts scrolling on their own.
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    const markUserInteraction = () => {
      userInteractedRef.current = true;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target
        && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")
      ) {
        return;
      }
      if (
        event.key.startsWith("Arrow")
        || event.key === "PageUp"
        || event.key === "PageDown"
        || event.key === "Home"
        || event.key === "End"
        || event.key === " "
      ) {
        markUserInteraction();
      }
    };

    const onWheelDetach = (e: WheelEvent) => {
      if (e.deltaY < 0) {
        setStick(false);
      }
      markUserInteraction();
    };
    const onTouchDetach = () => {
      // touchstart zawsze traktuj jako intencję oderwania – nie można odróżnić kierunku bez move
      // Ustaw detach dopiero przy faktycznym ruchu w górę w touchmove
    };
    let touchStartY = 0;
    const onTouchStartDetach = (e: TouchEvent) => {
      touchStartY = e.touches[0]?.clientY ?? 0;
      markUserInteraction();
    };
    const onTouchMoveDetach = (e: TouchEvent) => {
      const curY = e.touches[0]?.clientY ?? 0;
      if (curY > touchStartY + 5) {
        // palec w dół = scroll w górę (content w dół)
        setStick(false);
      }
      markUserInteraction();
    };
    const onKeyDetach = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (e.key === "ArrowUp" || e.key === "PageUp" || e.key === "Home") {
        setStick(false);
      }
      // Dla zgodności z poprzednią logiką
      if (
        e.key.startsWith("Arrow")
        || e.key === "PageUp"
        || e.key === "PageDown"
        || e.key === "Home"
        || e.key === "End"
        || e.key === " "
      ) {
        markUserInteraction();
      }
    };

    element.addEventListener("wheel", onWheelDetach, { passive: true });
    element.addEventListener("touchstart", onTouchStartDetach, { passive: true });
    element.addEventListener("touchmove", onTouchMoveDetach, { passive: true });
    window.addEventListener("keydown", onKeyDetach);

    return () => {
      element.removeEventListener("wheel", onWheelDetach);
      element.removeEventListener("touchstart", onTouchStartDetach);
      element.removeEventListener("touchmove", onTouchMoveDetach);
      window.removeEventListener("keydown", onKeyDetach);
    };
  }, [scrollRef, setStick]);

  // Reset follow intent whenever the chat changes. A buffer with unread content
  // is positioned by ChatMessages at its divider instead of being forced down.
  useEffect(() => {
    setStick(initialScroll);
    if (initialScroll) {
      scheduleInstantScrollToBottom();
    }
  }, [chatId, initialScroll, setStick, scheduleInstantScrollToBottom]);

  // Publish the post-reset position after the scroll container and virtualized
  // rows are mounted. This intentionally runs after the reset effect so an
  // unread buffer cannot be cleared by a stale bottom value from the previous
  // chat.
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    reportViewport(element, autoScrollRef.current);
  }, [scrollRef, chatId, reportViewport]);

  // Follow new content (instant) only when auto-follow is active.
  useEffect(() => {
    if (contentVersion === undefined) return;
    if (autoScrollRef.current) {
      scheduleInstantScrollToBottom();
    }
  }, [contentVersion, chatId, scheduleInstantScrollToBottom]);

  // ResizeObserver – wasAtBottomBeforeResize per spec
  useEffect(() => {
    const contentElement = contentRef?.current;
    if (!contentElement) return;
    let wasAtBottomBeforeResize = autoScrollRef.current;
    const observer = new ResizeObserver(() => {
      if (wasAtBottomBeforeResize && autoScrollRef.current) {
        isProgrammaticRef.current = true;
        scrollToBottomInstant();
        requestAnimationFrame(() => { isProgrammaticRef.current = false; });
      } else {
      }
    });
    const updateIntent = () => {
      const el = scrollRef.current;
      if (!el) return;
      const d = Math.max(0, el.scrollHeight - Math.ceil(el.scrollTop) - el.clientHeight);
      wasAtBottomBeforeResize = d <= BOTTOM_THRESHOLD && autoScrollRef.current;
    };
    const el = scrollRef.current;
    el?.addEventListener("scroll", updateIntent, { passive: true });
    // Sync initial
    updateIntent();
    observer.observe(contentElement);
    return () => {
      el?.removeEventListener("scroll", updateIntent);
      observer.disconnect();
    };
  }, [contentRef, chatId, contentVersion, autoScrollRef]);

  // Keep the view pinned after window-level changes while auto-follow is on.
  useEffect(() => {
    const handleRefresh = () => {
      if (
        document.visibilityState !== "visible"
        || !autoScrollRef.current
        || contentVersion === undefined
      ) {
        return;
      }
      scheduleInstantScrollToBottom();
    };

    window.addEventListener("focus", handleRefresh);
    window.addEventListener("resize", handleRefresh);
    document.addEventListener("visibilitychange", handleRefresh);

    return () => {
      window.removeEventListener("focus", handleRefresh);
      window.removeEventListener("resize", handleRefresh);
      document.removeEventListener("visibilitychange", handleRefresh);
    };
  }, [contentVersion, scheduleInstantScrollToBottom]);

  const stopLandingMonitor = useCallback(() => {
    jumpActiveRef.current = false;
    if (landingFrameRef.current !== null) {
      cancelAnimationFrame(landingFrameRef.current);
      landingFrameRef.current = null;
    }
  }, []);

  const scrollToLatest = useCallback(() => {
    setStick(true);
    const element = scrollRef.current;
    if (!element) return;

    stopLandingMonitor();
    userInteractedRef.current = false;
    jumpActiveRef.current = true;
    landingStartedAtRef.current = performance.now();

    isProgrammaticRef.current = true;
    if (scrollToEnd) {
      scrollToEnd("smooth");
    } else {
      element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
    }
    requestAnimationFrame(() => {
      isProgrammaticRef.current = false;
    });

    const step = () => {
      landingFrameRef.current = null;
      const el = scrollRef.current;
      const now = performance.now();
      const timedOut = now - landingStartedAtRef.current > JUMP_SETTLE_MAX_MS;

      if (!el || timedOut || userInteractedRef.current || !autoScrollRef.current) {
        stopLandingMonitor();
        // Re-evaluate intent on abort/timeout so a user who scrolled up during
        // the animation is not left stuck with auto-follow enabled.
        const distance = el
          ? Math.max(0, el.scrollHeight - el.scrollTop - el.clientHeight)
          : 0;
        if (el && distance > BOTTOM_THRESHOLD) {
          setStick(false);
        }
        return;
      }

      const distance = Math.max(
        0,
        el.scrollHeight - el.scrollTop - el.clientHeight,
      );
      if (distance <= BOTTOM_THRESHOLD) {
        stopLandingMonitor();
        return;
      }

      if (!scrollToEnd) {
        isProgrammaticRef.current = true;
        if (distance <= JUMP_SNAP_DISTANCE) {
          el.scrollTop = el.scrollHeight;
        } else {
          el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
        }
        requestAnimationFrame(() => {
          isProgrammaticRef.current = false;
        });
      }

      landingFrameRef.current = requestAnimationFrame(step);
    };

    landingFrameRef.current = requestAnimationFrame(step);
  }, [scrollRef, scrollToEnd, setStick, stopLandingMonitor]);

  // Cancel any pending frame or landing monitor on unmount.
  useEffect(() => {
    return () => {
      stopLandingMonitor();
      if (pendingFrameRef.current !== null) {
        cancelAnimationFrame(pendingFrameRef.current);
        pendingFrameRef.current = null;
      }
    };
  }, [stopLandingMonitor]);

  return { autoScrollEnabled, isAtBottom, scrollToLatest };
};
