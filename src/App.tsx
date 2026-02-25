import { useState, useEffect, useCallback, useMemo } from "react";
import { useKeyboard, useRenderer } from "@opentui/react";
import type { SessionSummary, FocusPanel, ToolCategory, GlobalEventEntry } from "./types";
import { useSessions } from "./hooks/useSessions";
import { useFilter } from "./hooks/useFilter";
import { Layout } from "./components/Layout";
import { AgentList } from "./components/AgentList";
import { SessionList } from "./components/SessionList";
import { EntryViewer } from "./components/EntryViewer";
import { AllEventsViewer } from "./components/AllEventsViewer";
import { FilterBar } from "./components/FilterBar";
import { colors } from "./constants/colors";
import { BreadcrumbBar } from "./components/BreadcrumbBar";
import { CommandPalette, type PaletteCommand } from "./components/CommandPalette";
import {
  AdvancedFilterModal,
  type AdvancedAllEventsFilter,
  type AdvancedEntryFilter,
} from "./components/AdvancedFilterModal";
import { getToolCategory } from "./lib/utils";

type View = "sessions" | "entries" | "all-events";
const HISTOGRAM_BUCKET_OPTIONS = [24, 52, 96] as const;
const PAGE_STEP = 20;
const ADV_FILTER_FIELD_COUNT = 6;
const ENTRY_TYPE_VALUES: Array<"all" | "user" | "assistant" | "tool" | "system"> = ["all", "user", "assistant", "tool", "system"];
const ROLE_VALUES: Array<"all" | "user" | "assistant" | "toolResult"> = ["all", "user", "assistant", "toolResult"];
const TOOL_CATEGORY_VALUES: Array<"all" | ToolCategory> = ["all", "file", "search", "exec", "web", "subagent", "mcp", "other"];
const EVENT_TYPE_VALUES: Array<"all" | "message" | "session" | "model_change" | "thinking_level_change" | "custom" | "compaction"> = [
  "all",
  "message",
  "session",
  "model_change",
  "thinking_level_change",
  "custom",
  "compaction",
];
const TIME_WINDOW_VALUES: Array<"15m" | "1h" | "6h" | "24h" | "all"> = ["15m", "1h", "6h", "24h", "all"];

function cycleValue<T>(values: T[], current: T, delta: 1 | -1): T {
  const index = values.indexOf(current);
  const start = index >= 0 ? index : 0;
  const next = (start + delta + values.length) % values.length;
  return values[next] ?? values[0]!;
}
type AllEventsScope = "global" | "agent";
type FilterModalMode = "entries" | "all-events";

interface NavigationSnapshot {
  view: View;
  focusPanel: FocusPanel;
  selectedAgentIndex: number;
  selectedSessionIndex: number;
  selectedEntryIndex: number;
  allEventsSelectedIndex: number;
  allEventsScope: AllEventsScope;
  histogramBucketIndex: number;
  sessionFilePath: string | null;
}

function eventMatchesCategory(event: GlobalEventEntry, category: "all" | ToolCategory): boolean {
  if (category === "all") return true;
  if (event.entry.type !== "message") return false;

  if (event.entry.message.role === "assistant") {
    return event.entry.message.content.some(
      (block) => block.type === "toolCall" && getToolCategory(block.name) === category
    );
  }

  if (event.entry.message.role === "toolResult") {
    return getToolCategory(event.entry.message.toolName ?? "") === category;
  }

  return false;
}

function eventSearchText(event: GlobalEventEntry): string {
  const base = [event.agentName, event.sessionId, event.entry.type, event.entry.id, event.entry.timestamp].join(" ");
  if (event.entry.type !== "message") return `${base} ${JSON.stringify(event.entry)}`.toLowerCase();

  const textBlocks = event.entry.message.content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join(" ");
  const toolBlocks = event.entry.message.content
    .filter((b): b is { type: "toolCall"; id: string; name: string; arguments: Record<string, unknown> } => b.type === "toolCall")
    .map((b) => `${b.name} ${JSON.stringify(b.arguments)}`)
    .join(" ");
  return `${base} ${event.entry.message.role} ${event.entry.message.toolName ?? ""} ${textBlocks} ${toolBlocks}`.toLowerCase();
}

