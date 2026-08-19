import { useCallback, useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { format } from "date-fns";
import { BufferRef, BufferKey, Member, Message, MessageAnchor, ScrollGeometry } from "@/types";
import { ArrowDown, Loader2, ServerCrash } from "lucide-react";

import { useChatQuery } from "@/hooks/use-chat-query";
import { useChatSocket } from "@/hooks/use-chat-socket";
import { useChatScroll } from "@/hooks/use-chat-scroll";
import { useMockStore } from "@/lib/mock-store";
import { getChannelBuffer, getConversationBuffer } from "@/lib/chat-buffer";

import { ChatWelcome } from "./chat-welcome";
import { ChatItem } from "./chat-item";

const DATE_FORMAT = "d MMM yyyy, HH:mm";
const TIME_FORMAT = "HH:mm";

interface ChatMessagesProps {
  name: string;
  member: Member;
  chatId: string;
  serverId: string;
  paramKey: "channelId" | "conversationId";
  paramValue: string;
  type: "channel" | "conversation";
}

export const ChatMessages = ({
  name,
  member,
  chatId,
  serverId,
  paramKey,
  paramValue,
  type,
}: ChatMessagesProps) => {
  const queryKey = `chat:${chatId}`;
  const addKey = `chat:${chatId}:messages`;
  const updateKey = `chat:${chatId}:messages:update`;
  const chatRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const rowElementsRef = useRef(new Map<string, HTMLDivElement>());
  const initialUnreadScrollRef = useRef<string | null>(null);
  const isLoadingOlderRef = useRef(false);
  const prependScrollRef = useRef<{ height: number; top: number } | null>(null);
  const loadChatHistory = useMockStore((state) => state.loadChatHistory);
  const loadOlderHistory = useMockStore((state) => state.loadOlderHistory);
  const historyHasMore = useMockStore((state) => state.historyHasMore);
  const historyTarget = type === "channel" && !name.startsWith("#") ? `#${name}` : name;
  const readState = useMockStore((state) => state.readStates[
    type === "channel"
      ? getChannelBuffer(serverId, chatId, name).key
      : getConversationBuffer(serverId, chatId, name).key
  ]);
  const setViewportState = useMockStore((state) => state.setViewportState);
  const markBufferRead = useMockStore((state) => state.markBufferRead);

  const buffer: BufferRef = type === "channel"
    ? getChannelBuffer(serverId, chatId, historyTarget)
    : getConversationBuffer(serverId, chatId, name);
  const bufferKey: BufferKey = buffer.key;

  const {
    data,
    status,
  } = useChatQuery({
    queryKey,
    paramKey,
    paramValue,
  });
  useChatSocket({ queryKey, addKey, updateKey });

  const items = data?.pages.flatMap((page) => page.items as Message[]) || [];
  const dividerMessageIndex = readState?.firstUnread
    ? items.findIndex((item) => {
        const anchor = readState.firstUnread;
        if (!anchor) return false;
        if (item.id === anchor.messageId) return true;
        const itemFp = `${item.member.profile.name}|${item.content}`.slice(0, 200);
        if (anchor.fingerprint && itemFp === anchor.fingerprint) return true;
        const anchorTime = anchor.timestamp ? new Date(anchor.timestamp).getTime() : 0;
        const itemTime = new Date(item.sourceTimestamp || item.createdAt).getTime();
        if (!isNaN(anchorTime) && !isNaN(itemTime) && itemTime >= anchorTime) return true;
        // fallback with small drift tolerance for Rust vs JS clock
        if (!isNaN(anchorTime) && !isNaN(itemTime) && itemTime >= anchorTime - 500) {
          if (anchor.sender && item.member.profile.name === anchor.sender) return true;
        }
        return false;
      })
    : -1;
  const dividerIndex = dividerMessageIndex >= 0
    ? dividerMessageIndex
    : readState?.firstUnread && items.length > 0
      ? 0
      : -1;
  const renderItems: Array<
    | { kind: "message"; message: Message }
    | { kind: "divider"; anchor: MessageAnchor }
  > = readState?.firstUnread && items.length > 0
    ? [
        ...items.slice(0, dividerIndex).map((message) => ({ kind: "message" as const, message })),
        { kind: "divider", anchor: readState.firstUnread },
        ...items.slice(dividerIndex).map((message) => ({ kind: "message" as const, message })),
      ]
    : items.map((message) => ({ kind: "message" as const, message }));

  const virtualizer = useVirtualizer({
    count: renderItems.length,
    getScrollElement: () => chatRef.current,
    getItemKey: (index) => {
      const item = renderItems[index];
      return item?.kind === "divider"
        ? `divider:${buffer.key}:${item.anchor.timestamp}`
        : item?.kind === "message" ? item.message.id : index;
    },
    estimateSize: () => 72,
    overscan: 8,
    useAnimationFrameWithResizeObserver: true,
  });

  useEffect(() => {
    isLoadingOlderRef.current = false;
    prependScrollRef.current = null;
    void loadChatHistory(
      type,
      chatId,
      serverId,
      historyTarget,
    );
  }, [chatId, historyTarget, loadChatHistory, serverId, type]);

  const loadOlderIfEligible = useCallback(() => {
    const element = chatRef.current;
    if (
      !element
      || element.scrollTop > 24
      || !historyHasMore
      || isLoadingOlderRef.current
      || items.length === 0
    ) {
      return;
    }

    isLoadingOlderRef.current = true;
    prependScrollRef.current = {
      height: element.scrollHeight,
      top: element.scrollTop,
    };

    void loadOlderHistory(type, chatId, serverId, historyTarget).then((loaded) => {
      if (!loaded) {
        prependScrollRef.current = null;
        isLoadingOlderRef.current = false;
        return;
      }

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const currentElement = chatRef.current;
          const snapshot = prependScrollRef.current;
          if (currentElement && snapshot) {
            currentElement.scrollTop = snapshot.top + currentElement.scrollHeight - snapshot.height;
          }
          prependScrollRef.current = null;
          isLoadingOlderRef.current = false;
        });
      });
    });
  }, [historyHasMore, items.length, loadOlderHistory, type, chatId, serverId, historyTarget]);

  const scrollToLatestEnd = useCallback((behavior: ScrollBehavior) => {
    virtualizer.scrollToEnd({ behavior });
  }, [virtualizer]);

  const handleViewportChange = useCallback((geometry: ScrollGeometry, _atBottom: boolean) => {
    const vItems = virtualizer.getVirtualItems();
    const lastVisible = vItems[vItems.length - 1]?.index;
    const atBottomStrict = lastVisible !== undefined && lastVisible >= renderItems.length - 1;
    setViewportState(bufferKey, {
      bufferKey,
      geometry,
      isAtBottom: atBottomStrict,
      isAtTop: geometry.distanceFromTop <= 24,
    });
  }, [bufferKey, setViewportState, virtualizer, renderItems.length]);

  const {
    isAtBottom,
    scrollToLatest,
  } = useChatScroll({
    scrollRef: chatRef,
    contentRef,
    contentVersion: items[items.length - 1]?.id || items.length,
    chatId,
    initialScroll: !readState?.firstUnread,
    shouldLoadMore: historyHasMore,
    loadMore: loadOlderIfEligible,
    scrollToEnd: scrollToLatestEnd,
    onViewportChange: handleViewportChange,
  });

  const lastChatIdForDividerRef = useRef<string | null>(null);
  useEffect(() => {
    if (lastChatIdForDividerRef.current === chatId) return;
    lastChatIdForDividerRef.current = chatId;
    const anchor = readState?.firstUnread;
    if (!anchor || dividerIndex < 0 || items.length === 0) return;
    const anchorKey = `${chatId}:${anchor.timestamp}:${anchor.messageId || ""}`;
    if (initialUnreadScrollRef.current === anchorKey) return;
    initialUnreadScrollRef.current = anchorKey;
    requestAnimationFrame(() => {
      virtualizer.scrollToIndex(dividerIndex, { align: "start", behavior: "auto" });
    });
  }, [chatId, dividerIndex, items.length, readState?.firstUnread, virtualizer]);

  const hasScrolledToBottomRef = useRef<string | null>(null);
  useEffect(() => {
    if (readState?.firstUnread) return;
    if (items.length === 0) return;
    if (hasScrolledToBottomRef.current === chatId) return;
    hasScrolledToBottomRef.current = chatId;
    requestAnimationFrame(() => {
      virtualizer.scrollToIndex(renderItems.length - 1, { align: "end", behavior: "auto" });
    });
  }, [chatId, items.length, readState?.firstUnread, renderItems.length, virtualizer]);

  const remeasureRow = (messageId: string) => {
    requestAnimationFrame(() => {
      const element = rowElementsRef.current.get(messageId);
      const messageIndex = items.findIndex((item) => item.id === messageId);
      const index = messageIndex >= 0
        ? messageIndex + (dividerIndex >= 0 && messageIndex >= dividerIndex ? 1 : 0)
        : -1;
      if (element && index >= 0) {
        virtualizer.resizeItem(index, element.offsetHeight);
      }
    });
  };

  if (status === "loading") {
    return (
      <div className="flex flex-col flex-1 justify-center items-center">
        <Loader2 className="h-7 w-7 text-zinc-500 animate-spin my-4" />
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Loading messages...</p>
      </div>
    );
  }

  const virtualItems = virtualizer.getVirtualItems();
  const firstVisibleIndex = virtualItems[0]?.index;
  const lastVisibleIndex = virtualItems[virtualItems.length - 1]?.index;
  // Unread jump pozostaje widoczny dopóki unreadCount>0 (nie znika po dotarciu do dividera),
  // znika dopiero po oznaczeniu jako przeczytane (dół / Esc / Jump to Present)
  const showJumpToUnread = (readState?.unreadCount || 0) > 0 && dividerIndex >= 0;
  const lastVisibleForJump = virtualItems[virtualItems.length - 1]?.index;
  const isAtBottomStrict = lastVisibleForJump !== undefined && lastVisibleForJump >= renderItems.length - 1;
  const showJumpToPresent = !isAtBottomStrict
    && (readState?.unreadCount || 0) > 0;
  // Znika dopiero gdy separator dojedzie na górę okna + margines
  const DIVIDER_TOP_MARGIN = 3;
  useEffect(() => {
    if (!readState?.firstUnread || dividerIndex < 0) return;
    const firstVisible = virtualItems[0]?.index;
    if (firstVisible === undefined) return;
    if (firstVisible > dividerIndex + DIVIDER_TOP_MARGIN) {
      markBufferRead(bufferKey, "manual");
    }
  }, [virtualItems, dividerIndex, readState?.firstUnread, bufferKey, markBufferRead]);

  const jumpToUnread = () => {
    if (dividerIndex >= 0) {
      virtualizer.scrollToIndex(dividerIndex, { align: "start", behavior: "smooth" });
    }
  };
  const jumpToPresent = () => {
    markBufferRead(bufferKey, "jump-to-present");
    scrollToLatest();
  };

  const updateUnreadProgress = useMockStore((s) => s.updateUnreadProgress);
  // Progresywne zmniejszanie licznika podczas scrollowania – licznik spada gdy nieprzeczytane przewijane są nad viewport,
  // separator pozostaje stabilny na pierwszej nieprzeczytanej
  useEffect(() => {
    if (!readState?.firstUnread || dividerIndex < 0 || items.length === 0) return;
    if (virtualItems.length === 0) return;
    let frame: number | null = requestAnimationFrame(() => {
      frame = null;
      const firstVisible = virtualItems[0]?.index;
      if (firstVisible === undefined) return;
      // Ile nieprzeczytanych przewinięto nad viewport (powyżej firstVisible)
      const scrolledPast = Math.max(0, firstVisible - dividerIndex - 1);
      const totalUnread = Math.max(0, items.length - dividerMessageIndex);
      const remaining = Math.max(0, totalUnread - scrolledPast);
      if (remaining >= (readState.unreadCount || 0)) return;
      if (remaining === 0) {
        // Nie czyść od razu gdy mała lista – poczekaj na isAtBottom (śr. 0px)
        return;
      }
      let remainingMentions = 0;
      // Policz mentions w pozostałych (od firstVisible+scrolledPast)
      const nextUnreadIdx = dividerMessageIndex + scrolledPast;
      for (let i = nextUnreadIdx; i < items.length; i++) {
        if (items[i].mention?.matched) remainingMentions++;
      }
      updateUnreadProgress(bufferKey, remaining, readState.firstUnread, remainingMentions);
    });
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [virtualItems, dividerIndex, dividerMessageIndex, items, readState?.firstUnread, readState?.unreadCount, bufferKey, updateUnreadProgress]);

  if (status === "error") {
    return (
      <div className="flex flex-col flex-1 justify-center items-center">
        <ServerCrash className="h-7 w-7 text-zinc-500 my-4" />
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Something went wrong!</p>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col flex-1 min-h-0">
      <div
        ref={chatRef}
        style={{ overflowAnchor: "auto" }}
        className="flex-1 min-h-0 flex flex-col py-4 overflow-y-auto"
      >
        {items.length === 0 ? (
          <div className="flex flex-1 flex-col justify-end">
            <ChatWelcome type={type} name={name} />
          </div>
        ) : (
          <div
            ref={contentRef}
            className="relative w-full shrink-0"
            style={{ height: `${virtualizer.getTotalSize()}px` }}
          >
            {virtualItems.map((virtualRow) => {
              const renderItem = renderItems[virtualRow.index];
              if (renderItem.kind === "divider") {
                return (
                  <div
                    key={`divider:${buffer.key}:${renderItem.anchor.timestamp}`}
                    data-index={virtualRow.index}
                    ref={(element) => {
                      if (element) virtualizer.measureElement(element);
                    }}
                    className="absolute left-0 top-0 w-full px-4 py-3"
                    style={{ transform: `translateY(${virtualRow.start}px)`, overflowAnchor: "none" }}
                  >
                    <div className="flex items-center gap-3 text-[10px] font-bold tracking-wider text-rose-500">
                      <div className="h-px flex-1 bg-rose-500/80" />
                      <span className="whitespace-nowrap">NOWE WIADOMOŚCI</span>
                      <div className="h-px flex-1 bg-rose-500/80" />
                    </div>
                  </div>
                );
              }

              const message = renderItem.message;
              const messageIndex = virtualRow.index - (dividerIndex >= 0 && virtualRow.index > dividerIndex ? 1 : 0);
              const prevMessage = items[messageIndex - 1];
              const isSameAuthor = prevMessage?.member?.id === message.member?.id;
              const isWithinTimeLimit = prevMessage
                && new Date(message.createdAt).getTime() - new Date(prevMessage.createdAt).getTime() < 300000;
              const isCompact = Boolean(
                isSameAuthor
                && isWithinTimeLimit
                && !prevMessage.deleted
                && !message.fileUrl
                && !prevMessage.isSystem
                && !message.isSystem,
              );

              const isMention = !!message.mention?.matched;
              return (
                <div
                    key={message.id}
                  data-index={virtualRow.index}
                  ref={(element) => {
                    if (element) {
                      rowElementsRef.current.set(message.id, element);
                      virtualizer.measureElement(element);
                    } else {
                      rowElementsRef.current.delete(message.id);
                    }
                  }}
                  className={`absolute left-0 top-0 w-full flow-root ${isMention ? "bg-amber-500/10 dark:bg-amber-500/15 border-l-2 border-amber-500" : ""}`}
                  style={{ transform: `translateY(${virtualRow.start}px)` }}
                >
                  <ChatItem
                    id={message.id}
                    currentMember={member}
                    member={message.member}
                    content={message.content}
                    fileUrl={message.fileUrl || null}
                    deleted={message.deleted}
                    timestamp={format(new Date(message.createdAt), DATE_FORMAT)}
                    compactTime={format(new Date(message.createdAt), TIME_FORMAT)}
                    channelId={paramKey === "channelId" ? paramValue : undefined}
                    conversationId={paramKey === "conversationId" ? paramValue : undefined}
                    compact={isCompact}
                    isSystem={message.isSystem}
                    onContentSizeChange={() => remeasureRow(message.id)}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {(showJumpToUnread || showJumpToPresent) && (
        <div className="absolute top-4 right-4 z-10 flex items-center rounded-full shadow-lg overflow-hidden border border-black/10">
          {showJumpToUnread && (
            <button
              type="button"
              onClick={jumpToUnread}
              className="flex items-center gap-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold px-4 py-2 transition"
            >
              <span className="bg-white text-rose-600 rounded-full px-1.5 py-0.5 text-[11px] font-bold leading-none">
                {readState?.unreadCount || 0}
              </span>
              Skocz do nieprzeczytanych
            </button>
          )}
          {showJumpToUnread && showJumpToPresent && (
            <div className="w-px self-stretch bg-white/20" />
          )}
          {showJumpToPresent && (
            <button
              type="button"
              onClick={jumpToPresent}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3 py-2 transition"
            >
              Przejdź do najnowszych
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
