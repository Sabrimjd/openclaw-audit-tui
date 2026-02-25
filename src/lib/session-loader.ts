import { readdir, readFile } from "node:fs/promises";
import { join, basename } from "node:path";
import type { Agent, AuditEntry, Session, SessionSummary, SessionStats } from "../types";
import { parseJsonlContent } from "./parser";
import { formatRelativeTime, formatTokens } from "./utils";

const OPENCLAW_AGENTS_PATH = "/home/sab/.openclaw/agents";

// Check if a session file is deleted
function isDeletedFile(filename: string): boolean {
  return filename.includes(".deleted.");
}

// Extract topic ID from filename if present
function extractTopicId(filename: string): string | undefined {
  const match = filename.match(/-topic-([a-f0-9-]+)/);
  return match ? match[1] : undefined;
}

// Calculate session statistics from entries
function calculateStats(entries: AuditEntry[]): SessionStats {
  const stats: SessionStats = {
    totalTokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    messageCount: 0,
    userMessages: 0,
    assistantMessages: 0,
    toolCalls: 0,
    toolResults: 0,
    errors: 0,
  };

  for (const entry of entries) {
    if (entry.type === "message") {
      stats.messageCount++;

      if (entry.message.role === "user") {
        stats.userMessages++;
      } else if (entry.message.role === "assistant") {
        stats.assistantMessages++;

        // Count tool calls
        const toolCalls = entry.message.content.filter((b) => b.type === "toolCall");
        stats.toolCalls += toolCalls.length;

        // Sum tokens
        if (entry.message.usage) {
          stats.inputTokens += entry.message.usage.input || 0;
          stats.outputTokens += entry.message.usage.output || 0;
          stats.totalTokens += entry.message.usage.totalTokens || 0;
        }
      } else if (entry.message.role === "toolResult") {
        stats.toolResults++;
        if (entry.message.isError) {
          stats.errors++;
        }
      }
    }
  }

  return stats;
}

// Extract session metadata from entries
function extractSessionMetadata(entries: AuditEntry[]): {
  id: string;
  timestamp: Date;
  lastActivity: Date;
  cwd: string;
  model: string;
  provider: string;
} {
  const sessionEntry = entries.find((e) => e.type === "session");
  const now = Date.now();

  const latestModelChange = [...entries]
    .reverse()
    .find((e): e is Extract<AuditEntry, { type: "model_change" }> => e.type === "model_change");
  const latestAssistantWithModel = [...entries]
    .reverse()
    .find((e): e is Extract<AuditEntry, { type: "message" }> => e.type === "message" && e.message.role === "assistant" && Boolean(e.message.model));
  const latestAssistantWithProvider = [...entries]
    .reverse()
    .find((e): e is Extract<AuditEntry, { type: "message" }> => e.type === "message" && e.message.role === "assistant" && Boolean(e.message.provider));

  const validTimestamps = entries
    .map((e) => new Date(e.timestamp).getTime())
    .filter((ts) => Number.isFinite(ts) && ts > 0 && ts <= now + 5 * 60 * 1000);

  const lastActivityTs = validTimestamps.length > 0 ? Math.max(...validTimestamps) : now;

  return {
    id: (sessionEntry as any)?.id || "unknown",
    timestamp: sessionEntry ? new Date(sessionEntry.timestamp) : new Date(),
    lastActivity: new Date(lastActivityTs),
    cwd: (sessionEntry as any)?.cwd || "",
    model: latestModelChange?.modelId || latestAssistantWithModel?.message.model || "unknown",
    provider: latestModelChange?.provider || latestAssistantWithProvider?.message.provider || "unknown",
  };
}

// Load all agents and their sessions
export async function loadAgents(): Promise<Agent[]> {
  const agents: Agent[] = [];

  try {
    const agentDirs = await readdir(OPENCLAW_AGENTS_PATH, { withFileTypes: true });

    for (const dir of agentDirs) {
      if (!dir.isDirectory()) continue;

      const agentPath = join(OPENCLAW_AGENTS_PATH, dir.name);
      const sessionsPath = join(agentPath, "sessions");

      try {
        const sessionFiles = await readdir(sessionsPath);
        const jsonlFiles = sessionFiles.filter(
          (f) => f.endsWith(".jsonl") && !f.includes(".deleted.")
        );

        if (jsonlFiles.length > 0) {
          const sessions = await Promise.all(
            jsonlFiles.map((f) => loadSessionSummary(dir.name, join(sessionsPath, f)))
          );

          agents.push({
            name: dir.name,
            path: agentPath,
            sessionCount: jsonlFiles.length,
            sessions: sessions.filter((s): s is SessionSummary => s !== null),
          });
        }
      } catch {
        // Sessions directory doesn't exist or can't be read
        continue;
      }
    }
  } catch (error) {
    console.error(`Failed to load agents: ${error}`);
  }

  // Sort by session count descending
  return agents.sort((a, b) => b.sessionCount - a.sessionCount);
}

// Load a session summary (without full entries)
export async function loadSessionSummary(
  agentName: string,
  filePath: string
): Promise<SessionSummary | null> {
  try {
    const content = await readFile(filePath, "utf-8");
    const entries = parseJsonlContent(content);
    const metadata = extractSessionMetadata(entries);
    const stats = calculateStats(entries);

    const filename = basename(filePath);
    const maxContext = 262000; // Typical context window size
    const tokenPercent = Math.round((stats.totalTokens / maxContext) * 100);

    // Build flags
    const flags: string[] = [];
    if (stats.errors > 0) flags.push("err");
    const compactionCount = entries.filter((e) => e.type === "compaction").length;
    if (compactionCount > 0) flags.push("compact");
    if (metadata.model === "unknown") flags.push("model?");

    return {
      id: metadata.id,
      agentName,
      filePath,
      timestamp: metadata.timestamp,
      startedAge: formatRelativeTime(metadata.timestamp),
      lastActivity: metadata.lastActivity,
      lastActivityAge: formatRelativeTime(metadata.lastActivity),
      model: metadata.model,
      provider: metadata.provider,
      eventCount: entries.length,
      messageCount: stats.messageCount,
      toolCallCount: stats.toolCalls,
      toolResultCount: stats.toolResults,
      errorCount: stats.errors,
      compactionCount,
      tokens: formatTokens(stats.totalTokens),
      tokenPercent,
      flags,
      isDeleted: isDeletedFile(filename),
      topicId: extractTopicId(filename),
    };
  } catch (error) {
    console.error(`Failed to load session summary ${filePath}: ${error}`);
    return null;
  }
}

// Load a full session with all entries
export async function loadSession(
  agentName: string,
  filePath: string
): Promise<Session | null> {
  try {
    const content = await readFile(filePath, "utf-8");
    const entries = parseJsonlContent(content);
    const metadata = extractSessionMetadata(entries);
    const stats = calculateStats(entries);

    const filename = basename(filePath);

    return {
      id: metadata.id,
      agentName,
      filePath,
      timestamp: metadata.timestamp,
      cwd: metadata.cwd,
      model: metadata.model,
      provider: metadata.provider,
      entries,
      stats,
      isDeleted: isDeletedFile(filename),
      topicId: extractTopicId(filename),
    };
  } catch (error) {
    console.error(`Failed to load session ${filePath}: ${error}`);
    return null;
  }
}

// Get all session summaries across all agents
export async function getAllSessionSummaries(): Promise<SessionSummary[]> {
  const agents = await loadAgents();
  return agents.flatMap((agent) => agent.sessions);
}
