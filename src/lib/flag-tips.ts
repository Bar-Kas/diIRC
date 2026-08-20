import { CHANNEL_FLAGS, FlagConfig } from "@/components/modals/channel-operator-settings-modal";

/**
 * Extracts flag character from error text or mode strings.
 * Avoids false positives like matching English words (e.g. 'on' in 'mode on').
 */
export const extractFlag = (text?: string): string | null => {
  if (!text) return null;

  // 1. Quoted flag, e.g. Unknown mode flag 'p', flag "p", char 'p', 'p' is unknown
  const quotedMatch =
    text.match(/(?:flag|mode|char)\s*['"`]([a-zA-Z])['"`]/i) ||
    text.match(/['"`]([a-zA-Z])['"`]\s*(?:is|was|\:)/i);
  if (quotedMatch && quotedMatch[1]) {
    return quotedMatch[1].toLowerCase();
  }

  // 2. Explicit sign prefix, e.g. +p, -p, mode +p, mode -p, flag +p
  const signedMatch = text.match(/[\+\-]([a-zA-Z])\b/);
  if (signedMatch && signedMatch[1]) {
    return signedMatch[1].toLowerCase();
  }

  // 3. Single character before "is unknown mode", "is not a recognized", etc., e.g. "p is unknown mode char"
  const charBeforeIs = text.match(/\b([a-zA-Z])\s+is\s+(?:unknown|not\s+supported|not\s+recognized)\b/i);
  if (charBeforeIs && charBeforeIs[1]) {
    return charBeforeIs[1].toLowerCase();
  }

  // 4. "flag <single_letter>", e.g. "flag p"
  const flagSpaceMatch = text.match(/\bflag\s+([a-zA-Z])\b/i);
  if (flagSpaceMatch && flagSpaceMatch[1]) {
    return flagSpaceMatch[1].toLowerCase();
  }

  return null;
};

/**
 * Resolves a tip for a channel flag, either directly from the flag name
 * or by parsing mode error messages for referenced flag characters.
 */
export const getFlagTip = (flag?: string, text?: string): FlagConfig | null => {
  const targetFlag = (flag || extractFlag(text))?.toLowerCase();
  if (targetFlag) {
    const config = CHANNEL_FLAGS.find((f) => f.flag === targetFlag);
    if (config && config.tip) {
      return config;
    }
  }

  return null;
};
