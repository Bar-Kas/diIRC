import { useEffect, useLayoutEffect, useRef, useCallback, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { format } from "date-fns";
import { Member, Message } from "@/types";
import { Loader2, ServerCrash } from "lucide-react";

import { useChatQuery } from "@/hooks/use-chat-query";
import { useChatSocket } from "@/hooks/use-chat-socket";
import { useMockStore } from "@/lib/mock-store";

import { ChatWelcome } from "./chat-welcome";
import { ChatItem } from "./chat-item";
import { clearProxyCache } from "./smart-image";

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
  const rowElementsRef = useRef(new Map<string, HTMLDivElement>());
  const shouldStickToBottomRef = useRef(true);
  const hasInitializedRef = useRef(false);
  const isLoadingOlderRef = useRef(false);
  const pendingPrependRef = useRef<{ prevScrollHeight: number; prevScrollTop: number } | null>(null);
  const remeasureCallbacksRef = useRef(new Map<string, () => void>());
  const layoutFrameRef = useRef<number | null>(null);
  const loadChatHistory = useMockStore((state) => state.loadChatHistory);
  const loadOlderHistory = useMockStore((state) => state.loadOlderHistory);
  const historyCursor = useMockStore((state) => state.historyNextOffset);
  const hasMoreHistory = useMockStore((state) => state.historyHasMore);

  const {
    data,
    status,
  } = useChatQuery({
    queryKey,
    paramKey,
    paramValue,
  });
  useChatSocket({ queryKey, addKey, updateKey });

  const items = useMemo(() => data?.pages.flatMap((page) => page.items as Message[]) || [], [data]);
  const historyTarget = type === "channel" && !name.startsWith("#") ? `#${name}` : name;
  const hasWelcome = !hasMoreHistory && historyCursor === null;
  const totalCount = items.length + (hasWelcome ? 1 : 0);

  const virtualizer = useVirtualizer({
    count: totalCount,
    getScrollElement: () => chatRef.current,
    getItemKey: (index) => {
      if (hasWelcome && index === 0) return "__welcome__";
      const msgIndex = hasWelcome ? index - 1 : index;
      return items[msgIndex]?.id ?? index;
    },
    estimateSize: (index) => {
      if (hasWelcome && index === 0) return 160;
      const msgIndex = hasWelcome ? index - 1 : index;
      const msg = items[msgIndex];
      if (!msg) return 44;
      if (msg.fileUrl) return 240;
      const prev = items[msgIndex - 1];
      const isSameAuthor = prev && prev.member?.id === msg.member?.id;
      const isWithin5Min = prev && (new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime() < 300000);
      const isCompact = isSameAuthor && isWithin5Min && !prev.deleted && !msg.fileUrl && !prev.isSystem && !msg.isSystem;
      return isCompact ? 24 : 48;
    },
    overscan: 10,
    useAnimationFrameWithResizeObserver: true,
  });

  const registerRowElement = useCallback((element: HTMLDivElement | null, id: string) => {
    if (element) {
      rowElementsRef.current.set(id, element);
    } else {
      rowElementsRef.current.delete(id);
    }
    virtualizer.measureElement(element);
  }, [virtualizer]);

  useEffect(() => {
    hasInitializedRef.current = false;
    shouldStickToBottomRef.current = true;
    isLoadingOlderRef.current = false;
    pendingPrependRef.current = null;
    rowElementsRef.current.clear();
    remeasureCallbacksRef.current.clear();
    clearProxyCache();
    void loadChatHistory(
      type,
      chatId,
      serverId,
      historyTarget,
    );
  }, [chatId, historyTarget, loadChatHistory, serverId, type]);

  const triggerLoadOlder = useCallback(() => {
    const element = chatRef.current;
    if (
      !element
      || historyCursor === null
      || !hasMoreHistory
      || isLoadingOlderRef.current
      || items.length === 0
    ) {
      return;
    }

    isLoadingOlderRef.current = true;
    pendingPrependRef.current = {
      prevScrollHeight: element.scrollHeight,
      prevScrollTop: element.scrollTop,
    };

    // Fallback: unblock after 5s if invoke hangs
    const fallbackTimer = setTimeout(() => {
      if (isLoadingOlderRef.current) {
        isLoadingOlderRef.current = false;
        pendingPrependRef.current = null;
      }
    }, 5000);

    void loadOlderHistory(type, chatId, serverId, historyTarget).then((loaded: boolean) => {
      clearTimeout(fallbackTimer);
      if (!loaded) {
        pendingPrependRef.current = null;
        isLoadingOlderRef.current = false;
      }
    });
  }, [historyCursor, hasMoreHistory, items.length, loadOlderHistory, type, chatId, serverId, historyTarget]);

  const handleChatScroll = useCallback(() => {
    const element = chatRef.current;
    if (!element) return;

    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    // User is stuck to bottom if within 30px of the bottom edge
    shouldStickToBottomRef.current = distanceFromBottom < 30;

    // Proactively load older history when user reaches upper 400px of chat
    if (element.scrollTop <= 400) {
      triggerLoadOlder();
    }
  }, [triggerLoadOlder]);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    const element = chatRef.current;
    if (!element) return;

    if (e.deltaY < 0) {
      shouldStickToBottomRef.current = false;
    }

    // Capture upward wheel scroll even when scrollTop === 0 (where browser scroll events stop firing)
    if (e.deltaY < 0 && element.scrollTop <= 400) {
      triggerLoadOlder();
    }
  }, [triggerLoadOlder]);

  // Synchronously restore scroll position before browser paint when messages are prepended
  useLayoutEffect(() => {
    const prependSnapshot = pendingPrependRef.current;
    if (prependSnapshot && chatRef.current && items.length > 0) {
      const newScrollHeight = chatRef.current.scrollHeight;
      const heightDiff = newScrollHeight - prependSnapshot.prevScrollHeight;
      if (heightDiff > 0) {
        chatRef.current.scrollTop = prependSnapshot.prevScrollTop + heightDiff;
      }

      shouldStickToBottomRef.current = false;
      pendingPrependRef.current = null;
      isLoadingOlderRef.current = false;

      // Fast-scroll continuous loading: if user is still near the top after prepending, seamlessly fetch next page
      if (chatRef.current.scrollTop <= 400 && historyCursor !== null && hasMoreHistory) {
        requestAnimationFrame(() => {
          triggerLoadOlder();
        });
      }
    }
  }, [items, historyCursor, hasMoreHistory, triggerLoadOlder]);

  // Keep scroll pinned to bottom whenever new messages arrive or elements resize, ONLY if user is at the bottom
  useLayoutEffect(() => {
    if (shouldStickToBottomRef.current && chatRef.current && totalCount > 0 && !pendingPrependRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [virtualizer.getTotalSize(), totalCount, items]);

  // Initial mount / channel change settle sequence
  useEffect(() => {
    if (totalCount === 0) return;

    if (!hasInitializedRef.current) {
      const pinToBottom = () => {
        if (chatRef.current && !hasInitializedRef.current) {
          chatRef.current.scrollTop = chatRef.current.scrollHeight;
          virtualizer.scrollToEnd({ behavior: "auto" });
        }
      };

      pinToBottom();
      const raf1 = requestAnimationFrame(pinToBottom);
      const raf2 = requestAnimationFrame(() => {
        requestAnimationFrame(pinToBottom);
      });
      const t1 = setTimeout(pinToBottom, 60);
      const t2 = setTimeout(pinToBottom, 180);
      const t3 = setTimeout(() => {
        pinToBottom();
        hasInitializedRef.current = true;
      }, 350);

      return () => {
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    }
  }, [totalCount, virtualizer]);

  useEffect(() => {
    const refreshLayout = () => {
      if (
        document.visibilityState !== "visible"
        || !shouldStickToBottomRef.current
        || totalCount === 0
      ) {
        return;
      }

      if (layoutFrameRef.current !== null) {
        cancelAnimationFrame(layoutFrameRef.current);
      }
      layoutFrameRef.current = requestAnimationFrame(() => {
        layoutFrameRef.current = null;
        if (chatRef.current) {
          chatRef.current.scrollTop = chatRef.current.scrollHeight;
        }
        virtualizer.scrollToEnd({ behavior: "auto" });
      });
    };

    window.addEventListener("focus", refreshLayout);
    window.addEventListener("resize", refreshLayout);
    document.addEventListener("visibilitychange", refreshLayout);

    return () => {
      window.removeEventListener("focus", refreshLayout);
      window.removeEventListener("resize", refreshLayout);
      document.removeEventListener("visibilitychange", refreshLayout);
      if (layoutFrameRef.current !== null) {
        cancelAnimationFrame(layoutFrameRef.current);
        layoutFrameRef.current = null;
      }
    };
  }, [totalCount, virtualizer]);

  const getRemeasureCallback = useCallback((messageId: string) => {
    let cb = remeasureCallbacksRef.current.get(messageId);
    if (!cb) {
      cb = () => {
        const element = rowElementsRef.current.get(messageId);
        if (element) {
          virtualizer.measureElement(element);
          if (shouldStickToBottomRef.current && chatRef.current) {
            chatRef.current.scrollTop = chatRef.current.scrollHeight;
          }
        }
      };
      remeasureCallbacksRef.current.set(messageId, cb);
    }
    return cb;
  }, [virtualizer]);

  if (status === "loading") {
    return (
      <div className="flex flex-col flex-1 justify-center items-center">
        <Loader2 className="h-7 w-7 text-zinc-500 animate-spin my-4" />
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Loading messages...</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex flex-col flex-1 justify-center items-center">
        <ServerCrash className="h-7 w-7 text-zinc-500 my-4" />
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Something went wrong!</p>
      </div>
    );
  }

  return (
    <div
      ref={chatRef}
      onScroll={handleChatScroll}
      onWheel={handleWheel}
      className="flex-1 min-h-0 flex flex-col py-4 overflow-y-auto overflow-x-hidden discord-scrollbar-chat"
    >
      <div
        className="relative w-full shrink-0"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          if (hasWelcome && virtualRow.index === 0) {
            return (
              <div
                key="__welcome__"
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                className="absolute left-0 top-0 w-full"
                style={{ transform: `translateY(${virtualRow.start}px)` }}
              >
                <ChatWelcome type={type} name={name} />
              </div>
            );
          }

          const messageIndex = hasWelcome ? virtualRow.index - 1 : virtualRow.index;
          const message = items[messageIndex];
          if (!message) return null;

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

          return (
            <div
              key={message.id}
              data-index={virtualRow.index}
              ref={(element) => registerRowElement(element, message.id)}
              className="absolute left-0 top-0 w-full flow-root"
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
                onContentSizeChange={getRemeasureCallback(message.id)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
