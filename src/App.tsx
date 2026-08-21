import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ModalProvider } from "@/components/providers/modal-provider";
import { SocketProvider } from "@/components/providers/socket-provider";
import { IrcProvider } from "@/components/providers/irc-provider";

import { MainLayout } from "@/layouts/main-layout";
import { SetupPage } from "@/pages/setup-page";
import { ServerPage } from "@/pages/server-page";
import { ChannelPage } from "@/pages/channel-page";
import { ConversationPage } from "@/pages/conversation-page";
import { InvitePage } from "@/pages/invite-page";

import { InvitePreviewPage } from "@/pages/invite-preview-page";

export function App() {
  useEffect(() => {
    // Prevent default native webview right-click context menu globally except in text input fields
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target) {
        const isInput =
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable;
        if (!isInput) {
          e.preventDefault();
        }
      }
    };

    window.addEventListener("contextmenu", handleContextMenu);
    return () => window.removeEventListener("contextmenu", handleContextMenu);
  }, []);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      storageKey="discord-theme"
    >
      <SocketProvider>
        <BrowserRouter>
          <IrcProvider>
            <ModalProvider />
            <Routes>
              <Route path="/" element={<SetupPage />} />
            <Route path="/invite/:inviteCode" element={<InvitePage />} />
            <Route path="/servers/:serverId" element={<MainLayout />}>
              <Route index element={<ServerPage />} />
              <Route path="channels/:channelId" element={<ChannelPage />} />
              <Route path="conversations/:memberId" element={<ConversationPage />} />
              <Route path="invites/:channelName" element={<InvitePreviewPage />} />
            </Route>
            <Route path="*" element={<SetupPage />} />
            </Routes>
          </IrcProvider>
        </BrowserRouter>
      </SocketProvider>
    </ThemeProvider>
  );
}

export default App;
