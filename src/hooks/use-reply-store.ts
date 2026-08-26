import { create } from "zustand";

export interface ReplyTarget {
  messageId: string;
  nick: string;
  preview: string;
  /** IRCv3 msgid of the parent message, when known. */
  msgid?: string;
  /** Parent message byte offset in the native log, when known. */
  parentOffset?: number;
}

interface MsgidIndexEntry {
  messageId: string;
  nick: string;
  preview: string;
}

interface ReplyStore {
  pendingByChatId: Record<string, ReplyTarget>;
  metaByMessageId: Record<string, ReplyTarget>;
  /** IRCv3 msgid → local message info (for resolving inbound replies). */
  byMsgid: Record<string, MsgidIndexEntry>;
  setPending: (chatId: string, target: ReplyTarget) => void;
  clearPending: (chatId: string) => void;
  getPending: (chatId: string) => ReplyTarget | undefined;
  rememberSent: (messageId: string, target: ReplyTarget) => void;
  getMeta: (messageId: string) => ReplyTarget | undefined;
  indexMsgid: (msgid: string, entry: MsgidIndexEntry) => void;
  findByMsgid: (msgid: string) => MsgidIndexEntry | undefined;
}

const previewText = (content: string, max = 120) => {
  const flat = content.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max - 1)}…`;
};

export const buildReplyPreview = previewText;

/** Classic IRC / HexChat-compatible highlight reply. */
export const formatHexChatReply = (nick: string, message: string) => {
  const body = message.trim();
  const prefix = `${nick}: `;
  if (body.toLowerCase().startsWith(prefix.toLowerCase())) {
    return body;
  }
  return `${prefix}${body}`;
};

export const focusChatMessage = (messageId: string) => {
  window.dispatchEvent(
    new CustomEvent("focus_chat_message", { detail: { messageId } })
  );
};

export const useReplyStore = create<ReplyStore>((set, get) => ({
  pendingByChatId: {},
  metaByMessageId: {},
  byMsgid: {},
  setPending: (chatId, target) =>
    set((state) => ({
      pendingByChatId: {
        ...state.pendingByChatId,
        [chatId]: {
          ...target,
          preview: previewText(target.preview),
        },
      },
    })),
  clearPending: (chatId) =>
    set((state) => {
      const next = { ...state.pendingByChatId };
      delete next[chatId];
      return { pendingByChatId: next };
    }),
  getPending: (chatId) => get().pendingByChatId[chatId],
  rememberSent: (messageId, target) =>
    set((state) => ({
      metaByMessageId: {
        ...state.metaByMessageId,
        [messageId]: {
          ...target,
          preview: previewText(target.preview),
        },
      },
    })),
  getMeta: (messageId) => get().metaByMessageId[messageId],
  indexMsgid: (msgid, entry) =>
    set((state) => ({
      byMsgid: {
        ...state.byMsgid,
        [msgid]: {
          ...entry,
          preview: previewText(entry.preview),
        },
      },
    })),
  findByMsgid: (msgid) => get().byMsgid[msgid],
}));
