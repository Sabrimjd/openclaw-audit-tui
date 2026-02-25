import type { AuditEntry, MessageEntry, Session } from "../types";
import { colors, getEntryColor } from "../constants/colors";
import { getIconSet, isUsingNerdIcons } from "../constants/icons";
import { syntaxStyle } from "../constants/syntaxStyle";
import { getEntryIcon, formatDuration, getToolCategory } from "../lib/utils";
import { getTextContent, getToolCalls } from "../lib/parser";

function stringifyMaybe(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function extractDiffCandidate(args: Record<string, unknown>): { before: string; after: string; filetype: string } | null {
  const before =
    stringifyMaybe(args.oldText) ||
    stringifyMaybe(args.old_string) ||
    stringifyMaybe(args.before) ||
    stringifyMaybe(args.original) ||
    stringifyMaybe(args.previousContent);
  const after =
    stringifyMaybe(args.newText) ||
    stringifyMaybe(args.new_string) ||
    stringifyMaybe(args.after) ||
    stringifyMaybe(args.updated) ||
    stringifyMaybe(args.content);

  if (!before || !after || before === after) return null;
  const filePath = stringifyMaybe(args.filePath || args.file_path || args.path || args.target);
  const filetype = filePath.endsWith(".json") ? "json" : filePath.endsWith(".md") ? "markdown" : "text";
  return { before, after, filetype };
}

function buildUnifiedDiff(before: string, after: string): string {
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");
  const max = Math.max(beforeLines.length, afterLines.length);
  const lines: string[] = [
    "--- before",
    "+++ after",
    `@@ -1,${beforeLines.length} +1,${afterLines.length} @@`,
  ];

  for (let i = 0; i < max; i += 1) {
    const b = beforeLines[i];
    const a = afterLines[i];
    if (b === a) {
      if (b !== undefined) lines.push(` ${b}`);
      continue;
    }
    if (b !== undefined) lines.push(`-${b}`);
    if (a !== undefined) lines.push(`+${a}`);
  }

  return lines.join("\n");
}

const iconSet = getIconSet();
const ICON_LEGEND = `${iconSet.user}=User  ${iconSet.assistant}=Assistant  ${iconSet.toolResult}=Tool  ${iconSet.modelChange}=Model  ${iconSet.thinkingLevel}=Think${isUsingNerdIcons() ? "" : "  (ASCII fallback)"}`;
const ENTRY_WINDOW_SIZE = 260;
const ENTRY_WINDOW_RADIUS = Math.floor(ENTRY_WINDOW_SIZE / 2);

interface EntryViewerProps {
  session: Session;
  entries: AuditEntry[];
  selectedIndex: number;
  onSelectEntry: (index: number) => void;
  isFocused: boolean;
}

// Get content from a toolResult message
function getToolResultContent(entry: MessageEntry): string {
  if (entry.message.role !== "toolResult") return "";
  const content = entry.message.content;
  if (Array.isArray(content)) {
    return content
      .filter((b): b is { type: "text"; text: string } => b.type === "text")
      .map((b) => b.text)
      .join("\n");
  }
  return "";
}

function looksLikeJson(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed) return false;
  if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) return false;
  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}

function looksLikeMarkdown(content: string): boolean {
  const sample = content.trim();
  if (!sample) return false;
  return /(^#{1,6}\s)|(```)|(^\s*[-*+]\s)|(^\d+\.\s)|(\[[^\]]+\]\([^\)]+\))|(^>\s)/m.test(sample);
}

function toPrettyJson(content: string): string {
  try {
    return JSON.stringify(JSON.parse(content), null, 2);
  } catch {
    return content;
  }
}

function tokenizeJsonLine(line: string): Array<{ text: string; color: string }> {
  const tokenRegex = /("(?:\\.|[^"\\])*")(\s*:)?|\btrue\b|\bfalse\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[{}\[\],:]/g;
  const tokens: Array<{ text: string; color: string }> = [];
  let lastIndex = 0;

  for (const match of line.matchAll(tokenRegex)) {
    const idx = match.index ?? 0;
    if (idx > lastIndex) {
      tokens.push({ text: line.slice(lastIndex, idx), color: colors.textSecondary });
    }

    const token = match[0];
    let color = colors.textMuted;
    if (match[2]) {
      color = colors.accent;
    } else if (token.startsWith("\"")) {
      color = colors.success;
    } else if (token === "true" || token === "false") {
      color = colors.warning;
    } else if (token === "null") {
      color = colors.error;
    } else if (/^-?\d/.test(token)) {
      color = colors.info;
    } else if (/^[{}\[\],:]$/.test(token)) {
      color = colors.textDim;
    }

    tokens.push({ text: token, color });
    lastIndex = idx + token.length;
  }

  if (lastIndex < line.length) {
    tokens.push({ text: line.slice(lastIndex), color: colors.textSecondary });
  }

  return tokens.length > 0 ? tokens : [{ text: " ", color: colors.textSecondary }];
}

