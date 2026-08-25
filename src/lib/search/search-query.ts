import { addDays, format, parse, startOfDay, subDays, subSeconds } from "date-fns";

/**
 * Discord-style search query parser.
 *
 * Grammar (tokens separated by whitespace, quotes group words):
 *   plain word            → required term
 *   "exact phrase"        → required phrase
 *   -word / -"phrase"     → excluded term/phrase
 *   from:user             → sender filter (leading `@` stripped)
 *   mentions:user         → content mentions the nick (substring)
 *   has:link|file|embed   → content contains a URL
 *   has:image|video       → URL token with a known media extension
 *   before:date           → messages strictly older than that whole day
 *   after:date            → messages strictly newer than that whole day
 *   during:date           → messages sent on that day
 *   in:#channel, pinned:  → recognized but ignored in phase 1 (single-chat scope)
 *
 * Accepted date formats: `2026-08-20`, `20.08.2026`, `august 20`, `20 august`,
 * plus relative keywords `today` / `yesterday`.
 */

export interface SearchChip {
  /** Stable chip kind used for rendering/removal. */
  type:
    | "from"
    | "mentions"
    | "before"
    | "after"
    | "during"
    | "regex"
    /** Plain required word. */
    | "text"
    /** Quoted required phrase. */
    | "phrase"
    /** Negated word/phrase (`-x`). */
    | "exclude";
  /** Display value (e.g. `Kowalski`, `image`, `2026-08-20`). */
  value: string;
  /** Original raw token so chips can be removed from the query string. */
  token: string;
}

export interface SearchCriteria {
  terms: string[];
  phrases: string[];
  excludeTerms: string[];
  excludePhrases: string[];
  sender?: string;
  mention?: string;
  /** Inclusive lower bound `YYYY-MM-DD HH:MM:SS` (local log time). */
  after?: string;
  /** Inclusive upper bound `YYYY-MM-DD HH:MM:SS` (local log time). */
  before?: string;
  /** `/pattern/` regex literals the content must match (patterns carry inline `(?i)`). */
  regexes: string[];
  /** Negated `/pattern/` literals (`-/pattern/i`). */
  excludeRegexes: string[];
}

export interface ParsedSearchQuery {
  criteria: SearchCriteria;
  chips: SearchChip[];
}

export const SEARCH_LOG_TIME_FORMAT = "yyyy-MM-dd HH:mm:ss";

const LOG_BOUNDARY_START = "00:00:00";
const LOG_BOUNDARY_END = "23:59:59";

interface QueryToken {
  text: string;
  quoted: boolean;
  negated: boolean;
  /** Inner pattern for `/regex/` literals (slashes stripped). */
  regexPattern?: string;
  /** Trailing flags captured after the closing slash (subset of `[i]`; `(?i)` is forced anyway). */
  regexFlags?: string;
  /** Original raw match (incl. `-` prefix / quotes) — used for chip removal. */
  raw?: string;
}

/** Splits the raw query into tokens while preserving quoted segments. */
export function tokenizeSearchQuery(rawQuery: string): QueryToken[] {
  const tokens: QueryToken[] = [];
  // Regex literals (`/pattern/i`, optionally negated `-/pattern/i`) come FIRST so their
  // inner spaces stay atomic. The `^|whitespace` lookbehind keeps them anchored to token
  // starts, so plain URLs (`https://host/path`) never match mid-word and stay terms.
  const pattern =
    /(?:^|(?<=\s))-?\/([^/\s]+(?: [^/\s]+)*?)\/([a-z]*)|-?"([^"]*)"|-?(\S+)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(rawQuery)) !== null) {
    if (match[1] !== undefined && match[2] !== undefined) {
      const isNegated = match[0].startsWith("-");
      if (match[1].trim()) {
        tokens.push({
          text: match[0],
          quoted: false,
          negated: isNegated,
          regexPattern: match[1],
          regexFlags: match[2],
          raw: match[0],
        });
      }
    } else if (match[3] !== undefined) {
      const isNegated = match[0].startsWith("-");
      if (match[3].trim()) {
        tokens.push({ text: match[3], quoted: true, negated: isNegated, raw: match[0] });
      }
    } else if (match[4] !== undefined) {
      // NOTE: `negated` must come from the raw match — `-word` previously lost its
      // dash here and silently became a REQUIRED term instead of an exclusion.
      tokens.push({
        text: match[4],
        quoted: false,
        negated: match[0].startsWith("-"),
        raw: match[0],
      });
    }
  }
  return tokens;
}



