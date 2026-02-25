// Time formatting utilities

import { getEntryIcon as getMappedEntryIcon } from "../constants/icons";

export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;

  return date.toLocaleDateString();
}

export function formatTokens(tokens: number): string {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(1)}M`;
  }
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}k`;
  }
  return tokens.toString();
}

export function formatTokensWithPercent(tokens: number, maxTokens: number): string {
  const formatted = formatTokens(tokens);
  const percent = maxTokens > 0 ? Math.round((tokens / maxTokens) * 100) : 0;
  return `${formatted} (${percent}%)`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

export function getToolCategory(toolName: string): import("../types").ToolCategory {
  const normalized = toolName.toLowerCase();

  const fileTools = ["read", "write", "edit", "notebookedit"];
  const searchTools = ["glob", "grep", "rg"];
  const execTools = ["bash", "exec", "run_background", "check_background"];
  const webTools = ["websearch", "webfetch", "web_search", "web_fetch", "http"];
  const subagentTools = ["task", "sessions_spawn", "sessions_list", "sessions_history", "delegate_task", "call_agent"];
  const mcpTools = ["mcp__"];

  if (fileTools.some((t) => normalized.includes(t))) return "file";
  if (searchTools.some((t) => normalized.includes(t))) return "search";
  if (execTools.some((t) => normalized.includes(t))) return "exec";
  if (webTools.some((t) => normalized.includes(t))) return "web";
  if (subagentTools.some((t) => normalized.includes(t))) return "subagent";
  if (mcpTools.some((t) => normalized.startsWith(t))) return "mcp";
  return "other";
}

// Get icon character for entry type
export function getEntryIcon(entry: import("../types").AuditEntry): string {
  return getMappedEntryIcon(entry);
}

// Get color for entry based on type
export function getEntryColor(entry: import("../types").AuditEntry): string {
  const { colors } = require("../constants/colors");

  if (entry.type === "message") {
    switch (entry.message.role) {
      case "user": return colors.typeUser;
      case "assistant": return colors.typeAssistant;
      case "toolResult": return colors.typeToolResult;
    }
  }

  switch (entry.type) {
    case "session": return colors.typeSystem;
    case "model_change": return colors.typeWarning;
    case "thinking_level_change": return colors.typeWarning;
    case "compaction": return colors.typeWarning;
    default: return colors.textSecondary;
  }
}