function RichJsonBlock({ content }: { content: string }) {
  const pretty = toPrettyJson(content);
  const lines = pretty.split("\n");

  return (
    <box flexDirection="column" border borderStyle="single" borderColor={colors.borderNormal} backgroundColor={colors.bgPrimary} padding={1}>
      {lines.map((line, i) => (
        <box key={i}>
          <text>
            {tokenizeJsonLine(line).map((token, j) => (
              <span key={`${i}-${j}`} fg={token.color}>{token.text}</span>
            ))}
          </text>
        </box>
      ))}
    </box>
  );
}

function EventTypeLabel({ entry }: { entry: AuditEntry }) {
  if (entry.type === "message") {
    if (entry.message.role === "user") {
      return <text><span fg={colors.roleUser}>message.user</span></text>;
    }
    if (entry.message.role === "assistant") {
      return <text><span fg={colors.roleAssistant}>message.assistant</span></text>;
    }
    const toolName = entry.message.toolName ?? "unknown";
    const category = getToolCategory(toolName);
    return <text><span fg={colors.roleTool}>{`message.toolResult(${category})`}</span></text>;
  }
  return <text><span fg={getEntryColor(entry)}>{entry.type}</span></text>;
}

function RichContent({ title, content }: { title: string; content: string }) {
  if (!content.trim()) return null;
  return (
    <box
      flexDirection="column"
      marginTop={1}
      border
      borderStyle="single"
      borderColor={colors.borderNormal}
      backgroundColor={colors.tableHeaderBg}
      padding={1}
    >
      <text><span fg={colors.warning}>{title}</span></text>
      <box marginTop={1}>
        {looksLikeJson(content) ? (
          <RichJsonBlock content={content} />
        ) : looksLikeMarkdown(content) ? (
          <markdown content={content} syntaxStyle={syntaxStyle} conceal={true} />
        ) : (
          <markdown content={content} syntaxStyle={syntaxStyle} />
        )}
      </box>
    </box>
  );
}

function EntryItem({
  entry,
  index,
  isSelected,
  isFocused,
  onClick,
}: {
  entry: AuditEntry;
  index: number;
  isSelected: boolean;
  isFocused: boolean;
  onClick: () => void;
}) {
  const icon = getEntryIcon(entry);
  const iconColor = getEntryColor(entry);
  let preview = "";

  if (entry.type === "message") {
    const msg = entry as MessageEntry;
    if (msg.message.role === "user") {
      const text = getTextContent(msg);
      preview = text.replace(/\n/g, " ");
    } else if (msg.message.role === "assistant") {
      const toolCalls = getToolCalls(msg);
      const text = getTextContent(msg);
      if (toolCalls.length > 0) {
        const names = toolCalls.map((t) => t.name).join(", ");
        preview = `[${names}]`;
      } else if (text) {
        preview = text.replace(/\n/g, " ");
      }
    } else if (msg.message.role === "toolResult") {
      const toolName = msg.message.toolName || "unknown";
      const category = getToolCategory(toolName);
      const status = msg.message.details?.status ?? "done";
      const duration = msg.message.details?.durationMs ? ` ${formatDuration(msg.message.details.durationMs)}` : "";
      preview = `[${category}] ${toolName} ${status}${duration}`;
    }
  } else if (entry.type === "model_change") {
    preview = `Model: ${(entry as any).modelId || "unknown"}`;
  } else if (entry.type === "session") {
    preview = `CWD: ${(entry as any).cwd || "unknown"}`;
  } else if (entry.type === "thinking_level_change") {
    preview = `Thinking: ${(entry as any).thinkingLevel}`;
  } else if (entry.type === "compaction") {
    preview = `Compaction: ${(entry as any).summary || ""}`;
  }

  const showColor = isSelected && isFocused ? colors.selectedFg : iconColor;

  return (
    <box
      height={1}
      paddingLeft={1}
      backgroundColor={isSelected && isFocused ? colors.selectedBg : "transparent"}
      onMouseDown={onClick}
    >
      <text><span fg={showColor}>{icon}</span> {preview}</text>
    </box>
  );
}

