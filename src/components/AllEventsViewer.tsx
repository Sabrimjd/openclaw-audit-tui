import type { AuditEntry, GlobalEventEntry, MessageEntry } from "../types";
import { useMemo } from "react";
import { colors, getEntryColor } from "../constants/colors";
import { syntaxStyle } from "../constants/syntaxStyle";
import { getEntryIcon, formatDuration, getToolCategory } from "../lib/utils";
import { getTextContent, getToolCalls } from "../lib/parser";

interface AllEventsViewerProps {
  events: GlobalEventEntry[];
  selectedIndex: number;
  onSelectEvent: (index: number) => void;
  isFocused: boolean;
  isLoading?: boolean;
  histogramBuckets?: number;
  scopeLabel?: string;
}

const WINDOW_SIZE = 320;
const WINDOW_RADIUS = Math.floor(WINDOW_SIZE / 2);
const SPARK_CHARS = [" ", "▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];
const SPARK_DISPLAY_WIDTH = 96;

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "now";
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHour < 24) return `${diffHour}h`;
  if (diffDay < 7) return `${diffDay}d`;
  return date.toLocaleDateString();
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

function formatAxisTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function buildHistogram(events: GlobalEventEntry[], histogramBuckets: number) {
  const bucketCount = Math.max(8, histogramBuckets);
  if (events.length === 0) {
    return {
      counts: Array.from({ length: bucketCount }, () => 0),
      startLabel: "--:--",
      endLabel: "--:--",
      maxCount: 0,
    };
  }

  let minTs = Number.POSITIVE_INFINITY;
  let maxTs = Number.NEGATIVE_INFINITY;
  const timestamps = events.map((e) => new Date(e.entry.timestamp).getTime());
  for (const ts of timestamps) {
    if (ts < minTs) minTs = ts;
    if (ts > maxTs) maxTs = ts;
  }

  const range = Math.max(maxTs - minTs, 1);
  const counts = Array.from({ length: bucketCount }, () => 0);
  for (const ts of timestamps) {
    const normalized = (ts - minTs) / range;
    const bucket = Math.min(bucketCount - 1, Math.floor(normalized * bucketCount));
    counts[bucket] = (counts[bucket] ?? 0) + 1;
  }

  let maxCount = 0;
  for (const c of counts) {
    if (c > maxCount) maxCount = c;
  }

  return {
    counts,
    startLabel: formatAxisTime(minTs),
    endLabel: formatAxisTime(maxTs),
    maxCount,
  };
}

function expandHistogramForDisplay(counts: number[], width: number): number[] {
  if (counts.length === 0 || width <= 0) return [];
  if (counts.length === width) return counts;

  const expanded: number[] = [];
  for (let i = 0; i < width; i += 1) {
    const start = Math.floor((i / width) * counts.length);
    const end = Math.max(start + 1, Math.floor(((i + 1) / width) * counts.length));
    let maxVal = 0;
    for (let j = start; j < end; j += 1) {
      const value = counts[j] ?? 0;
      if (value > maxVal) maxVal = value;
    }
    expanded.push(maxVal);
  }
  return expanded;
}

