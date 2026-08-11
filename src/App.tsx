import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ModalProvider } from "@/components/providers/modal-provider";
import { SocketProvider } from "@/components/providers/socket-provider";

import { MainLayout } from "@/layouts/main-layout";
import { SetupPage } from "@/pages/setup-page";
import { ServerPage } from "@/pages/server-page";
import { ChannelPage } from "@/pages/channel-page";
import { ConversationPage } from "@/pages/conversation-page";
import { InvitePage } from "@/pages/invite-page";

export function App() {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      storageKey="discord-theme"
    >
      <SocketProvider>
        <BrowserRouter>
          <ModalProvider />
          <Routes>
            <Route path="/" element={<SetupPage />} />
            <Route path="/invite/:inviteCode" element={<InvitePage />} />
            <Route path="/servers/:serverId" element={<MainLayout />}>
              <Route index element={<ServerPage />} />
              <Route path="channels/:channelId" element={<ChannelPage />} />
              <Route path="conversations/:memberId" element={<ConversationPage />} />
            </Route>
            <Route path="*" element={<SetupPage />} />
          </Routes>
        </BrowserRouter>
      </SocketProvider>
    </ThemeProvider>
  );
}

export default App;