function eventWindowMs(window: AdvancedAllEventsFilter["timeWindow"]): number | null {
  switch (window) {
    case "15m":
      return 15 * 60 * 1000;
    case "1h":
      return 60 * 60 * 1000;
    case "6h":
      return 6 * 60 * 60 * 1000;
    case "24h":
      return 24 * 60 * 60 * 1000;
    default:
      return null;
  }
}

export function App() {
  const renderer = useRenderer();
  const {
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
  } = useSessions();

  const [view, setView] = useState<View>("sessions");
  const [focusPanel, setFocusPanel] = useState<FocusPanel>("content");
  const [selectedAgentIndex, setSelectedAgentIndex] = useState(0);
  const [selectedSessionIndex, setSelectedSessionIndex] = useState(0);
  const [selectedEntryIndex, setSelectedEntryIndex] = useState(0);
  const [allEventsSelectedIndex, setAllEventsSelectedIndex] = useState(0);
  const [showFilterBar, setShowFilterBar] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [histogramBucketIndex, setHistogramBucketIndex] = useState(1);
  const [allEventsScope, setAllEventsScope] = useState<AllEventsScope>("global");

  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [paletteIndex, setPaletteIndex] = useState(0);
  const [navStack, setNavStack] = useState<NavigationSnapshot[]>([]);

  const [isAdvancedFilterOpen, setIsAdvancedFilterOpen] = useState(false);
  const [filterModalMode, setFilterModalMode] = useState<FilterModalMode>("entries");
  const [advancedFilterFieldIndex, setAdvancedFilterFieldIndex] = useState(0);
  const [isAdvancedFilterEditing, setIsAdvancedFilterEditing] = useState(false);
  const [allEventsFilter, setAllEventsFilter] = useState<AdvancedAllEventsFilter>({
    timeWindow: "all",
    eventType: "all",
    toolCategory: "all",
    toolNameQuery: "",
    onlyErrors: false,
    query: "",
  });

  const {
    filterState,
    filteredEntries,
    setEntryType,
    setSearchQuery,
    cycleEntryType,
    advancedFilterState,
    updateAdvancedFilter,
    clearFilters,
  } = useFilter(currentSession?.entries || []);

  const selectedAgent = agents[selectedAgentIndex];
  const histogramBuckets = HISTOGRAM_BUCKET_OPTIONS[histogramBucketIndex] ?? 52;

  const scopedAllEvents = useMemo(
    () =>
      allEventsScope === "agent" && selectedAgent
        ? allEvents.filter((e) => e.agentName === selectedAgent.name)
        : allEvents,
    [allEventsScope, selectedAgent, allEvents]
  );

  const filteredAllEvents = useMemo(() => {
    const now = Date.now();
    const windowMs = eventWindowMs(allEventsFilter.timeWindow);
    const query = allEventsFilter.query.trim().toLowerCase();
    const toolNeedle = allEventsFilter.toolNameQuery.trim().toLowerCase();

    return scopedAllEvents.filter((event) => {
      const ts = new Date(event.entry.timestamp).getTime();
      if (windowMs !== null && now - ts > windowMs) return false;

      if (allEventsFilter.eventType !== "all" && event.entry.type !== allEventsFilter.eventType) {
        return false;
      }

      if (!eventMatchesCategory(event, allEventsFilter.toolCategory)) {
        return false;
      }

      if (toolNeedle) {
        if (event.entry.type !== "message") return false;
        if (event.entry.message.role === "assistant") {
          const hit = event.entry.message.content.some(
            (block) => block.type === "toolCall" && block.name.toLowerCase().includes(toolNeedle)
          );
          if (!hit) return false;
        } else if (event.entry.message.role === "toolResult") {
          if (!(event.entry.message.toolName ?? "").toLowerCase().includes(toolNeedle)) return false;
        } else {
          return false;
        }
      }

      if (allEventsFilter.onlyErrors) {
        if (event.entry.type !== "message" || event.entry.message.role !== "toolResult" || !event.entry.message.isError) {
          return false;
        }
      }

      if (query && !eventSearchText(event).includes(query)) {
        return false;
      }

      return true;
    });
  }, [scopedAllEvents, allEventsFilter]);

  const filteredSessions =
    selectedAgentIndex >= 0 && selectedAgent
      ? sessions.filter((s) => s.agentName === selectedAgent.name)
      : sessions;

  const pushSnapshot = useCallback(() => {
    setNavStack((prev) => {
      const snapshot: NavigationSnapshot = {
        view,
        focusPanel,
        selectedAgentIndex,
        selectedSessionIndex,
        selectedEntryIndex,
        allEventsSelectedIndex,
        allEventsScope,
        histogramBucketIndex,
        sessionFilePath: currentSession?.filePath ?? null,
      };
      return [...prev, snapshot].slice(-80);
    });
  }, [
    view,
    focusPanel,
    selectedAgentIndex,
    selectedSessionIndex,
    selectedEntryIndex,
    allEventsSelectedIndex,
    allEventsScope,
    histogramBucketIndex,
    currentSession,
  ]);

  const restoreSnapshot = useCallback(
    async (snapshot: NavigationSnapshot) => {
      setFocusPanel(snapshot.focusPanel);
      setSelectedAgentIndex(snapshot.selectedAgentIndex);
      setSelectedSessionIndex(snapshot.selectedSessionIndex);
      setSelectedEntryIndex(snapshot.selectedEntryIndex);
      setAllEventsSelectedIndex(snapshot.allEventsSelectedIndex);
      setAllEventsScope(snapshot.allEventsScope);
      setHistogramBucketIndex(snapshot.histogramBucketIndex);

      if (snapshot.view === "entries" && snapshot.sessionFilePath) {
        const summary = sessions.find((s) => s.filePath === snapshot.sessionFilePath);
        if (summary) {
          await selectSession(summary);
          setView("entries");
          return;
        }
      }
      if (snapshot.view === "all-events") {
        await loadAllEvents();
      }
      setView(snapshot.view);
    },
    [sessions, selectSession, loadAllEvents]
  );

  const goBack = useCallback(async () => {
    const previous = navStack[navStack.length - 1];
    if (!previous) return;
    setNavStack((prev) => prev.slice(0, -1));
    await restoreSnapshot(previous);
  }, [navStack, restoreSnapshot]);

  const openSessionEntries = useCallback(
    async (summary: SessionSummary, entryIndex = 0) => {
      pushSnapshot();
      await selectSession(summary);
      setView("entries");
      setSelectedEntryIndex(entryIndex);
    },
    [pushSnapshot, selectSession]
  );

  const baseCommands = useMemo<PaletteCommand[]>(() => {
    const commands: PaletteCommand[] = [
      {
        id: "nav-sessions",
        title: "Go to Sessions",
        subtitle: "Main sessions list",
        onRun: () => setView("sessions"),
      },
      {
        id: "nav-all-events",
        title: "Open All Events",
        subtitle: "Global timeline and inspector",
        onRun: async () => {
          await loadAllEvents();
          pushSnapshot();
          setView("all-events");
        },
      },
      {
        id: "filters-clear",
        title: "Clear all filters",
        subtitle: "Entry + all-events filters",
        onRun: () => {
          clearFilters();
          setAllEventsFilter({
            timeWindow: "all",
            eventType: "all",
            toolCategory: "all",
            toolNameQuery: "",
            onlyErrors: false,
            query: "",
          });
        },
      },
    ];

    for (const session of sessions.slice(0, 60)) {
      commands.push({
        id: `session-${session.filePath}`,
        title: `Open session ${session.agentName} / ${session.id.slice(0, 8)}`,
        subtitle: `model ${session.model} | last ${session.lastActivityAge}`,
        onRun: () => {
          void openSessionEntries(session, 0);
        },
      });
    }
    return commands;
  }, [sessions, loadAllEvents, pushSnapshot, clearFilters, openSessionEntries]);

  const paletteCommands = useMemo(() => {
    const q = paletteQuery.trim().toLowerCase();
    if (!q) return baseCommands;
    return baseCommands.filter((command) => {
      const hay = `${command.title} ${command.subtitle ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [baseCommands, paletteQuery]);

  useEffect(() => {
    setPaletteIndex((i) => Math.min(i, Math.max(0, paletteCommands.length - 1)));
  }, [paletteCommands.length]);

  useKeyboard((key) => {
    if (isPaletteOpen) {
      if (key.name === "escape") {
        setIsPaletteOpen(false);
        return;
      }
      if (key.name === "up" || key.name === "k") {
        setPaletteIndex((i) => Math.max(0, i - 1));
        return;
      }
      if (key.name === "down" || key.name === "j") {
        setPaletteIndex((i) => Math.min(paletteCommands.length - 1, i + 1));
        return;
      }
      if ((key.name === "enter" || key.name === "return") && paletteCommands[paletteIndex]) {
        const cmd = paletteCommands[paletteIndex];
        setIsPaletteOpen(false);
        cmd.onRun();
      }
      return;
    }

    if (isAdvancedFilterOpen && key.name === "escape") {
      if (isAdvancedFilterEditing) {
        setIsAdvancedFilterEditing(false);
      } else {
        setIsAdvancedFilterOpen(false);
      }
      return;
    }

    if (isAdvancedFilterOpen && !isAdvancedFilterEditing) {
      if (key.name === "up" || key.name === "k") {
        setAdvancedFilterFieldIndex((i) => (i - 1 + ADV_FILTER_FIELD_COUNT) % ADV_FILTER_FIELD_COUNT);
        return;
      }
      if (key.name === "down" || key.name === "j") {
        setAdvancedFilterFieldIndex((i) => (i + 1) % ADV_FILTER_FIELD_COUNT);
        return;
      }
      if (key.name === "tab") {
        const delta = key.shift ? -1 : 1;
        setAdvancedFilterFieldIndex((i) => (i + delta + ADV_FILTER_FIELD_COUNT) % ADV_FILTER_FIELD_COUNT);
        return;
      }
      if (key.name === "enter" || key.name === "return") {
        setIsAdvancedFilterEditing(true);
        return;
      }
      return;
    }

    if (isAdvancedFilterOpen && isAdvancedFilterEditing) {
      if (key.name === "enter" || key.name === "return") {
        setIsAdvancedFilterEditing(false);
        return;
      }

      const isTextField = advancedFilterFieldIndex === 3 || advancedFilterFieldIndex === 5;
      if (isTextField) {
        if (key.name === "backspace") {
          if (filterModalMode === "entries") {
            if (advancedFilterFieldIndex === 3) {
              updateAdvancedFilter({ toolNameQuery: advancedFilterState.toolNameQuery.slice(0, -1) });
            } else {
              setSearchQuery(filterState.searchQuery.slice(0, -1));
            }
          } else {
            if (advancedFilterFieldIndex === 3) {
              setAllEventsFilter((prev) => ({ ...prev, toolNameQuery: prev.toolNameQuery.slice(0, -1) }));
            } else {
              setAllEventsFilter((prev) => ({ ...prev, query: prev.query.slice(0, -1) }));
            }
          }
          return;
        }

        if (key.name === "space" || (key.name.length === 1 && !key.ctrl && !key.meta)) {
          const ch = key.name === "space" ? " " : key.name;
          if (filterModalMode === "entries") {
            if (advancedFilterFieldIndex === 3) {
              updateAdvancedFilter({ toolNameQuery: `${advancedFilterState.toolNameQuery}${ch}` });
            } else {
              setSearchQuery(`${filterState.searchQuery}${ch}`);
            }
          } else {
            if (advancedFilterFieldIndex === 3) {
              setAllEventsFilter((prev) => ({ ...prev, toolNameQuery: `${prev.toolNameQuery}${ch}` }));
            } else {
              setAllEventsFilter((prev) => ({ ...prev, query: `${prev.query}${ch}` }));
            }
          }
          return;
        }
      } else {
        const isNext = key.name === "down" || key.name === "j" || key.name === "right" || key.name === "l";
        const isPrev = key.name === "up" || key.name === "k" || key.name === "left" || key.name === "h";
        if (isNext || isPrev) {
          const delta: 1 | -1 = isNext ? 1 : -1;
          if (filterModalMode === "entries") {
            if (advancedFilterFieldIndex === 0) {
              setEntryType(cycleValue(ENTRY_TYPE_VALUES, filterState.entryType, delta));
            } else if (advancedFilterFieldIndex === 1) {
              updateAdvancedFilter({ role: cycleValue(ROLE_VALUES, advancedFilterState.role, delta) });
            } else if (advancedFilterFieldIndex === 2) {
              updateAdvancedFilter({ toolCategory: cycleValue(TOOL_CATEGORY_VALUES, advancedFilterState.toolCategory, delta) });
            } else if (advancedFilterFieldIndex === 4) {
              updateAdvancedFilter({ onlyErrors: delta > 0 ? true : false });
            }
          } else {
            if (advancedFilterFieldIndex === 0) {
              setAllEventsFilter((prev) => ({ ...prev, timeWindow: cycleValue(TIME_WINDOW_VALUES, prev.timeWindow, delta) }));
            } else if (advancedFilterFieldIndex === 1) {
              setAllEventsFilter((prev) => ({ ...prev, eventType: cycleValue(EVENT_TYPE_VALUES, prev.eventType, delta) }));
            } else if (advancedFilterFieldIndex === 2) {
              setAllEventsFilter((prev) => ({ ...prev, toolCategory: cycleValue(TOOL_CATEGORY_VALUES, prev.toolCategory, delta) }));
            } else if (advancedFilterFieldIndex === 4) {
              setAllEventsFilter((prev) => ({ ...prev, onlyErrors: delta > 0 ? true : false }));
            }
          }
          return;
        }
      }
      return;
    }

    if (!isAdvancedFilterOpen && (key.ctrl || key.meta) && key.name === "p") {
      setIsPaletteOpen(true);
      setPaletteQuery("");
      setPaletteIndex(0);
      return;
    }

    if (!isAdvancedFilterOpen && key.name === "backspace") {
      void goBack();
      return;
    }

    if (!isAdvancedFilterOpen && (key.name === "q" || (key.ctrl && key.name === "c"))) {
      renderer.destroy();
      return;
    }

    if (!isAdvancedFilterOpen && key.name === "/") {
      if (view !== "all-events") {
        pushSnapshot();
        void loadAllEvents();
        setView("all-events");
        setAllEventsSelectedIndex(0);
      }
      setFilterModalMode("all-events");
      setAdvancedFilterFieldIndex(5);
      setIsAdvancedFilterEditing(true);
      setIsAdvancedFilterOpen(true);
      return;
    }

    if (!isAdvancedFilterOpen && ((key.shift && key.name === "f") || key.name === "F")) {
      setFilterModalMode(view === "all-events" ? "all-events" : "entries");
      setAdvancedFilterFieldIndex(0);
      setIsAdvancedFilterEditing(false);
      setIsAdvancedFilterOpen(true);
      return;
    }

    if (!isAdvancedFilterOpen && key.name === "f" && !(key.shift || key.ctrl || key.meta)) {
      setShowFilterBar((prev) => !prev);
      return;
    }

    if (!isAdvancedFilterOpen && key.name === "t" && view === "entries") {
      cycleEntryType();
      return;
    }

    if (!isAdvancedFilterOpen && key.name === "escape") {
      if (searchFocused) {
        setSearchFocused(false);
        setSearchQuery("");
        return;
      }
      if (showFilterBar) {
        setShowFilterBar(false);
        return;
      }
      if (view === "entries" || view === "all-events") {
        void goBack();
      }
      return;
    }

    if (!isAdvancedFilterOpen && key.name === "r") {
      refresh();
      return;
    }

    if (!isAdvancedFilterOpen && key.name === "a" && view === "sessions") {
      pushSnapshot();
      void loadAllEvents();
      setView("all-events");
      setAllEventsSelectedIndex(0);
      return;
    }

    if (!isAdvancedFilterOpen && key.name === "tab") {
      if (focusPanel === "sidebar") setFocusPanel("content");
      else setFocusPanel("sidebar");
      return;
    }

    if (!isAdvancedFilterOpen && view === "sessions") {
      if (focusPanel === "sidebar") {
        if (key.name === "up" || key.name === "k") {
          setSelectedAgentIndex((i) => Math.max(0, i - 1));
        } else if (key.name === "down" || key.name === "j") {
          setSelectedAgentIndex((i) => Math.min(agents.length - 1, i + 1));
        } else if (key.name === "enter" || key.name === "return" || key.name === "right") {
          setFocusPanel("content");
        }
      }

      if (focusPanel === "content") {
        if (key.name === "up" || key.name === "k") {
          setSelectedSessionIndex((i) => Math.max(0, i - 1));
        } else if (key.name === "down" || key.name === "j") {
          setSelectedSessionIndex((i) => Math.min(filteredSessions.length - 1, i + 1));
        } else if ((key.name === "enter" || key.name === "return") && filteredSessions[selectedSessionIndex]) {
          void openSessionEntries(filteredSessions[selectedSessionIndex], 0);
        } else if (key.name === "g") {
          setSelectedSessionIndex(0);
        } else if (key.shift && key.name === "g") {
          setSelectedSessionIndex(filteredSessions.length - 1);
        }
      }
    } else if (!isAdvancedFilterOpen && view === "entries") {
      if (!searchFocused) {
        if (key.name === "up" || key.name === "k") {
          setSelectedEntryIndex((i) => Math.max(0, i - 1));
        } else if (key.name === "down" || key.name === "j") {
          setSelectedEntryIndex((i) => Math.min(filteredEntries.length - 1, i + 1));
        } else if (key.name === "pageup") {
          setSelectedEntryIndex((i) => Math.max(0, i - PAGE_STEP));
        } else if (key.name === "pagedown") {
          setSelectedEntryIndex((i) => Math.min(filteredEntries.length - 1, i + PAGE_STEP));
        } else if (key.name === "g") {
          setSelectedEntryIndex(0);
        } else if (key.shift && key.name === "g") {
          setSelectedEntryIndex(filteredEntries.length - 1);
        }
      }
    } else if (!isAdvancedFilterOpen && view === "all-events") {
      if (key.name === "up" || key.name === "k") {
        setAllEventsSelectedIndex((i) => Math.max(0, i - 1));
      } else if (key.name === "down" || key.name === "j") {
        setAllEventsSelectedIndex((i) => Math.min(filteredAllEvents.length - 1, i + 1));
      } else if (key.name === "pageup") {
        setAllEventsSelectedIndex((i) => Math.max(0, i - PAGE_STEP));
      } else if (key.name === "pagedown") {
        setAllEventsSelectedIndex((i) => Math.min(filteredAllEvents.length - 1, i + PAGE_STEP));
      } else if (key.name === "g") {
        setAllEventsSelectedIndex(0);
      } else if (key.shift && key.name === "g") {
        setAllEventsSelectedIndex(filteredAllEvents.length - 1);
      } else if (key.name === "b") {
        setHistogramBucketIndex((i) => (i + 1) % HISTOGRAM_BUCKET_OPTIONS.length);
      } else if (key.name === "v") {
        setAllEventsScope((scope) => (scope === "global" ? "agent" : "global"));
        setAllEventsSelectedIndex(0);
      } else if ((key.name === "enter" || key.name === "return") && filteredAllEvents[allEventsSelectedIndex]) {
        const selectedEvent = filteredAllEvents[allEventsSelectedIndex];
        const summary = sessions.find((s) => s.agentName === selectedEvent.agentName && s.filePath === selectedEvent.sessionFilePath);
        if (summary) {
          void openSessionEntries(summary, 0);
        }
      }
    }
  });

  useEffect(() => {
    setAllEventsSelectedIndex((i) => Math.min(i, Math.max(0, filteredAllEvents.length - 1)));
  }, [filteredAllEvents.length]);

  useEffect(() => {
    setSelectedSessionIndex(0);
  }, [selectedAgentIndex]);

  const handleSelectSession = useCallback(
    (session: SessionSummary) => {
      void openSessionEntries(session, 0);
    },
    [openSessionEntries]
  );

  const handleSelectAgent = useCallback((index: number) => {
    setSelectedAgentIndex(index);
    setFocusPanel("content");
  }, []);

  const handleSelectEntry = useCallback((index: number) => {
    setSelectedEntryIndex(index);
  }, []);

  const handleSelectAllEvent = useCallback((index: number) => {
    setAllEventsSelectedIndex(index);
  }, []);

  const breadcrumbs = useMemo(() => {
    const items: Array<{ label: string; onClick?: () => void }> = [
      { label: "Sessions", onClick: () => setView("sessions") },
    ];
    if (selectedAgent) items.push({ label: selectedAgent.name, onClick: () => setView("sessions") });
    if (view === "entries" && currentSession) {
      items.push({ label: currentSession.id.slice(0, 8) });
    }
    if (view === "all-events") {
      items.push({ label: "All Events" });
    }
    return items;
  }, [selectedAgent, view, currentSession]);

  if (isLoading && sessions.length === 0) {
    return (
      <Layout>
        <box flexGrow={1} alignItems="center" justifyContent="center">
          <text><span fg={colors.textMuted}>Loading sessions...</span></text>
        </box>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <box flexGrow={1} alignItems="center" justifyContent="center">
          <text><span fg={colors.error}>Error: {error}</span></text>
        </box>
      </Layout>
    );
  }

  return (
    <Layout
      subtitle={view === "entries" ? currentSession?.id.slice(0, 8) : undefined}
      currentView={view}
      focusPanel={focusPanel}
    >
      <BreadcrumbBar items={breadcrumbs} />

      {view === "sessions" && (
        <box flexDirection="row" flexGrow={1}>
          <AgentList
            agents={agents}
            selectedIndex={selectedAgentIndex}
            onSelect={handleSelectAgent}
            isFocused={focusPanel === "sidebar"}
          />
          <SessionList
            sessions={filteredSessions}
            selectedIndex={selectedSessionIndex}
            onSelect={handleSelectSession}
            isFocused={focusPanel === "content"}
          />
        </box>
      )}

      {view === "entries" && currentSession && (
        <box flexDirection="column" flexGrow={1}>
          <FilterBar
            entryType={filterState.entryType}
            searchQuery={filterState.searchQuery}
            onEntryTypeChange={setEntryType}
            onSearchChange={setSearchQuery}
            isVisible={showFilterBar}
            isSearchFocused={searchFocused}
            onFocusSearch={() => setSearchFocused(true)}
          />
          <EntryViewer
            session={currentSession}
            entries={filteredEntries}
            selectedIndex={selectedEntryIndex}
            onSelectEntry={handleSelectEntry}
            isFocused={!searchFocused}
          />
        </box>
      )}

      {view === "all-events" && (
        <AllEventsViewer
          events={filteredAllEvents}
          selectedIndex={allEventsSelectedIndex}
          onSelectEvent={handleSelectAllEvent}
          isFocused
          isLoading={allEventsLoading}
          histogramBuckets={histogramBuckets}
          scopeLabel={
            allEventsScope === "global"
              ? "Global (all agents)"
              : `Agent only (${selectedAgent?.name ?? "none"})`
          }
        />
      )}

      <CommandPalette
        isOpen={isPaletteOpen}
        query={paletteQuery}
        onQueryChange={setPaletteQuery}
        commands={paletteCommands}
        selectedIndex={paletteIndex}
        onSelectIndex={setPaletteIndex}
      />

      <AdvancedFilterModal
        isOpen={isAdvancedFilterOpen}
        mode={filterModalMode}
        activeFieldIndex={advancedFilterFieldIndex}
        isEditingField={isAdvancedFilterEditing}
        entryFilter={{
          entryType: filterState.entryType,
          role: advancedFilterState.role,
          toolCategory: advancedFilterState.toolCategory,
          toolNameQuery: advancedFilterState.toolNameQuery,
          onlyErrors: advancedFilterState.onlyErrors,
          query: filterState.searchQuery,
        }}
        allEventsFilter={allEventsFilter}
      />
    </Layout>
  );
}
