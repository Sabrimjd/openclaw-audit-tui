import type {
  AuditEntry,
  SessionEntry,
  ModelChangeEntry,
  ThinkingLevelChangeEntry,
  CustomEntry,
  MessageEntry,
  CompactionEntry,
  ContentBlock,
} from "../types";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeBase(raw: Record<string, unknown>) {
  return {
    id: asString(raw.id),
    parentId: raw.parentId === null || typeof raw.parentId === "string" ? raw.parentId : null,
    timestamp: asString(raw.timestamp),
  };
}

// Parse a single JSONL line into an AuditEntry
export function parseEntry(line: string): AuditEntry | null {
  if (!line.trim()) return null;

  try {
    const raw = JSON.parse(line);
    return discriminateEntry(raw);
  } catch {
    console.error(`Failed to parse line: ${line.slice(0, 100)}...`);
    return null;
  }
}

// Discriminate entry type based on the type field
function discriminateEntry(raw: Record<string, unknown>): AuditEntry | null {
  const type = asString(raw.type);
  const base = normalizeBase(raw);

  switch (type) {
    case "session":
      return {
        type: "session",
        id: base.id,
        parentId: base.parentId,
        timestamp: base.timestamp,
        version: typeof raw.version === "number" ? raw.version : 0,
        cwd: asString(raw.cwd),
      } satisfies SessionEntry;
    case "model_change":
      return {
        type: "model_change",
        id: base.id,
        parentId: base.parentId,
        timestamp: base.timestamp,
        provider: asString(raw.provider),
        modelId: asString(raw.modelId),
      } satisfies ModelChangeEntry;
    case "thinking_level_change":
      return {
        type: "thinking_level_change",
        id: base.id,
        parentId: base.parentId,
        timestamp: base.timestamp,
        thinkingLevel:
          raw.thinkingLevel === "off" || raw.thinkingLevel === "low" || raw.thinkingLevel === "medium" || raw.thinkingLevel === "high"
            ? raw.thinkingLevel
            : "off",
      } satisfies ThinkingLevelChangeEntry;
    case "custom":
      return {
        type: "custom",
        id: base.id,
        parentId: base.parentId,
        timestamp: base.timestamp,
        customType: asString(raw.customType),
        data: asRecord(raw.data) ?? {},
      } satisfies CustomEntry;
    case "compaction":
      return {
        type: "compaction",
        id: base.id,
        parentId: base.parentId,
        timestamp: base.timestamp,
        summary: asString(raw.summary),
        firstKeptEntryId: asString(raw.firstKeptEntryId),
        tokensBefore: typeof raw.tokensBefore === "number" ? raw.tokensBefore : 0,
      } satisfies CompactionEntry;
    case "message":
      return parseMessageEntry(raw);
    default:
      return null;
  }
}

