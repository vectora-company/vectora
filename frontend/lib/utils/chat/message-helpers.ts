/**
 * Message Creation and Manipulation Utilities
 *
 * Functions for creating and updating messages in chat conversations.
 */

import type { Message } from "../../types";
import type { HistoryMessage, HistoryPart } from "../../api/vectora-client";
import { buildToolCall, parseToolOutput } from "./tool-call";

// ============================================================================
// Message ID Generation
// ============================================================================

let messageIdCounter = 0;

/**
 * Generate a unique message ID.
 * Uses timestamp + counter to ensure uniqueness even for rapid message creation.
 */
export const generateMessageId = (): string => {
  const timestamp = Date.now();
  const counter = messageIdCounter++;
  return `${timestamp}-${counter}`;
};

// ============================================================================
// Message Creation
// ============================================================================

/**
 * Create a new user message.
 */
export const createUserMessage = (content: string): Message => ({
  id: generateMessageId(),
  role: "user",
  content,
  timestamp: new Date(),
});

// ============================================================================
// Message List Manipulation
// ============================================================================

/**
 * Update a specific message in a message list.
 * Returns a new array with the updated message.
 */
export const updateMessageInList = (
  messages: Message[],
  messageId: string,
  updates: Partial<Message> | ((m: Message) => Partial<Message>),
): Message[] => {
  return messages.map((m) => {
    if (m.id !== messageId) return m;
    const patch = typeof updates === "function" ? updates(m) : updates;
    return { ...m, ...patch };
  });
};

/**
 * Ensure a message exists in the list.
 * If the message doesn't exist, appends it to the end.
 */
export const ensureMessageExists = (
  messages: Message[],
  messageId: string,
  baseMessage: Message,
): Message[] => {
  const existing = messages.find((m) => m.id === messageId);
  return existing ? messages : [...messages, baseMessage];
};

// ============================================================================
// History Conversion
// ============================================================================

/**
 * Convert one `HistoryMessage` (REST history page) into a UI `Message`.
 *
 * Non-image attachments always carry over as file cards. Image attachments
 * only carry over when `url` is populated — that's the
 * persisted file path (`GET /threads/{id}/attachments/{filename}`), the
 * only thing that survives a backend restart. Attachments without a URL
 * (persistence failed, or messages from before this field existed) drop
 * silently; the turn's text is still shown.
 */
/** Reconstrói raciocínio e tool calls a partir das partes persistidas. */
const historyPartsToMessageFields = (
  parts: HistoryPart[] | undefined,
): Pick<Message, "reasoning" | "toolCalls"> => {
  if (!parts?.length) return {};
  const reasoning = parts
    .flatMap((part) => (part.kind === "reasoning" ? [part.text] : []))
    .join("");
  const toolCalls = parts.flatMap((part) => {
    if (part.kind !== "tool_call") return [];
    const call = buildToolCall({
      id: part.tool_call_id,
      name: part.tool_name,
      argsJson: part.args_json,
      renderHint: part.render_hint,
      category: part.category,
      destructive: part.destructive,
      icon: part.icon,
    });
    if (part.result_json != null) {
      call.output = parseToolOutput(part.result_json);
      call.isError = part.is_error === true;
    }
    return [call];
  });
  return {
    ...(reasoning ? { reasoning } : {}),
    ...(toolCalls.length ? { toolCalls } : {}),
  };
};

export const historyMessageToMessage = (
  hist: HistoryMessage,
  id: string,
): Message => {
  // Imagens só voltam com URL (é o que sobrevive a restart). Os demais
  // anexos (documento, áudio, vídeo, arquivo) voltam como cartão com nome,
  // tipo e tamanho, com link quando o asset existe.
  const images = hist.attachments
    ?.filter((att) => att.kind !== "image" || Boolean(att.url))
    .map((att, index) => ({
      id: (att.url as string | undefined) ?? `${id}:attachment:${index}`,
      url: (att.url as string | undefined) ?? "",
      mimeType: att.mimeType,
      name: att.name,
      size: att.size,
    }));

  return {
    id,
    ...(hist.message_id !== undefined
      ? { persistedMessageId: hist.message_id }
      : {}),
    role: hist.role === "human" ? "user" : "assistant",
    content: hist.content,
    timestamp: hist.created_at ? new Date(hist.created_at) : new Date(),
    checkpointId: hist.checkpoint_id,
    ...(hist.is_error === true ? { isError: true } : {}),
    ...historyPartsToMessageFields(hist.parts),
    ...(hist.verification
      ? {
          verification: {
            status: hist.verification.status,
            outcome: hist.verification.outcome,
            detail: hist.verification.detail ?? "",
          },
        }
      : {}),
    ...(images?.length ? { images } : {}),
    ...(hist.edited_files?.length
      ? {
          editedFiles: hist.edited_files.map((file) => ({
            path: file.path,
            status: file.status,
            additions: file.additions,
            deletions: file.deletions,
            hunks: file.hunks,
          })),
        }
      : {}),
  } as Message;
};