/** Parses a human date into day-start; returns null when unparseable. */
function parseFilterDate(value: string): Date | null {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  if (trimmed === "today") return startOfDay(new Date());
  if (trimmed === "yesterday") return startOfDay(subDays(new Date(), 1));

  const formats = ["yyyy-MM-dd", "dd.MM.yyyy", "MMMM d", "d MMMM", "yyyy/MM/dd"];
  for (const fmt of formats) {
    try {
      const parsed = parse(trimmed, fmt, new Date());
      if (!Number.isNaN(parsed.getTime())) {
        return startOfDay(parsed);
      }
    } catch {
      // try next format
    }
  }

  const fallback = new Date(trimmed);
  return Number.isNaN(fallback.getTime()) ? null : startOfDay(fallback);
}

const toLogStamp = (dayStart: Date, boundary: string) =>
  `${format(dayStart, "yyyy-MM-dd")} ${boundary}`;

/**
 * Parses the raw query string into structured criteria + display chips.
 * Never throws — unknown operators degrade gracefully.
 */
export function parseSearchQuery(rawQuery: string): ParsedSearchQuery {
  const criteria: SearchCriteria = {
    terms: [],
    phrases: [],
    excludeTerms: [],
    excludePhrases: [],
    regexes: [],
    excludeRegexes: [],
  };
  const chips: SearchChip[] = [];

  let afterBound: string | null = null;
  let beforeBound: string | null = null;

  for (const token of tokenizeSearchQuery(rawQuery)) {
    const lower = token.text.toLowerCase();

    // Regex literals (`/pattern/i`, `-/pattern/i`) are handled before the generic
    // negation branch so excluded regexes don't land in excludePhrases.
    if (token.regexPattern !== undefined) {
      try {
        // Validation only — the stored pattern keeps its inline flag for Rust.
        // eslint-disable-next-line no-new
        new RegExp(token.regexPattern);
      } catch {
        console.warn(`Invalid search regex ignored: /${token.regexPattern}/`);
        continue;
      }
      const stored = `${"(?i)"}${token.regexPattern}`;
      if (token.negated) {
        criteria.excludeRegexes.push(stored);
      } else {
        criteria.regexes.push(stored);
      }
      chips.push({ type: "regex", value: `/${token.regexPattern}/`, token: token.raw ?? token.text });
      continue;
    }

    if (token.negated) {
      if (token.quoted) {
        criteria.excludePhrases.push(lower);
        chips.push({ type: "exclude", value: token.raw ?? token.text, token: token.raw ?? token.text });
      } else {
        criteria.excludeTerms.push(lower);
        chips.push({ type: "exclude", value: token.raw ?? token.text, token: token.raw ?? token.text });
      }
      continue;
    }

    if (!token.quoted && lower.includes(":")) {
      const separatorIndex = lower.indexOf(":");
      const key = lower.slice(0, separatorIndex);
      const value = token.text.slice(separatorIndex + 1).trim();
      const valueLower = value.toLowerCase();
      const bareValue = value.replace(/^@/, "");

      switch (key) {
        case "from": {
          // Bare `from:` is skipped so the autocomplete can complete it first.
          // Mutually exclusive: a second `from:` REPLACES the previous one.
          if (bareValue) {
            if (criteria.sender) {
              const stale = chips.findIndex((chip) => chip.type === "from");
              if (stale !== -1) chips.splice(stale, 1);
            }
            criteria.sender = bareValue;
            chips.push({ type: "from", value: bareValue, token: token.text });
          }
          break;
        }
        case "mentions": {
          if (bareValue) {
            if (criteria.mention) {
              const stale = chips.findIndex((chip) => chip.type === "mentions");
              if (stale !== -1) chips.splice(stale, 1);
            }
            criteria.mention = bareValue;
            chips.push({ type: "mentions", value: bareValue, token: token.text });
          }
          break;
        }
        case "before":
        case "after":
        case "during": {
          const day = parseFilterDate(value);
          if (!day) break;
          if (key === "during") {
            // `during:` is mutually exclusive with `before:` and `after:`.
            // Clear any prior before/after chips and bounds.
            for (let i = chips.length - 1; i >= 0; i--) {
              if (
                chips[i].type === "before" ||
                chips[i].type === "after" ||
                chips[i].type === "during"
              ) {
                chips.splice(i, 1);
              }
            }
            afterBound = toLogStamp(day, LOG_BOUNDARY_START);
            beforeBound = toLogStamp(day, LOG_BOUNDARY_END);
          } else {
            // `before:` or `after:` removes any prior `during:` chip and same-type chip.
            for (let i = chips.length - 1; i >= 0; i--) {
              if (chips[i].type === "during" || chips[i].type === key) {
                chips.splice(i, 1);
              }
            }
            if (key === "before") {
              beforeBound = toLogStamp(subSeconds(day, 1), LOG_BOUNDARY_END);
            } else if (key === "after") {
              afterBound = toLogStamp(addDays(day, 1), LOG_BOUNDARY_START);
            }
          }
          chips.push({
            type: key as SearchChip["type"],
            value: format(day, "yyyy-MM-dd"),
            token: token.text,
          });
          break;
        }
        default:
          // Unknown `key:value` (e.g. `in:#channel`, `pinned:true`) — treat the
          // whole token as a plain required term instead of dropping it silently.
          criteria.terms.push(lower);
          chips.push({ type: "text", value: token.text, token: token.raw ?? token.text });
          break;
      }
      continue;
    }

    if (token.quoted) {
      criteria.phrases.push(lower);
      // Plain terms/phrases get chips too — otherwise they act as INVISIBLE
      // filters (e.g. a stray `**` silently narrowing the results).
      chips.push({ type: "phrase", value: token.raw ?? `"${token.text}"`, token: token.raw ?? token.text });
    } else {
      criteria.terms.push(lower);
      chips.push({ type: "text", value: token.text, token: token.raw ?? token.text });
    }
  }

  if (afterBound) criteria.after = afterBound;
  if (beforeBound) criteria.before = beforeBound;

  return { criteria, chips };
}