function EntryDetail({ entry }: { entry: AuditEntry | undefined }) {
  if (!entry) {
    return (
        <box flexGrow={1} alignItems="center" justifyContent="center">
        <text><span fg={colors.textMuted}>No entry selected</span></text>
      </box>
    );
  }

  if (entry.type === "message") {
    const msg = entry as MessageEntry;
    const textContent = getTextContent(msg);
    const toolResultContent = getToolResultContent(msg);
    const toolCalls = getToolCalls(msg);

    return (
      <scrollbox flexGrow={1} focused={false}>
        <box flexDirection="column" padding={1}>
          <box flexDirection="row" gap={2}>
            <text><span fg={colors.textMuted}>Type:</span></text>
            <EventTypeLabel entry={entry} />
          </box>
          <text><span fg={colors.textMuted}>{`ID: ${entry.id}`}</span></text>
          <text><span fg={colors.textMuted}>{`Time: ${new Date(entry.timestamp).toLocaleString()}`}</span></text>
          <text><span fg={colors.textMuted}>{`Role: ${msg.message.role}`}</span></text>

          {msg.message.role === "toolResult" && (
            <box flexDirection="column" marginTop={1}>
              <text><span fg={colors.warning}>TOOL RESULT</span></text>
              <text><span fg={colors.textPrimary}>{`Tool: ${msg.message.toolName ?? "unknown"}`}</span></text>
              <text><span fg={colors.textMuted}>{`Category: ${getToolCategory(msg.message.toolName ?? "unknown")}`}</span></text>
              {msg.message.details && (
                <text>
                  <span fg={msg.message.details.status === "completed" ? colors.success : colors.error}>
                    {`Status: ${msg.message.details.status}`}
                  </span>
                </text>
              )}
              {msg.message.details?.durationMs && (
                <text><span fg={colors.info}>{`Duration: ${formatDuration(msg.message.details.durationMs)}`}</span></text>
              )}
              {msg.message.details?.exitCode !== undefined && (
                <text>
                  <span fg={msg.message.details.exitCode === 0 ? colors.success : colors.error}>
                    {`Exit Code: ${msg.message.details.exitCode}`}
                  </span>
                </text>
              )}
              {msg.message.isError && <text><span fg={colors.error}>Error: true</span></text>}
            </box>
          )}

          {toolCalls.length > 0 && (
            <box flexDirection="column" marginTop={1}>
              <text><span fg={colors.warning}>TOOL CALLS</span></text>
              {toolCalls.map((tc) => (
                <box key={tc.id} flexDirection="column" marginTop={1}>
                  <text><span fg={colors.textPrimary}>{`Tool: ${tc.name}`}</span></text>
                  <text><span fg={colors.textMuted}>{`Category: ${getToolCategory(tc.name)}`}</span></text>
                  <RichJsonBlock content={JSON.stringify(tc.arguments, null, 2)} />
                  {(tc.name.toLowerCase().includes("edit") || tc.name.toLowerCase().includes("write")) && extractDiffCandidate(tc.arguments) && (
                    <box flexDirection="column" marginTop={1}>
                      <text><span fg={colors.warning}>FILE DIFF</span></text>
                      {(() => {
                        const diffCandidate = extractDiffCandidate(tc.arguments);
                        if (!diffCandidate) return null;
                        return (
                          <diff
                            diff={buildUnifiedDiff(diffCandidate.before, diffCandidate.after)}
                            view="split"
                            filetype={diffCandidate.filetype}
                            syntaxStyle={syntaxStyle}
                            showLineNumbers
                            addedBg="#153a2f"
                            removedBg="#4a1d24"
                            addedContentBg="#1f5d4c"
                            removedContentBg="#6f2a35"
                            contextBg="#162335"
                            addedSignColor="#86efac"
                            removedSignColor="#fca5a5"
                          />
                        );
                      })()}
                    </box>
                  )}
                </box>
              ))}
            </box>
          )}

          {msg.message.usage && (
            <box flexDirection="column" marginTop={1}>
              <text><span fg={colors.warning}>TOKENS</span></text>
              <text><span fg={colors.info}>{`Input: ${msg.message.usage.input.toLocaleString()}`}</span></text>
              <text><span fg={colors.success}>{`Output: ${msg.message.usage.output.toLocaleString()}`}</span></text>
              <text><span fg={colors.textPrimary}>{`Total: ${msg.message.usage.totalTokens.toLocaleString()}`}</span></text>
            </box>
          )}

          {msg.message.role === "toolResult" ? (
            <RichContent title="OUTPUT" content={toolResultContent} />
          ) : (
            <RichContent title="MESSAGE" content={textContent} />
          )}
        </box>
      </scrollbox>
    );
  }

  return (
    <scrollbox flexGrow={1} focused={false}>
      <box flexDirection="column" padding={1}>
        <box flexDirection="row" gap={2}>
          <text><span fg={colors.textMuted}>Type:</span></text>
          <EventTypeLabel entry={entry} />
        </box>
        <text><span fg={colors.textMuted}>{`ID: ${entry.id}`}</span></text>
        <text><span fg={colors.textMuted}>{`Time: ${new Date(entry.timestamp).toLocaleString()}`}</span></text>
        <box flexDirection="column" marginTop={1}>
          <text><span fg={colors.warning}>RAW JSON</span></text>
          <RichJsonBlock content={JSON.stringify(entry, null, 2)} />
        </box>
      </box>
    </scrollbox>
  );
}

