import { RefObject, useCallback, useEffect, useRef, useState } from "react";

/**
 * Distance (px) from the bottom edge that counts as "at the bottom". Anything
 * within this band keeps auto-follow enabled.
 */
const BOTTOM_ENTER_THRESHOLD = 32;

/**
 * Distance (px) from the bottom edge beyond which the user is considered to
 * have deliberately scrolled up to read history, which disables auto-follow.
 * The gap between the two thresholds acts as hysteresis so small scroll jitter
 * or height changes do not constantly flip the follow state.
 */
const BOTTOM_LEAVE_THRESHOLD = 96;

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
}: UseChatScrollOptions): UseChatScrollResult => {
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(initialScroll);
  const [isAtBottom, setIsAtBottom] = useState(initialScroll);

  // Ref mirror so effects/callbacks always read the current value without
  // forcing re-runs on every state toggle.
  const autoScrollRef = useRef(initialScroll);
  const pendingFrameRef = useRef<number | null>(null);

  // One-shot suppression timestamp for events caused by our own writes.
  const suppressUntilRef = useRef(0);

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

  const scrollToBottomInstant = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    suppressUntilRef.current = performance.now() + PROGRAMMATIC_SUPPRESS_MS;
    element.scrollTop = element.scrollHeight;
  }, [scrollRef]);

  const scheduleInstantScrollToBottom = useCallback(() => {
    if (pendingFrameRef.current !== null) return;
    pendingFrameRef.current = requestAnimationFrame(() => {
      pendingFrameRef.current = null;
      // Re-check intent when the frame actually runs so a user scroll that
      // happened in the meantime is never overridden.
      if (autoScrollRef.current) {
        scrollToBottomInstant();
      }
    });
  }, [scrollToBottomInstant]);

  // User intent tracking + older-history loading, driven by the scroll event.
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    const handleScroll = () => {
      const distance = Math.max(
        0,
        element.scrollHeight - element.scrollTop - element.clientHeight,
      );

      // Ignore the scroll event produced by our own programmatic write. This
      // prevents async content growth (an image/video loading above the view)
      // from looking like a user scroll and disabling auto-follow.
      if (suppressUntilRef.current !== 0) {
        if (performance.now() <= suppressUntilRef.current) {
          suppressUntilRef.current = 0;
          return;
        }
        suppressUntilRef.current = 0;
      }

      if (jumpActiveRef.current) {
        // Smooth "jump to latest" animation in progress: own these events so
        // early frames (large distance) never disable auto-follow mid-animation.
        if (distance <= BOTTOM_ENTER_THRESHOLD) {
          setStick(true);
        }
        return;
      }

      if (distance <= BOTTOM_ENTER_THRESHOLD) {
        setStick(true);
      } else if (distance > BOTTOM_LEAVE_THRESHOLD) {
        setStick(false);
      }

      if (shouldLoadMore && element.scrollTop <= NEAR_TOP_THRESHOLD) {
        loadMore?.();
      }
    };

    element.addEventListener("scroll", handleScroll, { passive: true });
    return () => element.removeEventListener("scroll", handleScroll);
  }, [scrollRef, setStick, shouldLoadMore, loadMore]);

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

    element.addEventListener("wheel", markUserInteraction, { passive: true });
    element.addEventListener("touchstart", markUserInteraction, { passive: true });
    window.addEventListener("keydown", onKeyDown);

    return () => {
      element.removeEventListener("wheel", markUserInteraction);
      element.removeEventListener("touchstart", markUserInteraction);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [scrollRef]);

  // Reset auto-follow and park at the bottom whenever the chat changes.
  useEffect(() => {
    setStick(true);
    scheduleInstantScrollToBottom();
  }, [chatId, setStick, scheduleInstantScrollToBottom]);

  // Follow new content (instant) only when auto-follow is active.
  useEffect(() => {
    if (contentVersion === undefined) return;
    if (autoScrollRef.current) {
      scheduleInstantScrollToBottom();
    }
  }, [contentVersion, chatId, scheduleInstantScrollToBottom]);

  // Handle delayed layout shifts (images, video, iframes, code blocks...).
  // `contentVersion` is a dependency so the observer attaches as soon as the
  // content element actually mounts/changes.
  useEffect(() => {
    const contentElement = contentRef?.current;
    if (!contentElement) return;

    const observer = new ResizeObserver(() => {
      if (autoScrollRef.current) {
        scheduleInstantScrollToBottom();
      }
    });
    observer.observe(contentElement);

    return () => observer.disconnect();
  }, [contentRef, chatId, contentVersion, scheduleInstantScrollToBottom]);

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

    suppressUntilRef.current = performance.now() + PROGRAMMATIC_SUPPRESS_MS;
    if (scrollToEnd) {
      scrollToEnd("smooth");
    } else {
      element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
    }

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
        if (el && distance > BOTTOM_LEAVE_THRESHOLD) {
          setStick(false);
        }
        return;
      }

      const distance = Math.max(
        0,
        el.scrollHeight - el.scrollTop - el.clientHeight,
      );
      if (distance <= BOTTOM_ENTER_THRESHOLD) {
        stopLandingMonitor();
        return;
      }

      if (!scrollToEnd) {
        // Fallback path (no virtualizer override): keep re-targeting the
        // smooth scroll while rows re-measure, snapping for the final stretch.
        suppressUntilRef.current = performance.now() + PROGRAMMATIC_SUPPRESS_MS;
        if (distance <= JUMP_SNAP_DISTANCE) {
          el.scrollTop = el.scrollHeight;
        } else {
          el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
        }
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