/**
 * Steganographic utility for multi-line IRC message framing.
 * Uses zero-width Unicode characters to invisibly encode total expected line counts into the first line of code blocks.
 * Zero-width characters used:
 * - MAGIC_START / MAGIC_END: \uFEFF
 * - BIT_ZERO: \u200B
 * - BIT_ONE: \u200C
 * - BROKEN_MARKER: \u200D
 */

const MAGIC_START = "\uFEFF";
const MAGIC_END = "\uFEFF";
const BIT_ZERO = "\u200B";
const BIT_ONE = "\u200C";
const BROKEN_MARKER = "\u200D";

/**
 * Encodes total line count as invisible zero-width sequence to append to the header line (e.g. ```js).
 */
export function encodeLineCount(lineCount: number): string {
  if (lineCount <= 0) return "";
  const binary = lineCount.toString(2);
  let encodedBits = "";
  for (let i = 0; i < binary.length; i++) {
    encodedBits += binary[i] === "1" ? BIT_ONE : BIT_ZERO;
  }
  return `${MAGIC_START}${encodedBits}${MAGIC_END}`;
}

/**
 * Decodes zero-width line count from line text.
 * Returns decoded count and cleanText with hidden sequence removed, or null if no header present.
 */
export function decodeLineCount(text: string): { count: number; cleanText: string } | null {
  if (!text) return null;
  const startIdx = text.indexOf(MAGIC_START);
  if (startIdx === -1) return null;

  const endIdx = text.indexOf(MAGIC_END, startIdx + MAGIC_START.length);
  if (endIdx === -1) return null;

  const bitsSequence = text.substring(startIdx + MAGIC_START.length, endIdx);
  let binaryStr = "";
  for (let i = 0; i < bitsSequence.length; i++) {
    const char = bitsSequence[i];
    if (char === BIT_ONE) {
      binaryStr += "1";
    } else if (char === BIT_ZERO) {
      binaryStr += "0";
    } else {
      // Invalid char inside magic wrapper
      return null;
    }
  }

  if (!binaryStr) return null;
  const count = parseInt(binaryStr, 2);
  if (isNaN(count) || count <= 0) return null;

  const cleanText = text.substring(0, startIdx) + text.substring(endIdx + MAGIC_END.length);
  return { count, cleanText };
}

/**
 * Strips all zero-width steganographic markers from text.
 */
export function stripSteganography(text: string): string {
  if (!text) return text;
  return text
    .replace(new RegExp(`${MAGIC_START}[${BIT_ZERO}${BIT_ONE}]*${MAGIC_END}`, "g"), "")
    .replace(new RegExp(BROKEN_MARKER, "g"), "");
}

/**
 * Marks a line as a broken/corrupted code block header line (e.g., when a discrepancy or timeout occurs).
 * Appends BROKEN_MARKER zero-width character.
 */
export function markAsBrokenHeader(text: string): string {
  const clean = stripSteganography(text);
  return `${clean}${BROKEN_MARKER}`;
}

/**
 * Checks whether a line was marked as a broken code block header line.
 */
export function isBrokenHeader(text: string): boolean {
  if (!text) return false;
  return text.includes(BROKEN_MARKER);
}
