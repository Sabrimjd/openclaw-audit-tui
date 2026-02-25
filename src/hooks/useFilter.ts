import { useState, useMemo, useCallback } from "react";
import type { AuditEntry, EntryTypeFilter, FilterState } from "../types";
import { fuzzyMatch, getToolCategory } from "../lib/utils";

export interface AdvancedFilterState {
  toolCategory: "all" | "file" | "search" | "exec" | "web" | "subagent" | "mcp" | "other";
  toolNameQuery: string;
  onlyErrors: boolean;
  role: "all" | "user" | "assistant" | "toolResult";
}

export function useFilter(entries: AuditEntry[]) {
  const [filterState, setFilterState] = useState<FilterState>({
    entryType: "all",
    searchQuery: "",
  });
  const [advancedFilterState, setAdvancedFilterState] = useState<AdvancedFilterState>({
    toolCategory: "all",
    toolNameQuery: "",
    onlyErrors: false,
    role: "all",
  });

  // Filter entries based on current filter state
  const filteredEntries = useMemo(() => {
    let result = entries;

    // Filter by entry type
    if (filterState.entryType !== "all") {
      result = result.filter((entry) => {
        if (entry.type !== "message") return filterState.entryType === "system";

        switch (filterState.entryType) {
          case "user":
            return entry.message.role === "user";
          case "assistant":
            return entry.message.role === "assistant";
          case "tool":
            return entry.message.role === "toolResult";
          default:
            return true;
        }
      });
    }

    // Filter by search query
    if (filterState.searchQuery) {
      const query = filterState.searchQuery.toLowerCase();
      result = result.filter((entry) => {
        if (entry.type === "message") {
          const textContent = entry.message.content
            .filter((b) => b.type === "text")
            .map((b) => (b as any).text || "")
            .join(" ")
            .toLowerCase();
          if (fuzzyMatch(textContent, query)) return true;

          // Also search in tool names
          const toolCalls = entry.message.content
            .filter((b) => b.type === "toolCall")
            .map((b) => (b as any).name || "");
          if (toolCalls.some((name) => fuzzyMatch(name.toLowerCase(), query))) {
            return true;
          }
        }
        return false;
      });
    }

    // Filter by role
    if (advancedFilterState.role !== "all") {
      result = result.filter((entry) => {
        if (entry.type !== "message") return false;
        return entry.message.role === advancedFilterState.role;
      });
    }

    // Filter only errors
    if (advancedFilterState.onlyErrors) {
      result = result.filter((entry) =>
        entry.type === "message" && entry.message.role === "toolResult" && Boolean(entry.message.isError)
      );
    }

    // Filter tool category
    if (advancedFilterState.toolCategory !== "all") {
      result = result.filter((entry) => {
        if (entry.type !== "message") return false;
        if (entry.message.role === "assistant") {
          return entry.message.content.some(
            (block) =>
              block.type === "toolCall" &&
              getToolCategory(block.name) === advancedFilterState.toolCategory
          );
        }
        if (entry.message.role === "toolResult") {
          return getToolCategory(entry.message.toolName ?? "") === advancedFilterState.toolCategory;
        }
        return false;
      });
    }

    if (advancedFilterState.toolNameQuery.trim()) {
      const toolNeedle = advancedFilterState.toolNameQuery.toLowerCase();
      result = result.filter((entry) => {
        if (entry.type !== "message") return false;
        if (entry.message.role === "assistant") {
          return entry.message.content.some(
            (block) => block.type === "toolCall" && fuzzyMatch(block.name.toLowerCase(), toolNeedle)
          );
        }
        if (entry.message.role === "toolResult") {
          return fuzzyMatch((entry.message.toolName ?? "").toLowerCase(), toolNeedle);
        }
        return false;
      });
    }

    return result;
  }, [entries, filterState, advancedFilterState]);

  // Set entry type filter
  const setEntryType = useCallback((type: EntryTypeFilter) => {
    setFilterState((prev) => ({ ...prev, entryType: type }));
  }, []);

  // Set search query
  const setSearchQuery = useCallback((query: string) => {
    setFilterState((prev) => ({ ...prev, searchQuery: query }));
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilterState({
      entryType: "all",
      searchQuery: "",
    });
    setAdvancedFilterState({
      toolCategory: "all",
      toolNameQuery: "",
      onlyErrors: false,
      role: "all",
    });
  }, []);

  // Toggle entry type filter (cycle through options)
  const cycleEntryType = useCallback(() => {
    const types: EntryTypeFilter[] = ["all", "user", "assistant", "tool"];
    const currentIndex = types.indexOf(filterState.entryType);
    const nextIndex = (currentIndex + 1) % types.length;
    const nextType = types[nextIndex] ?? "all";
    setEntryType(nextType);
  }, [filterState.entryType, setEntryType]);

  const updateAdvancedFilter = useCallback((update: Partial<AdvancedFilterState>) => {
    setAdvancedFilterState((prev) => ({ ...prev, ...update }));
  }, []);

  return {
    filterState,
    filteredEntries,
    setEntryType,
    setSearchQuery,
    clearFilters,
    cycleEntryType,
    advancedFilterState,
    updateAdvancedFilter,
  };
}
