import { useCallback, useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { format } from "date-fns";
import { Member, Message } from "@/types";
import { ArrowDown, Loader2, ServerCrash } from "lucide-react";

import { useChatQuery } from "@/hooks/use-chat-query";
import { useChatSocket } from "@/hooks/use-chat-socket";
import { useChatScroll } from "@/hooks/use-chat-scroll";
import { useMockStore } from "@/lib/mock-store";

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
  const isLoadingOlderRef = useRef(false);
  const prependScrollRef = useRef<{ height: number; top: number } | null>(null);
  const loadChatHistory = useMockStore((state) => state.loadChatHistory);
  const loadOlderHistory = useMockStore((state) => state.loadOlderHistory);
  const historyHasMore = useMockStore((state) => state.historyHasMore);

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
  const historyTarget = type === "channel" && !name.startsWith("#") ? `#${name}` : name;
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => chatRef.current,
    getItemKey: (index) => items[index]?.id ?? index,
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

  const {
    autoScrollEnabled,
    scrollToLatest,
  } = useChatScroll({
    scrollRef: chatRef,
    contentRef,
    contentVersion: items.length,
    chatId,
    shouldLoadMore: historyHasMore,
    loadMore: loadOlderIfEligible,
    scrollToEnd: scrollToLatestEnd,
  });

  const remeasureRow = (messageId: string) => {
    requestAnimationFrame(() => {
      const element = rowElementsRef.current.get(messageId);
      const index = items.findIndex((item) => item.id === messageId);
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
        style={{ overflowAnchor: "none" }}
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
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const message = items[virtualRow.index];
              const prevMessage = items[virtualRow.index - 1];
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
                  ref={(element) => {
                    if (element) {
                      rowElementsRef.current.set(message.id, element);
                      virtualizer.measureElement(element);
                    } else {
                      rowElementsRef.current.delete(message.id);
                    }
                  }}
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
                    onContentSizeChange={() => remeasureRow(message.id)}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {!autoScrollEnabled && (
        <button
          type="button"
          onClick={scrollToLatest}
          className="absolute bottom-4 right-4 z-10 flex items-center gap-x-1.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3 py-2 shadow-lg transition"
        >
          <ArrowDown className="h-4 w-4" />
          Jump to latest
        </button>
      )}
    </div>
  );
};