// Parse message entry with content blocks
function parseMessageEntry(raw: Record<string, unknown>): MessageEntry {
  const base = normalizeBase(raw);
  const message = asRecord(raw.message) ?? {};
  const roleRaw = asString(message.role);
  const role: "user" | "assistant" | "toolResult" =
    roleRaw === "assistant" || roleRaw === "toolResult" ? roleRaw : "user";

  const contentRaw = Array.isArray(message.content) ? message.content : [];
  const content = contentRaw
    .map((block) => asRecord(block))
    .filter((block): block is Record<string, unknown> => block !== null)
    .map(parseContentBlock);

  const entry: MessageEntry = {
    type: "message",
    id: base.id,
    parentId: base.parentId,
    timestamp: base.timestamp,
    message: {
      role,
      content,
      api: asString(message.api) || undefined,
      provider: asString(message.provider) || undefined,
      model: asString(message.model) || undefined,
      stopReason: asString(message.stopReason) || undefined,
      toolCallId: asString(message.toolCallId) || undefined,
      toolName: asString(message.toolName) || undefined,
      details: asRecord(message.details)
        ? {
            status:
              message.details &&
              (message.details as Record<string, unknown>).status &&
              (["completed", "error", "running"] as const).includes((message.details as Record<string, unknown>).status as "completed" | "error" | "running")
                ? ((message.details as Record<string, unknown>).status as "completed" | "error" | "running")
                : "completed",
            exitCode:
              typeof (message.details as Record<string, unknown>).exitCode === "number"
                ? ((message.details as Record<string, unknown>).exitCode as number)
                : undefined,
            durationMs:
              typeof (message.details as Record<string, unknown>).durationMs === "number"
                ? ((message.details as Record<string, unknown>).durationMs as number)
                : undefined,
          }
        : undefined,
      isError: Boolean(message.isError),
      usage: asRecord(message.usage)
        ? {
            input: typeof (message.usage as Record<string, unknown>).input === "number" ? ((message.usage as Record<string, unknown>).input as number) : 0,
            output: typeof (message.usage as Record<string, unknown>).output === "number" ? ((message.usage as Record<string, unknown>).output as number) : 0,
            cacheRead:
              typeof (message.usage as Record<string, unknown>).cacheRead === "number"
                ? ((message.usage as Record<string, unknown>).cacheRead as number)
                : 0,
            cacheWrite:
              typeof (message.usage as Record<string, unknown>).cacheWrite === "number"
                ? ((message.usage as Record<string, unknown>).cacheWrite as number)
                : 0,
            totalTokens:
              typeof (message.usage as Record<string, unknown>).totalTokens === "number"
                ? ((message.usage as Record<string, unknown>).totalTokens as number)
                : 0,
          }
        : undefined,
    },
  };

  return entry;
}

// Parse a content block
function parseContentBlock(block: Record<string, unknown>): ContentBlock {
  const type = asString(block.type);
  if (type === "text") {
    return { type: "text", text: asString(block.text) };
  }
  if (type === "thinking") {
    return { type: "thinking", text: asString(block.text) };
  }
  if (type === "toolCall") {
    return {
      type: "toolCall",
      id: asString(block.id),
      name: asString(block.name),
      arguments: asRecord(block.arguments) ?? {},
    };
  }
  if (type === "image") {
    return { type: "image", source: block.source };
  }
  return { type: "text", text: "" };
}

// Parse all entries from a JSONL file content
export function parseJsonlContent(content: string): AuditEntry[] {
  const lines = content.split("\n");
  const entries: AuditEntry[] = [];

  for (const line of lines) {
    const entry = parseEntry(line);
    if (entry) {
      entries.push(entry);
    }
  }

  return entries;
}

// Extract tool names from an assistant message
export function extractToolNames(entry: MessageEntry): string[] {
  if (entry.message.role !== "assistant") return [];

  return entry.message.content
    .filter((block): block is { type: "toolCall"; id: string; name: string; arguments: Record<string, unknown> } => block.type === "toolCall")
    .map((block) => block.name);
}

// Check if an entry has tool calls
export function hasToolCalls(entry: MessageEntry): boolean {
  if (entry.message.role !== "assistant") return false;
  return entry.message.content.some((block) => block.type === "toolCall");
}

// Get text content from a message
export function getTextContent(entry: MessageEntry): string {
  return entry.message.content
    .filter((block): block is { type: "text"; text: string } => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

// Get thinking content from a message
export function getThinkingContent(entry: MessageEntry): string {
  return entry.message.content
    .filter((block): block is { type: "thinking"; text: string } => block.type === "thinking")
    .map((block) => block.text)
    .join("\n");
}

// Get tool calls from a message
export function getToolCalls(entry: MessageEntry): Array<{ id: string; name: string; arguments: Record<string, unknown> }> {
  if (entry.message.role !== "assistant") return [];

  return entry.message.content
    .filter((block): block is { type: "toolCall"; id: string; name: string; arguments: Record<string, unknown> } => block.type === "toolCall")
    .map((block) => ({ id: block.id, name: block.name, arguments: block.arguments }));
}