function getToolResultContent(entry: MessageEntry): string {
  if (entry.message.role !== "toolResult") return "";
  return entry.message.content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

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

function getEventTypeLabel(entry: AuditEntry): string {
  if (entry.type !== "message") return entry.type;
  if (entry.message.role === "user") return "message.user";
  if (entry.message.role === "assistant") return "message.assistant";
  const toolName = entry.message.toolName ?? "unknown";
  return `message.toolResult.${getToolCategory(toolName)}`;
}

function getEventMeaningfulInfo(event: GlobalEventEntry): string {
  const { entry } = event;
  if (entry.type === "session") return `cwd=${entry.cwd}`;
  if (entry.type === "model_change") return `provider=${entry.provider} model=${entry.modelId}`;
  if (entry.type === "thinking_level_change") return `thinking=${entry.thinkingLevel}`;
  if (entry.type === "custom") return `customType=${entry.customType}`;
  if (entry.type === "compaction") return `summary=${entry.summary}`;

  if (entry.message.role === "user") {
    return getTextContent(entry).replace(/\n/g, " ");
  }

  if (entry.message.role === "assistant") {
    const tools = getToolCalls(entry);
    if (tools.length > 0) {
      return tools.map((tc) => `${tc.name}(${getToolCategory(tc.name)})`).join(", ");
    }
    return getTextContent(entry).replace(/\n/g, " ");
  }

  const toolName = entry.message.toolName ?? "unknown";
  const status = entry.message.details?.status ?? "done";
  const duration = entry.message.details?.durationMs ? ` ${formatDuration(entry.message.details.durationMs)}` : "";
  const exit = entry.message.details?.exitCode !== undefined ? ` exit=${entry.message.details.exitCode}` : "";
  return `${toolName} [${getToolCategory(toolName)}] ${status}${duration}${exit}`;
}

function typeColor(entry: AuditEntry): string {
  if (entry.type === "message") {
    if (entry.message.role === "user") return colors.roleUser;
    if (entry.message.role === "assistant") return colors.roleAssistant;
    return colors.roleTool;
  }
  return getEntryColor(entry);
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

function AllEventItem({
  event,
  index,
  isSelected,
  isFocused,
  onClick,
}: {
  event: GlobalEventEntry;
  index: number;
  isSelected: boolean;
  isFocused: boolean;
  onClick: () => void;
}) {
  const icon = getEntryIcon(event.entry);
  const info = getEventMeaningfulInfo(event);
  const eventType = getEventTypeLabel(event.entry);
  const time = formatRelativeTime(new Date(event.entry.timestamp));
  const sessionId = event.sessionId.slice(0, 8);
  const compactAgent = event.agentName.length > 8 ? `${event.agentName.slice(0, 7)}…` : event.agentName;

  const iconColor = isSelected && isFocused ? colors.selectedFg : getEntryColor(event.entry);
  const textCol = isSelected && isFocused ? colors.selectedFg : colors.textSecondary;
  const dimCol = isSelected && isFocused ? colors.selectedMuted : colors.textMuted;

  return (
    <box
      height={1}
      paddingLeft={1}
      backgroundColor={isSelected && isFocused ? colors.selectedBg : "transparent"}
      onMouseDown={onClick}
    >
      <text>
        <span fg={dimCol}>{`${String(index + 1).padStart(5)} `}</span>
        <span fg={dimCol}>{time.padEnd(6)}</span>{" "}
        <span fg={textCol}>{compactAgent.padEnd(8)}</span>{" "}
        <span fg={dimCol}>{sessionId}</span>{" "}
        <span fg={iconColor}>{icon}</span>{" "}
        <span fg={typeColor(event.entry)}>{eventType}</span>{" "}
        <span fg={textCol}>{info}</span>
      </text>
    </box>
  );
}

function EventDetail({ event }: { event: GlobalEventEntry | null }) {
  if (!event) {
    return (
      <box flexGrow={1} alignItems="center" justifyContent="center">
        <text><span fg={colors.textMuted}>No event selected</span></text>
      </box>
    );
  }

  const { entry, agentName, sessionId } = event;

  if (entry.type === "message") {
    const textContent = getTextContent(entry);
    const toolCalls = getToolCalls(entry);
    const toolResultContent = getToolResultContent(entry);

    return (
      <scrollbox flexGrow={1} focused={false}>
        <box flexDirection="column" padding={1}>
          <text><span fg={typeColor(entry)}>{`Type: ${getEventTypeLabel(entry)}`}</span></text>
          <text><span fg={colors.textMuted}>{`Agent: ${agentName}`}</span></text>
          <text><span fg={colors.textMuted}>{`Session: ${sessionId}`}</span></text>
          <text><span fg={colors.textMuted}>{`ID: ${entry.id}`}</span></text>
          <text><span fg={colors.textMuted}>{`Time: ${new Date(entry.timestamp).toLocaleString()}`}</span></text>

          {entry.message.role === "toolResult" && (
            <box flexDirection="column" marginTop={1}>
              <text><span fg={colors.warning}>TOOL RESULT</span></text>
              <text><span fg={colors.textPrimary}>{`Tool: ${entry.message.toolName ?? "unknown"}`}</span></text>
              <text><span fg={colors.textMuted}>{`Category: ${getToolCategory(entry.message.toolName ?? "unknown")}`}</span></text>
              {entry.message.details?.status && (
                <text>
                  <span fg={entry.message.details.status === "completed" ? colors.success : colors.error}>
                    {`Status: ${entry.message.details.status}`}
                  </span>
                </text>
              )}
              {entry.message.details?.durationMs && (
                <text><span fg={colors.info}>{`Duration: ${formatDuration(entry.message.details.durationMs)}`}</span></text>
              )}
              {entry.message.details?.exitCode !== undefined && (
                <text>
                  <span fg={entry.message.details.exitCode === 0 ? colors.success : colors.error}>
                    {`Exit Code: ${entry.message.details.exitCode}`}
                  </span>
                </text>
              )}
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

          {entry.message.role === "toolResult" ? (
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
        <text><span fg={typeColor(entry)}>{`Type: ${getEventTypeLabel(entry)}`}</span></text>
        <text><span fg={colors.textMuted}>{`Agent: ${agentName}`}</span></text>
        <text><span fg={colors.textMuted}>{`Session: ${sessionId}`}</span></text>
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

export function AllEventsViewer({
  events,
  selectedIndex,
  onSelectEvent,
  isFocused,
  isLoading,
  histogramBuckets = 52,
  scopeLabel = "Global (all agents)",
}: AllEventsViewerProps) {
  const loadingIndicator = isLoading ? " (loading...)" : "";
  const histogram = useMemo(() => buildHistogram(events, histogramBuckets), [events, histogramBuckets]);
  const displayCounts = useMemo(
    () => expandHistogramForDisplay(histogram.counts, SPARK_DISPLAY_WIDTH),
    [histogram.counts]
  );
  const summary = useMemo(() => {
    let user = 0;
    let assistant = 0;
    let tool = 0;
    let system = 0;
    let errors = 0;
    let runs = 0;
    let prevSignature = "";

    for (const event of events) {
      const entry = event.entry;
      if (entry.type === "message") {
        if (entry.message.role === "user") user += 1;
        else if (entry.message.role === "assistant") assistant += 1;
        else {
          tool += 1;
          if (entry.message.isError) errors += 1;
        }
      } else {
        system += 1;
      }

      const signature =
        entry.type === "message"
          ? `${entry.type}:${entry.message.role}:${entry.message.toolName ?? ""}`
          : entry.type;
      if (signature !== prevSignature) {
        runs += 1;
        prevSignature = signature;
      }
    }

    return { user, assistant, tool, system, errors, runs };
  }, [events]);

  const start = Math.max(0, selectedIndex - WINDOW_RADIUS);
  const end = Math.min(events.length, start + WINDOW_SIZE);
  const windowStart = Math.max(0, end - WINDOW_SIZE);
  const visibleEvents = events.slice(windowStart, end);
  const rangeStart = events.length === 0 ? 0 : windowStart + 1;
  const rangeEnd = windowStart + visibleEvents.length;
  const markerIndex = events.length <= 1 ? 0 : Math.round((selectedIndex / (events.length - 1)) * (SPARK_DISPLAY_WIDTH - 1));

  const headerText = `[${isFocused ? "*" : " "}] All View (${events.length})${loadingIndicator} | showing ${rangeStart}-${rangeEnd}`;
  const selectedEvent = events[selectedIndex] ?? null;

  return (
    <box
      flexDirection="column"
      flexGrow={1}
      backgroundColor={colors.panelBg}
      border
      borderStyle="single"
      borderColor={isFocused ? colors.borderFocus : colors.borderNormal}
    >
      <box
        flexDirection="row"
        height={1}
        paddingLeft={1}
        backgroundColor={isFocused ? colors.panelHeaderActive : colors.panelHeaderBg}
      >
        <text><span fg={isFocused ? colors.selectedFg : colors.textSecondary}>{headerText}</span></text>
        <box flexGrow={1} />
        <text><span fg={colors.textMuted}>{scopeLabel}</span></text>
      </box>

      <box flexDirection="column" paddingLeft={1} paddingRight={1} backgroundColor={colors.tableHeaderBg}>
        <text><span fg={colors.textMuted}>{`Timeline ${histogram.startLabel} -> ${histogram.endLabel} (peak ${histogram.maxCount}/bucket, bins ${histogramBuckets})`}</span></text>
        <text>
          {displayCounts.map((count, i) => {
            const ratio = histogram.maxCount > 0 ? count / histogram.maxCount : 0;
            const baseIndex = Math.round(ratio * (SPARK_CHARS.length - 1));
            const charIndex = count > 0 ? Math.max(1, Math.min(SPARK_CHARS.length - 1, baseIndex)) : 0;
            const char = SPARK_CHARS[charIndex] ?? " ";
            const color =
              ratio === 0
                ? colors.textDim
                : ratio < 0.34
                  ? colors.textMuted
                  : ratio < 0.67
                    ? colors.info
                    : colors.accent;
            return <span key={i} fg={color}>{char}</span>;
          })}
        </text>
        <text>
          {Array.from({ length: SPARK_DISPLAY_WIDTH }, (_, i) => (
            <span key={i} fg={i === markerIndex ? colors.warning : colors.textDim}>{i === markerIndex ? "^" : " "}</span>
          ))}
        </text>
        <text>
          <span fg={colors.textMuted}>{`Summary u:${summary.user} a:${summary.assistant} t:${summary.tool} sys:${summary.system} err:${summary.errors} runs:${summary.runs}`}</span>
        </text>
      </box>

      <box flexDirection="row" flexGrow={1}>
        <box
          flexDirection="column"
          width={76}
          borderStyle="single"
          borderColor={colors.borderNormal}
        >
          <box
            height={1}
            paddingLeft={1}
            backgroundColor={colors.tableHeaderBg}
          >
            <text><span fg={colors.textMuted}>#     Time   Agent    Session  Icon Type                     Event info</span></text>
          </box>

          <scrollbox key={`events-${windowStart}`} flexGrow={1} focused={false}>
            <box flexDirection="column">
              {visibleEvents.map((event, idx) => {
                const absoluteIndex = windowStart + idx;
                return (
                  <AllEventItem
                    key={`${event.sessionId}-${event.entry.id || absoluteIndex}`}
                    event={event}
                    index={absoluteIndex}
                    isSelected={absoluteIndex === selectedIndex}
                    isFocused={isFocused}
                    onClick={() => onSelectEvent(absoluteIndex)}
                  />
                );
              })}
            </box>
          </scrollbox>
        </box>

        <box flexDirection="column" flexGrow={1}>
          <EventDetail event={selectedEvent} />
        </box>
      </box>

      <box
        height={1}
        paddingLeft={1}
        backgroundColor={colors.footerBg}
      >
        <text><span fg={colors.textMuted}>{`j/k: Navigate | Enter: Open session | v: Scope | b: Histogram bins (${histogramBuckets}) | Esc: Back`}</span></text>
      </box>
    </box>
  );
}
