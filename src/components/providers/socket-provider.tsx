import { 
  createContext,
  useContext
} from "react";

type SocketContextType = {
  socket: any | null;
  isConnected: boolean;
};

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: true,
});

export const useSocket = () => {
  return useContext(SocketContext);
};

export const SocketProvider = ({ 
  children 
}: { 
  children: React.ReactNode 
}) => {
  return (
    <SocketContext.Provider value={{ socket: null, isConnected: true }}>
      {children}
    </SocketContext.Provider>
  );
};
