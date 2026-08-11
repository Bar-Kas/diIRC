import { useMockStore } from "@/lib/mock-store";

interface ChatQueryProps {
  queryKey: string;
  apiUrl: string;
  paramKey: "channelId" | "conversationId";
  paramValue: string;
}

export const useChatQuery = ({
  paramKey,
  paramValue
}: ChatQueryProps) => {
  const messagesMap = useMockStore((state) => 
    paramKey === "channelId" ? state.messages : state.directMessages
  );

  const items = messagesMap[paramValue] || [];

  return {
    data: {
      pages: [
        {
          items: items,
          nextCursor: null,
        }
      ]
    },
    fetchNextPage: () => {},
    hasNextPage: false,
    isFetchingNextPage: false,
    status: "success" as const,
  };
};
