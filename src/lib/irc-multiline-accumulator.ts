import { decodeLineCount, markAsBrokenHeader } from "./markdown/multiline-steganography";

export interface PendingStream {
  expectedLines: number;
  lines: string[];
  timer: any;
  serverId: string;
  target: string;
  sender: string;
}

export type MessageFlushCallback = (
  serverId: string,
  target: string,
  sender: string,
  lines: string[],
  isValidCodeBlock: boolean
) => void;

export class IrcMultilineAccumulator {
  private streams: Map<string, PendingStream> = new Map();
  private onFlush: MessageFlushCallback;

  constructor(onFlush: MessageFlushCallback) {
    this.onFlush = onFlush;
  }

  private getKey(serverId: string, target: string, sender: string): string {
    return `${serverId}:${target.toLowerCase()}:${sender.toLowerCase()}`;
  }

  public processLine(serverId: string, target: string, sender: string, content: string): boolean {
    const key = this.getKey(serverId, target, sender);
    const existing = this.streams.get(key);

    const decoded = decodeLineCount(content);

    if (decoded) {
      // Line contains zero-width line count metadata
      if (existing) {
        // Flush previous stream as broken before starting new one
        this.flushStream(key, false);
      }

      // Start new stream timer
      const timer = setTimeout(() => {
        this.flushStream(key, false);
      }, 3500);

      this.streams.set(key, {
        expectedLines: decoded.count,
        lines: [decoded.cleanText],
        timer,
        serverId,
        target,
        sender,
      });

      // If declared count is 1 line, evaluate immediately
      if (decoded.count === 1) {
        const stream = this.streams.get(key)!;
        const lastLineClean = stream.lines[0].trim();
        const isValid = lastLineClean.startsWith("```") && lastLineClean.endsWith("```") && lastLineClean.length > 3;
        this.flushStream(key, isValid);
      }

      return true;
    }

    if (existing) {
      clearTimeout(existing.timer);
      existing.lines.push(content);

      if (existing.lines.length >= existing.expectedLines) {
        const lastLineClean = existing.lines[existing.lines.length - 1].trim();
        const isValid = lastLineClean.endsWith("```");
        this.flushStream(key, isValid);
      } else {
        existing.timer = setTimeout(() => {
          this.flushStream(key, false);
        }, 3500);
      }

      return true;
    }

    return false;
  }

  private flushStream(key: string, isValid: boolean) {
    const stream = this.streams.get(key);
    if (!stream) return;

    clearTimeout(stream.timer);
    this.streams.delete(key);

    if (isValid) {
      this.onFlush(stream.serverId, stream.target, stream.sender, stream.lines, true);
    } else {
      // Discrepancy / Broken stream! Mark line 0 with broken marker
      const modifiedLines = [...stream.lines];
      if (modifiedLines.length > 0 && modifiedLines[0].trim().startsWith("```")) {
        modifiedLines[0] = markAsBrokenHeader(modifiedLines[0]);
      }
      this.onFlush(stream.serverId, stream.target, stream.sender, modifiedLines, false);
    }
  }

  public clearAll() {
    this.streams.forEach((stream) => clearTimeout(stream.timer));
    this.streams.clear();
  }
}
