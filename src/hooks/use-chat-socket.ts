type ChatSocketProps = {
  addKey: string;
  updateKey: string;
  queryKey: string;
};

export const useChatSocket = ({}: ChatSocketProps) => {
  // Static UI mode: messages are updated directly via Zustand useMockStore
};
