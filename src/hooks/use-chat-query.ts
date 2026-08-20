import { useMockStore } from "@/lib/mock-store";

interface ChatQueryProps {
  queryKey?: string;
  paramKey: "channelId" | "conversationId";
  paramValue: string;
}

export const useChatQuery = ({
  paramKey,
  paramValue
}: ChatQueryProps) => {
  const items = useMockStore((state) =>
    paramKey === "channelId"
      ? state.messages[paramValue] || []
      : state.directMessages[paramValue] || []
  );

  const hasNextPage = useMockStore((state) => state.historyHasMore);
  const nextCursor = useMockStore((state) => state.historyNextOffset);

  return {
    data: {
      pages: [
        {
          items: items,
          nextCursor: nextCursor,
        }
      ]
    },
    fetchNextPage: () => {},
    hasNextPage,
    isFetchingNextPage: false,
    status: "success" as "success" | "loading" | "error",
  };
};

