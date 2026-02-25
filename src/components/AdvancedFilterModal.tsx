import type { EntryTypeFilter, ToolCategory } from "../types";
import { colors } from "../constants/colors";

export type TimeWindow = "15m" | "1h" | "6h" | "24h" | "all";

export interface AdvancedEntryFilter {
  entryType: EntryTypeFilter;
  role: "all" | "user" | "assistant" | "toolResult";
  toolCategory: "all" | ToolCategory;
  toolNameQuery: string;
  onlyErrors: boolean;
  query: string;
}

export interface AdvancedAllEventsFilter {
  timeWindow: TimeWindow;
  eventType: "all" | "message" | "session" | "model_change" | "thinking_level_change" | "custom" | "compaction";
  toolCategory: "all" | ToolCategory;
  toolNameQuery: string;
  onlyErrors: boolean;
  query: string;
}

interface AdvancedFilterModalProps {
  isOpen: boolean;
  mode: "entries" | "all-events";
  activeFieldIndex: number;
  isEditingField: boolean;
  entryFilter: AdvancedEntryFilter;
  allEventsFilter: AdvancedAllEventsFilter;
}

function Row({
  active,
  label,
  value,
  editing,
}: {
  active: boolean;
  label: string;
  value: string;
  editing: boolean;
}) {
  return (
    <box height={1} paddingLeft={1}>
      <text>
        <span fg={active ? colors.accent : colors.textMuted}>{active ? ">" : " "}</span>
        <span fg={active ? colors.textPrimary : colors.textMuted}>{` ${label}: `}</span>
        <span fg={active ? (editing ? colors.warning : colors.selectedFg) : colors.textSecondary}>{value}</span>
        {active && editing && <span fg={colors.textDim}>  [editing]</span>}
      </text>
    </box>
  );
}

export function AdvancedFilterModal({
  isOpen,
  mode,
  activeFieldIndex,
  isEditingField,
  entryFilter,
  allEventsFilter,
}: AdvancedFilterModalProps) {
  if (!isOpen) return null;

  const rows =
    mode === "entries"
      ? [
          { label: "Entry Type", value: entryFilter.entryType },
          { label: "Role", value: entryFilter.role },
          { label: "Tool Category", value: entryFilter.toolCategory },
          { label: "Tool Name Contains", value: entryFilter.toolNameQuery || "(empty)" },
          { label: "Errors", value: entryFilter.onlyErrors ? "only" : "all" },
          { label: "Free Text", value: entryFilter.query || "(empty)" },
        ]
      : [
          { label: "Time Window", value: allEventsFilter.timeWindow },
          { label: "Event Type", value: allEventsFilter.eventType },
          { label: "Tool Category", value: allEventsFilter.toolCategory },
          { label: "Tool Name Contains", value: allEventsFilter.toolNameQuery || "(empty)" },
          { label: "Errors", value: allEventsFilter.onlyErrors ? "only" : "all" },
          { label: "Free Text", value: allEventsFilter.query || "(empty)" },
        ];

  return (
    <box
      position="absolute"
      top={4}
      left={8}
      right={8}
      zIndex={30}
      border
      borderStyle="single"
      borderColor={colors.borderFocus}
      backgroundColor={colors.panelBg}
      flexDirection="column"
    >
      <box height={1} paddingLeft={1} backgroundColor={colors.panelHeaderActive}>
        <text><span fg={colors.selectedFg}>{mode === "entries" ? "Advanced Entry Filters" : "Advanced All Events Filters"}</span></text>
      </box>

      <box flexDirection="column" paddingTop={1} paddingBottom={1}>
        {rows.map((row, index) => (
          <Row
            key={row.label}
            active={index === activeFieldIndex}
            editing={isEditingField && index === activeFieldIndex}
            label={row.label}
            value={row.value}
          />
        ))}
      </box>

      <box height={1} paddingLeft={1} backgroundColor={colors.footerBg}>
        <text><span fg={colors.textMuted}>Up/Down: field | Enter: edit/apply | Up/Down in edit: cycle | type text | Backspace | Esc</span></text>
      </box>
    </box>
  );
}
