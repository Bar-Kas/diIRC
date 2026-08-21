/**
 * Diagnostic logger for scroll, history pagination, anchor compensation, and measurement events in diIRC.
 *
 * Provides structured, color-coded console logs in DevTools to diagnose:
 * - Scroll jumps during history chunk loading (older / newer prepends and evictions)
 * - Scroll jumps when reading older messages (wheel events, live message queuing, anchor drifts)
 * - Content remeasurement adjustments (images, YouTube embeds, OpenGraph previews)
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogCategoryConfig {
  prefix: string;
  badgeStyle: string;
  textStyle: string;
}

const CATEGORIES: Record<string, LogCategoryConfig> = {
  scrollEvent: {
    prefix: "Scroll:Event",
    badgeStyle: "background: #1e3a8a; color: #93c5fd; font-weight: bold; border-radius: 3px; padding: 1px 4px;",
    textStyle: "color: #93c5fd;",
  },
  scrollWheel: {
    prefix: "Scroll:Wheel",
    badgeStyle: "background: #581c87; color: #d8b4fe; font-weight: bold; border-radius: 3px; padding: 1px 4px;",
    textStyle: "color: #d8b4fe;",
  },
  anchorCapture: {
    prefix: "Anchor:Capture",
    badgeStyle: "background: #134e4a; color: #5eead4; font-weight: bold; border-radius: 3px; padding: 1px 4px;",
    textStyle: "color: #5eead4;",
  },
  anchorRestore: {
    prefix: "Anchor:Restore",
    badgeStyle: "background: #064e3b; color: #6ee7b7; font-weight: bold; border-radius: 3px; padding: 1px 4px;",
    textStyle: "color: #6ee7b7;",
  },
  pinBottom: {
    prefix: "Scroll:PinBottom",
    badgeStyle: "background: #78350f; color: #fde68a; font-weight: bold; border-radius: 3px; padding: 1px 4px;",
    textStyle: "color: #fde68a;",
  },
  remeasure: {
    prefix: "Scroll:Remeasure",
    badgeStyle: "background: #831843; color: #f472b6; font-weight: bold; border-radius: 3px; padding: 1px 4px;",
    textStyle: "color: #f472b6;",
  },
  layoutEffect: {
    prefix: "Scroll:LayoutEffect",
    badgeStyle: "background: #312e81; color: #a5b4fc; font-weight: bold; border-radius: 3px; padding: 1px 4px;",
    textStyle: "color: #a5b4fc;",
  },
  storeHistory: {
    prefix: "Store:History",
    badgeStyle: "background: #7c2d12; color: #fdba74; font-weight: bold; border-radius: 3px; padding: 1px 4px;",
    textStyle: "color: #fdba74;",
  },
  storeLive: {
    prefix: "Store:LiveMsg",
    badgeStyle: "background: #4c1d95; color: #c4b5fd; font-weight: bold; border-radius: 3px; padding: 1px 4px;",
    textStyle: "color: #c4b5fd;",
  },
  warn: {
    prefix: "Scroll:WARN",
    badgeStyle: "background: #7f1d1d; color: #fca5a5; font-weight: bold; border-radius: 3px; padding: 1px 4px;",
    textStyle: "color: #fca5a5; font-weight: bold;",
  },
};

class ScrollDiagnostics {
  private enabled = true;
  private lastLoggedScrollTime = 0;
  private lastLoggedScrollTop = -1;

  constructor() {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("diirc:debug:scroll");
      if (stored === "false") {
        this.enabled = false;
      }
      (window as any).__diircScrollDebug = this;
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public enable(): void {
    this.enabled = true;
    localStorage.setItem("diirc:debug:scroll", "true");
    console.log("%c[diIRC] Scroll debug logging ENABLED", "color: #10b981; font-weight: bold;");
  }

  public disable(): void {
    this.enabled = false;
    localStorage.setItem("diirc:debug:scroll", "false");
    console.log("%c[diIRC] Scroll debug logging DISABLED", "color: #ef4444; font-weight: bold;");
  }

  private print(categoryKey: keyof typeof CATEGORIES, level: LogLevel, message: string, data?: any) {
    if (!this.enabled) return;
    const cat = CATEGORIES[categoryKey] || CATEGORIES.scrollEvent;
    const timestamp = new Date().toISOString().slice(11, 23);
    const badge = `%c[${cat.prefix}] %c${timestamp} %c${message}`;
    const styles = [
      cat.badgeStyle,
      "color: #71717a; font-size: 10px;",
      cat.textStyle,
    ];

    if (data !== undefined) {
      if (level === "warn") {
        console.warn(badge, ...styles, data);
      } else if (level === "error") {
        console.error(badge, ...styles, data);
      } else {
        console.log(badge, ...styles, data);
      }
    } else {
      if (level === "warn") {
        console.warn(badge, ...styles);
      } else if (level === "error") {
        console.error(badge, ...styles);
      } else {
        console.log(badge, ...styles);
      }
    }
  }

  // 1. Scroll Event Logging (throttled for regular scroll, immediate on thresholds/state change)
  public logScroll(info: {
    scrollTop: number;
    scrollHeight: number;
    clientHeight: number;
    distanceFromBottom: number;
    isAtBottom: boolean;
    shouldStick: boolean;
    programmaticRemainingMs: number;
    reason?: string;
  }) {
    const now = performance.now();
    const isEdgeTrigger = info.scrollTop <= 400 || info.distanceFromBottom <= 400;
    const isStateChange = info.reason !== undefined;
    const isTimeSample = now - this.lastLoggedScrollTime > 300 && Math.abs(info.scrollTop - this.lastLoggedScrollTop) > 20;

    if (isEdgeTrigger || isStateChange || isTimeSample) {
      this.lastLoggedScrollTime = now;
      this.lastLoggedScrollTop = info.scrollTop;
      const progStatus = info.programmaticRemainingMs > 0 ? ` [LOCKED ${Math.round(info.programmaticRemainingMs)}ms]` : "";
      const edge = info.scrollTop <= 400 ? " [TOP_EDGE]" : info.distanceFromBottom <= 400 ? " [BOTTOM_EDGE]" : "";
      const desc = info.reason ? `(${info.reason}) ` : "";

      this.print("scrollEvent", "info", `${desc}top: ${Math.round(info.scrollTop)}px, height: ${info.scrollHeight}px, distBottom: ${Math.round(info.distanceFromBottom)}px, atBottom: ${info.isAtBottom}, stick: ${info.shouldStick}${progStatus}${edge}`, {
        scrollTop: info.scrollTop,
        scrollHeight: info.scrollHeight,
        clientHeight: info.clientHeight,
        distBottom: info.distanceFromBottom,
        isAtBottom: info.isAtBottom,
        shouldStick: info.shouldStick,
        progLockRemaining: Math.round(info.programmaticRemainingMs),
      });
    }
  }

  // 2. Wheel Event Logging
  public logWheel(info: {
    deltaY: number;
    scrollTop: number;
    distanceFromBottom: number;
    action: string;
  }) {
    const dir = info.deltaY < 0 ? "UP" : "DOWN";
    this.print("scrollWheel", "info", `Wheel ${dir} (delta: ${Math.round(info.deltaY)}px) -> ${info.action} [top: ${Math.round(info.scrollTop)}px, distBottom: ${Math.round(info.distanceFromBottom)}px]`);
  }

  // 3. Anchor Capture
  public logAnchorCapture(info: {
    reason: string;
    messageId: string | null;
    screenY: number;
    scrollTop: number;
    scrollHeight: number;
    totalItems: number;
  }) {
    if (!info.messageId) {
      this.print("warn", "warn", `Anchor capture FAILED (${info.reason}): No visible row found in viewport! [items: ${info.totalItems}, scrollTop: ${Math.round(info.scrollTop)}px]`);
      return;
    }
    this.print("anchorCapture", "info", `Captured anchor msg "${info.messageId}" for (${info.reason}) [screenY: ${Math.round(info.screenY)}px, scrollTop: ${Math.round(info.scrollTop)}px, height: ${info.scrollHeight}px, totalItems: ${info.totalItems}]`, info);
  }

  // 4. Anchor Restoration in LayoutEffect
  public logAnchorRestore(info: {
    anchorId: string;
    savedScrollTop: number;
    savedScrollHeight: number;
    savedScreenY: number;
    currentScrollTop: number;
    currentScrollHeight: number;
    heightDelta: number;
    appliedScrollTop: number;
    fineDelta?: number;
    finalScrollTop: number;
    rowFound: boolean;
  }) {
    const deltaSummary = `heightDelta: ${info.heightDelta > 0 ? "+" : ""}${Math.round(info.heightDelta)}px, fineDelta: ${info.fineDelta !== undefined ? `${info.fineDelta > 0 ? "+" : ""}${info.fineDelta.toFixed(1)}px` : "N/A"}`;
    const jumpSummary = `scrollTop: ${Math.round(info.savedScrollTop)}px -> ${Math.round(info.finalScrollTop)}px (diff: ${Math.round(info.finalScrollTop - info.savedScrollTop)}px)`;
    const rowStatus = info.rowFound ? "row found" : "ROW NOT IN DOM";

    this.print("anchorRestore", info.rowFound ? "info" : "warn", `Restored anchor "${info.anchorId}" (${rowStatus}) | ${deltaSummary} | ${jumpSummary}`, info);
  }

  // 5. LayoutEffect Snapshot
  public logLayoutEffect(info: {
    action: string;
    itemsCount: number;
    totalCount: number;
    virtualTotalSize: number;
    shouldStick: boolean;
    hasAnchor: boolean;
    domScrollTop: number;
    domScrollHeight: number;
  }) {
    this.print("layoutEffect", "info", `${info.action} [items: ${info.itemsCount}, total: ${info.totalCount}, vSize: ${Math.round(info.virtualTotalSize)}px, stick: ${info.shouldStick}, hasAnchor: ${info.hasAnchor}, domTop: ${Math.round(info.domScrollTop)}px, domHeight: ${info.domScrollHeight}px]`);
  }

  // 6. Pin to Bottom
  public logPinToBottom(info: {
    reason: string;
    oldScrollTop: number;
    newScrollTop: number;
    scrollHeight: number;
    clientHeight: number;
  }) {
    this.print("pinBottom", "info", `pinToBottom (${info.reason}) -> scrollTop: ${Math.round(info.oldScrollTop)}px -> ${Math.round(info.newScrollTop)}px [height: ${info.scrollHeight}px, client: ${info.clientHeight}px]`);
  }

  // 7. Content Remeasure
  public logRemeasure(info: {
    messageId: string;
    shouldStick: boolean;
    action: string;
    topVisibleId?: string | null;
    diff?: number;
    oldScrollTop?: number;
    newScrollTop?: number;
  }) {
    const diffDesc = info.diff !== undefined ? ` [diff: ${info.diff > 0 ? "+" : ""}${info.diff.toFixed(1)}px, top: ${Math.round(info.oldScrollTop ?? 0)} -> ${Math.round(info.newScrollTop ?? 0)}]` : "";
    this.print("remeasure", "info", `Remeasure on "${info.messageId}" -> ${info.action}${diffDesc}`, info);
  }

  // 8. Store History Actions
  public logStoreHistory(action: string, data: any) {
    this.print("storeHistory", "info", `[Store] ${action}`, data);
  }

  // 9. Store Live Messages
  public logStoreLive(info: {
    sender: string;
    action: "appended_to_active_window" | "queued_in_pending_live" | "ignored_inactive_chat";
    channelOrChatId: string;
    hasNewer: boolean;
    windowSize: number;
    pendingCount: number;
    contentSnippet: string;
  }) {
    this.print("storeLive", "info", `Live msg from "${info.sender}" -> ${info.action} [hasNewer: ${info.hasNewer}, window: ${info.windowSize}, pendingLive: ${info.pendingCount}] "${info.contentSnippet}"`);
  }

  // 10. Generic Warnings
  public logWarn(message: string, data?: any) {
    this.print("warn", "warn", message, data);
  }
}

export const scrollDebug = new ScrollDiagnostics();
