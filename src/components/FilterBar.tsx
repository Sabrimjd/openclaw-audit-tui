import type { EntryTypeFilter } from "../types";
import { colors } from "../constants/colors";

interface FilterBarProps {
  entryType: EntryTypeFilter;
  searchQuery: string;
  onEntryTypeChange: (type: EntryTypeFilter) => void;
  onSearchChange: (query: string) => void;
  isVisible: boolean;
  isSearchFocused: boolean;
  onFocusSearch: () => void;
}

const entryTypes: { value: EntryTypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "user", label: "User" },
  { value: "assistant", label: "Assistant" },
  { value: "tool", label: "Tool" },
];

export function FilterBar({
  entryType,
  searchQuery,
  onEntryTypeChange,
  onSearchChange,
  isVisible,
  isSearchFocused,
  onFocusSearch,
}: FilterBarProps) {
  if (!isVisible) return null;

  // Build tabs text
  const tabsText = entryTypes
    .map((type) => {
      const isSelected = entryType === type.value;
      return isSelected ? `◉ ${type.label}` : `○ ${type.label}`;
    })
    .join("  ");

  return (
    <box
      flexDirection="row"
      height={3}
      paddingLeft={1}
      paddingRight={1}
      backgroundColor={colors.panelBg}
      border
      borderStyle="single"
      borderColor={isSearchFocused ? colors.borderFocus : colors.borderNormal}
    >
      {/* Entry type tabs */}
      <box flexDirection="column">
        <box height={1}>
          <text><span fg={colors.textPrimary}>{tabsText}</span></text>
        </box>
        <box height={1}>
          <text><span fg={colors.textMuted}>Search:</span></text>
        </box>
      </box>

      {/* Search input */}
      <box flexGrow={1} flexDirection="column">
        <box height={1} />
        <box height={1} flexGrow={1}>
          <input
            value={searchQuery}
            onChange={onSearchChange}
            placeholder="Type to filter..."
            focused={isSearchFocused}
            textColor={colors.textPrimary}
            backgroundColor={colors.tableHeaderBg}
            width={40}
          />
        </box>
      </box>
    </box>
  );
}
