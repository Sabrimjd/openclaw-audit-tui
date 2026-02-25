// Base entry structure - all JSONL lines have these
export interface BaseEntry {
  type: string;
  id: string;
  parentId: string | null;
  timestamp: string;
}

// Session metadata entry
export interface SessionEntry extends BaseEntry {
  type: "session";
  version: number;
  cwd: string;
}

// Model change events
export interface ModelChangeEntry extends BaseEntry {
  type: "model_change";
  provider: string;
  modelId: string;
}

// Thinking level changes
export interface ThinkingLevelChangeEntry extends BaseEntry {
  type: "thinking_level_change";
  thinkingLevel: "off" | "low" | "medium" | "high";
}

// Custom entries (model-snapshots, etc.)
export interface CustomEntry extends BaseEntry {
  type: "custom";
  customType: string;
  data: Record<string, unknown>;
}

// Compaction entry (context window summaries)
export interface CompactionEntry extends BaseEntry {
  type: "compaction";
  summary: string;
  firstKeptEntryId: string;
  tokensBefore: number;
  details?: {
    readFiles?: string[];
    modifiedFiles?: string[];
  };
}

// Content block types within messages
export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "toolCall"; id: string; name: string; arguments: Record<string, unknown> }
  | { type: "thinking"; text: string }
  | { type: "image"; source: unknown };

// Usage statistics
export interface UsageStats {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  cost?: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    total: number;
  };
}

// Tool result details
export interface ToolResultDetails {
  status: "completed" | "error" | "running";
  exitCode?: number;
  durationMs?: number;
}

// Message entry - the most common type
export interface MessageEntry extends BaseEntry {
  type: "message";
  message: {
    role: "user" | "assistant" | "toolResult";
    content: ContentBlock[];
    // For assistant messages
    api?: string;
    provider?: string;
    model?: string;
    usage?: UsageStats;
    stopReason?: string;
    // For toolResult messages
    toolCallId?: string;
    toolName?: string;
    details?: ToolResultDetails;
    isError?: boolean;
  };
}

// Union type for all entries
export type AuditEntry =
  | SessionEntry
  | ModelChangeEntry
  | ThinkingLevelChangeEntry
  | CustomEntry
  | MessageEntry
  | CompactionEntry;

// Session statistics
export interface SessionStats {
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  messageCount: number;
  userMessages: number;
  assistantMessages: number;
  toolCalls: number;
  toolResults: number;
  errors: number;
}

// Parsed session with metadata
export interface Session {
  id: string;
  agentName: string;
  filePath: string;
  timestamp: Date;
  cwd: string;
  model: string;
  provider: string;
  entries: AuditEntry[];
  stats: SessionStats;
  isDeleted: boolean;
  topicId?: string;
}

// Agent info
export interface Agent {
  name: string;
  path: string;
  sessionCount: number;
  sessions: SessionSummary[];
}

// Session summary for list view
export interface SessionSummary {
  id: string;
  agentName: string;
  filePath: string;
  timestamp: Date;
  startedAge: string;
  lastActivity: Date;
  lastActivityAge: string;
  model: string;
  provider: string;
  eventCount: number;
  messageCount: number;
  toolCallCount: number;
  toolResultCount: number;
  errorCount: number;
  compactionCount: number;
  tokens: string;
  tokenPercent: number;
  flags: string[];
  isDeleted: boolean;
  topicId?: string;
}

// Tool type categorization
export type ToolCategory =
  | "file" // Read, Write, Edit
  | "search" // Glob, Grep
  | "exec" // Bash, exec
  | "web" // WebSearch, WebFetch
  | "subagent" // Task, sessions_spawn
  | "mcp" // MCP tools
  | "other";

// Entry type filter
export type EntryTypeFilter = "all" | "user" | "assistant" | "tool" | "system";

// Filter state
export interface FilterState {
  entryType: EntryTypeFilter;
  searchQuery: string;
}

// View state
export interface ViewState {
  currentView: "agents" | "sessions" | "entries";
  selectedAgent: string | null;
  selectedSession: string | null;
  selectedEntryIndex: number;
  scrollOffset: number;
}

// Focus panel
export type FocusPanel = "sidebar" | "content" | "filter";

// App state
export interface AppState {
  agents: Agent[];
  sessions: SessionSummary[];
  currentSession: Session | null;
  filteredEntries: AuditEntry[];
  viewState: ViewState;
  filterState: FilterState;
  focusPanel: FocusPanel;
  isLoading: boolean;
  error: string | null;
}

// Global event entry for the "All Events" view
export interface GlobalEventEntry {
  entry: AuditEntry;
  agentName: string;
  sessionId: string;
  sessionFilePath: string;
  sessionTimestamp: Date;
}
