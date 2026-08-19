import { MentionMatch } from "@/types";

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const matchesToken = (content: string, value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return false;

  try {
    return new RegExp(`(^|[^\\p{L}\\p{N}_])${escapeRegExp(trimmed)}(?=$|[^\\p{L}\\p{N}_])`, "iu").test(content);
  } catch {
    return content.toLocaleLowerCase().includes(trimmed.toLocaleLowerCase());
  }
};

export const findMention = (
  content: string,
  nickname: string | undefined,
  keywords: string[] = [],
): MentionMatch => {
  if (nickname && matchesToken(content, nickname)) {
    return { matched: true, source: "nickname", value: nickname };
  }

  const keyword = keywords.find((item) => matchesToken(content, item));
  if (keyword) {
    return { matched: true, source: "keyword", value: keyword };
  }

  return { matched: false, source: null };
};
