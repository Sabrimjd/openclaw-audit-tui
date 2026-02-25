import { useState, useEffect, useCallback, useRef } from "react";
import type { Agent, Session, SessionSummary, GlobalEventEntry } from "../types";
import { loadAgents, loadSession, getAllSessionSummaries } from "../lib/session-loader";

function isValidEventTimestamp(timestamp: string): boolean {
  const ts = new Date(timestamp).getTime();
  if (!Number.isFinite(ts) || ts <= 0) return false;
  const now = Date.now();
  return ts <= now + 5 * 60 * 1000;
}

export function useSessions() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allEvents, setAllEvents] = useState<GlobalEventEntry[]>([]);
  const [allEventsLoading, setAllEventsLoading] = useState(false);
  const allEventsLoadedRef = useRef(false);

  // Load all agents and sessions on mount
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setError(null);

      try {
        const [loadedAgents, loadedSessions] = await Promise.all([
          loadAgents(),
          getAllSessionSummaries(),
        ]);

        setAgents(loadedAgents);
        // Sort sessions by last activity descending
        const sortedSessions = loadedSessions.sort(
          (a, b) => {
            const aTime = a.lastActivity?.getTime?.() ?? a.timestamp.getTime();
            const bTime = b.lastActivity?.getTime?.() ?? b.timestamp.getTime();
            return bTime - aTime;
          }
        );
        setSessions(sortedSessions);

        // Preload all events in background
        preloadAllEvents(sortedSessions);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load sessions");
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, []);

  // Preload all events in background (non-blocking)
  const preloadAllEvents = useCallback(async (sessionList: SessionSummary[]) => {
    if (allEventsLoadedRef.current) return;

    setAllEventsLoading(true);

    // Load in chunks to avoid blocking
    const events: GlobalEventEntry[] = [];

    for (const session of sessionList) {
      try {
          const fullSession = await loadSession(session.agentName, session.filePath);
          if (fullSession) {
            for (const entry of fullSession.entries) {
              if (!isValidEventTimestamp(entry.timestamp)) continue;
              events.push({
                entry,
                agentName: session.agentName,
                sessionId: session.id,
                sessionFilePath: session.filePath,
                sessionTimestamp: session.timestamp,
              });
            }
          }
      } catch {
        // Skip sessions that fail to load
      }
    }

    // Sort by timestamp (most recent first)
    events.sort((a, b) => {
      const timeA = new Date(a.entry.timestamp).getTime();
      const timeB = new Date(b.entry.timestamp).getTime();
      return timeB - timeA;
    });

    setAllEvents(events);
    setAllEventsLoading(false);
    allEventsLoadedRef.current = true;
  }, []);

  // Load a specific session
  const selectSession = useCallback(async (summary: SessionSummary) => {
    setIsLoading(true);
    setError(null);

    try {
      const session = await loadSession(summary.agentName, summary.filePath);
      setCurrentSession(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load session");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Clear current session
  const clearSession = useCallback(() => {
    setCurrentSession(null);
  }, []);

  // Refresh sessions
  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [loadedAgents, loadedSessions] = await Promise.all([
        loadAgents(),
        getAllSessionSummaries(),
      ]);

      setAgents(loadedAgents);
      setSessions(
        loadedSessions.sort(
          (a, b) => {
            const aTime = a.lastActivity?.getTime?.() ?? a.timestamp.getTime();
            const bTime = b.lastActivity?.getTime?.() ?? b.timestamp.getTime();
            return bTime - aTime;
          }
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load all events from all sessions (uses cache if available)
  const loadAllEvents = useCallback(async () => {
    // If already loaded, just return
    if (allEventsLoadedRef.current && allEvents.length > 0) {
      return;
    }

    // Otherwise load now
    await preloadAllEvents(sessions);
  }, [sessions, allEvents.length, preloadAllEvents]);

  return {
    agents,
    sessions,
    currentSession,
    isLoading,
    error,
    selectSession,
    clearSession,
    refresh,
    allEvents,
    allEventsLoading,
    loadAllEvents,
  };
}
