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

const IRC_NICK_RE = /^[A-Za-z0-9[\]\\`_^{}|-]{1,64}$/;
const COMPAT_QUOTE_MARK = ": <";
const COMPAT_REPLY_SEP = "> << ";
/** mIRC italic + grey (14) around the quoted preview for HexChat / legacy clients. */
const COMPAT_QUOTE_STYLE_OPEN = "\u001d\u000314";
const COMPAT_QUOTE_STYLE_CLOSE = "\u000f";

const isIrcNick = (nick: string) => IRC_NICK_RE.test(nick);

/** Strip mIRC formatting codes from a string. */
const stripIrcCodes = (text: string) =>
  text.replace(/\u0003(?:\d{1,2}(?:,\d{1,2})?)?|[\u0002\u000f\u0016\u001d\u001e\u001f]/g, "");

const sanitizeReplyPreview = (preview: string) =>
  stripIrcCodes(preview)
    .replace(/[<>\r\n]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const styleCompatPreview = (preview: string) =>
  `${COMPAT_QUOTE_STYLE_OPEN}${preview}${COMPAT_QUOTE_STYLE_CLOSE}`;

export const replyTagOverheadBytes = (msgid?: string) => {
  const id = msgid?.trim();
  if (!id) return 0;
  return new TextEncoder().encode(`@+draft/reply=${id} `).length;
};

const utf8Len = (text: string) => new TextEncoder().encode(text).length;

/** Legacy-visible reply: `nick: <styled-preview> << message`. Shrinks preview to fit `maxBytes`. */
export const formatCompatReply = (
  nick: string,
  preview: string,
  message: string,
  maxBytes: number
) => {
  const body = message.replace(/\r?\n/g, "\u0085");
  if (!isIrcNick(nick) || body.startsWith("/") || body.startsWith("\x01")) {
    return body;
  }

  const nickPrefix = `${nick}: `;
  if (body.toLowerCase().startsWith(nickPrefix.toLowerCase())) {
    return body;
  }

  const fits = (value: string) => utf8Len(value) <= maxBytes;
  let safePreview = sanitizeReplyPreview(preview);

  while (safePreview.length > 0) {
    const candidate = `${nickPrefix}<${styleCompatPreview(safePreview)}${COMPAT_REPLY_SEP}${body}`;
    if (fits(candidate)) return candidate;
    safePreview = safePreview.slice(0, -1);
  }

  const nickOnly = `${nickPrefix}${body}`;
  if (fits(nickOnly)) return nickOnly;
  return body;
};

/** Inverse of `formatCompatReply`. Leaves classic `Nick: text` untouched. */
export const stripCompatReply = (content: string) => {
  const colon = content.indexOf(COMPAT_QUOTE_MARK);
  if (colon <= 0) return { body: content };
  const nick = content.slice(0, colon).trim();
  if (!isIrcNick(nick)) return { body: content };
  const after = content.slice(colon + COMPAT_QUOTE_MARK.length);
  const end = after.indexOf(COMPAT_REPLY_SEP);
  if (end < 0) return { body: content };
  const rawPreview = after.slice(0, end);
  const preview = stripIrcCodes(rawPreview);
  if (preview.includes("<")) return { body: content };
  return {
    body: after.slice(end + COMPAT_REPLY_SEP.length),
    nick,
    preview,
  };
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
