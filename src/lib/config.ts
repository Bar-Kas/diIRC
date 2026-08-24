/**
 * Message Deduplication Mode configuration:
 * - "A": Deduplicate strictly only system messages (isSystem: true) within a 3-second window. Regular user messages are never deduplicated.
 * - "B": Deduplication is completely disabled for all messages (both system and user messages).
 */
export type MessageDeduplicationMode = "A" | "B";

export const MESSAGE_DEDUPLICATION_MODE: MessageDeduplicationMode = "A";