/** True when the query carries nothing searchable (avoids pointless full-log scans). */
export function isEmptyCriteria(criteria: SearchCriteria): boolean {
  return (
    criteria.terms.length === 0 &&
    criteria.phrases.length === 0 &&
    criteria.excludeTerms.length === 0 &&
    criteria.excludePhrases.length === 0 &&
    criteria.regexes.length === 0 &&
    criteria.excludeRegexes.length === 0 &&
    !criteria.sender &&
    !criteria.mention &&
    !criteria.after &&
    !criteria.before
  );
}

/** Removes one chip's original token from the query string (whitespace-safe). */
export function removeChipFromQuery(rawQuery: string, token: string): string {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Preferred: token standing alone (start/space-delimited).
  const bounded = new RegExp(`(?:^|\\s)${escaped}(?=\\s|$)`);
  if (bounded.test(rawQuery)) {
    return rawQuery.replace(bounded, "").trim();
  }
  // Fallback: token glued to punctuation (e.g. the `**` in `/test/**`) —
  // remove its first literal occurrence.
  return rawQuery
    .replace(new RegExp(escaped), "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export interface HighlightRange {
  start: number;
  end: number;
}

/**
 * Case-insensitive highlight ranges for matched terms/phrases inside a hit's content.
 * Overlapping ranges are merged; used by the results panel to render `<mark>`s without
 * dangerouslySetInnerHTML.
 */
export function getHighlightRanges(content: string, parsed: ParsedSearchQuery): HighlightRange[] {
  const needles = [...parsed.criteria.terms, ...parsed.criteria.phrases]
    .filter((needle) => needle.length > 0)
    .sort((a, b) => b.length - a.length);
  if (needles.length === 0 && parsed.criteria.regexes.length === 0) return [];

  const lowerContent = content.toLowerCase();
  const ranges: HighlightRange[] = [];
  for (const needle of needles) {
    let fromIndex = 0;
    let index = lowerContent.indexOf(needle, fromIndex);
    while (index !== -1) {
      ranges.push({ start: index, end: index + needle.length });
      fromIndex = index + needle.length;
      index = lowerContent.indexOf(needle, fromIndex);
    }
  }

  // Regex literal matches also highlight. Stored patterns carry Rust's inline `(?i)`
  // flag which JS RegExp doesn't understand — strip it and pass the `i` flag instead.
  for (const patternSource of parsed.criteria.regexes) {
    try {
      const jsSource = patternSource.replace(/\(\?i\)/g, "");
      const regex = new RegExp(jsSource, "gi");
      let match: RegExpExecArray | null;
      let collected = 0;
      while ((match = regex.exec(content)) !== null && collected < 100) {
        if (match[0].length === 0) {
          // Zero-length match — force progress to avoid an infinite loop.
          regex.lastIndex += 1;
          continue;
        }
        ranges.push({ start: match.index, end: match.index + match[0].length });
        collected += 1;
      }
    } catch {
      // Invalid stored pattern — skip highlighting for it.
    }
  }

  ranges.sort((a, b) => a.start - b.start);
  const merged: HighlightRange[] = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) {
      last.end = Math.max(last.end, range.end);
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Escapes a literal needle for safe embedding into a RegExp. Re-exported for UI use. */
export const escapeSearchText = escapeRegExp;