export function EntryViewer({
  session,
  entries,
  selectedIndex,
  onSelectEntry,
  isFocused,
}: EntryViewerProps) {
  const selectedEntry = entries[selectedIndex];
  const focusIndicator = isFocused ? "[*]" : "[ ]";
  const headerText = `${focusIndicator} ${session.agentName} / ${session.id.slice(0, 8)} | Model: ${session.model} | Entries: ${entries.length}`;
  const userCount = entries.filter((e) => e.type === "message" && e.message.role === "user").length;
  const assistantCount = entries.filter((e) => e.type === "message" && e.message.role === "assistant").length;
  const toolCount = entries.filter((e) => e.type === "message" && e.message.role === "toolResult").length;
  const chunkSize = Math.max(1, Math.ceil(entries.length / 42));
  const mapTokens: string[] = [];
  for (let start = 0; start < entries.length; start += chunkSize) {
    const chunk = entries.slice(start, start + chunkSize);
    let u = 0;
    let a = 0;
    let t = 0;
    let s = 0;
    for (const entry of chunk) {
      if (entry.type !== "message") {
        s += 1;
      } else if (entry.message.role === "user") {
        u += 1;
      } else if (entry.message.role === "assistant") {
        a += 1;
      } else {
        t += 1;
      }
    }
    const max = Math.max(u, a, t, s);
    if (max === u) mapTokens.push("U");
    else if (max === a) mapTokens.push("A");
    else if (max === t) mapTokens.push("T");
    else mapTokens.push(".");
  }
  const conversationMap = mapTokens.join("");

  const start = Math.max(0, selectedIndex - ENTRY_WINDOW_RADIUS);
  const end = Math.min(entries.length, start + ENTRY_WINDOW_SIZE);
  const windowStart = Math.max(0, end - ENTRY_WINDOW_SIZE);
  const visibleEntries = entries.slice(windowStart, end);

  return (
    <box
      flexDirection="column"
      flexGrow={1}
      backgroundColor={colors.panelBg}
      border
      borderStyle="single"
      borderColor={isFocused ? colors.borderFocus : colors.borderNormal}
    >
      {/* Header with focus indicator */}
      <box
        flexDirection="row"
        height={1}
        paddingLeft={1}
        backgroundColor={isFocused ? colors.panelHeaderActive : colors.panelHeaderBg}
      >
        <text><span fg={isFocused ? colors.selectedFg : colors.textSecondary}>{headerText}</span></text>
      </box>
      <box
        flexDirection="row"
        height={1}
        paddingLeft={1}
        backgroundColor={colors.tableHeaderBg}
      >
        <text><span fg={colors.textMuted}>{`Turns U:${userCount} A:${assistantCount} T:${toolCount} | Flow (dominant by chunk): `}</span></text>
        <text><span fg={colors.accent}>{conversationMap}</span></text>
        <text><span fg={colors.textDim}>  [U=user A=assistant T=tool]</span></text>
      </box>

      {/* Main content - two columns */}
      <box flexDirection="row" flexGrow={1}>
        {/* Entry list */}
        <box
          flexDirection="column"
          width={55}
          borderStyle="single"
          borderColor={colors.borderNormal}
        >
          {/* Legend */}
          <box
            height={1}
            paddingLeft={1}
            backgroundColor={colors.tableHeaderBg}
          >
            <text><span fg={colors.textMuted}>{ICON_LEGEND}</span></text>
          </box>

          <scrollbox key={`entries-${windowStart}`} flexGrow={1} focused={false}>
            <box flexDirection="column">
              {visibleEntries.map((entry, index) => {
                const absoluteIndex = windowStart + index;
                return (
                <EntryItem
                  key={entry.id || absoluteIndex}
                  entry={entry}
                  index={absoluteIndex}
                  isSelected={absoluteIndex === selectedIndex}
                  isFocused={isFocused}
                  onClick={() => onSelectEntry(absoluteIndex)}
                />
                );
              })}
            </box>
          </scrollbox>
        </box>

        {/* Entry detail */}
        <box flexDirection="column" flexGrow={1}>
          <EntryDetail entry={selectedEntry} />
        </box>
      </box>
    </box>
  );
}
