import { BufferKind, BufferKey, BufferRef } from "@/types";

export const getBufferKey = (
  serverId: string,
  kind: BufferKind,
  id: string,
): BufferKey => `${serverId}:${kind}:${id}`;

export const getChannelBuffer = (
  serverId: string,
  channelId: string,
  target: string,
): BufferRef => ({
  key: getBufferKey(serverId, "channel", channelId),
  serverId,
  kind: "channel",
  id: channelId,
  target,
});

export const getConversationBuffer = (
  serverId: string,
  conversationId: string,
  target: string,
): BufferRef => ({
  key: getBufferKey(serverId, "conversation", conversationId),
  serverId,
  kind: "conversation",
  id: conversationId,
  target,
});
