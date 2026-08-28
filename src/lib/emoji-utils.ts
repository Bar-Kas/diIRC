/**
 * Emoji detection and jumboji sizing utilities for diIRC.
 */

// Matches a single Unicode emoji grapheme cluster (including ZWJ sequences, skin tones, flags, and keycaps)
const EMOJI_GRAPHEME_REGEX = /^(?:[\p{Extended_Pictographic}\p{Emoji_Presentation}\p{Regional_Indicator}\uFE0F\uFE0E\u200D\u20E3\u{1F3FB}-\u{1F3FF}]+|[0-9#*]\uFE0F?\u20E3)$/u;

/**
 * Detects if a text consists strictly of 1 or more Unicode emojis and optional whitespace.
 * Returns the count of emojis if only-emoji, or 0 if it contains any non-emoji characters.
 */
export function getOnlyEmojiCount(text: string): number {
  if (!text) return 0;
  const trimmed = text.trim();
  if (!trimmed) return 0;

  const IntlAny = Intl as any;
  if (typeof IntlAny !== "undefined" && IntlAny.Segmenter) {
    const segmenter = new IntlAny.Segmenter("en", { granularity: "grapheme" });
    const segments = Array.from(segmenter.segment(trimmed)).map((s: any) => s.segment);

    let emojiCount = 0;
    for (const seg of segments) {
      if (/^\s+$/.test(seg)) continue; // ignore spaces and newlines between emojis
      if (EMOJI_GRAPHEME_REGEX.test(seg)) {
        emojiCount++;
      } else {
        return 0; // contains non-emoji character (text, letters, punctuation, etc.)
      }
    }
    return emojiCount;
  }

  return 0;
}

/**
 * Returns Tailwind CSS classes for jumboji (enlarged emoji) styling.
 * Sizing scales dynamically based on emoji count, similar to Discord & Slack:
 * - 1-3 emojis: 42px
 * - 4-8 emojis: 30px
 * - 9-16 emojis: 22px
 * - >16 emojis: standard 14px text
 */
export function getEmojiSizeClass(emojiCount: number): string {
  if (emojiCount <= 0 || emojiCount > 16) return "";
  if (emojiCount <= 3) {
    return "text-[42px] leading-tight py-1 my-0.5";
  }
  if (emojiCount <= 8) {
    return "text-[30px] leading-snug py-0.5 my-0.5";
  }
  return "text-[22px] leading-normal py-0.5";
}
