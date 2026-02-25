import type { SessionSummary } from "../types";
import { colors } from "../constants/colors";

interface SessionListProps {
  sessions: SessionSummary[];
  selectedIndex: number;
  onSelect: (session: SessionSummary) => void;
  isFocused: boolean;
}

export function SessionList({
  sessions,
  selectedIndex,
  onSelect,
  isFocused,
}: SessionListProps) {
  const focusIndicator = isFocused ? "[*]" : "[ ]";
  const oneHourMs = 60 * 60 * 1000;

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
        <text><span fg={isFocused ? colors.selectedFg : colors.textSecondary}>{focusIndicator} Sessions ({sessions.length})</span></text>
      </box>

      {/* Table header */}
      <box
        flexDirection="row"
        height={1}
        paddingLeft={1}
        backgroundColor={colors.tableHeaderBg}
      >
        <box width={13}>
          <text><span fg={colors.textMuted}>Agent</span></text>
        </box>
        <box width={8}>
          <text><span fg={colors.textMuted}>Started</span></text>
        </box>
        <box width={8}>
          <text><span fg={colors.textMuted}>Last</span></text>
        </box>
        <box width={8}>
          <text><span fg={colors.textMuted}>Events</span></text>
        </box>
        <box width={10}>
          <text><span fg={colors.textMuted}>Msgs</span></text>
        </box>
        <box width={8}>
          <text><span fg={colors.textMuted}>Tools</span></text>
        </box>
        <box width={6}>
          <text><span fg={colors.textMuted}>Err</span></text>
        </box>
        <box width={10}>
          <text><span fg={colors.textMuted}>Prov</span></text>
        </box>
        <box width={18}>
          <text><span fg={colors.textMuted}>Model</span></text>
        </box>
        <box width={10}>
          <text><span fg={colors.textMuted}>Tokens</span></text>
        </box>
        <box flexGrow={1}>
          <text><span fg={colors.textMuted}>Flags</span></text>
        </box>
      </box>

      {/* Session list */}
      <scrollbox flexGrow={1} focused={false}>
        <box flexDirection="column">
          {sessions.map((session, index) => {
            const isSelected = index === selectedIndex && isFocused;
            const flags = session.flags.map((f) => `[${f}]`).join("");
            const agentName = session.agentName.slice(0, 11);
            const model = session.model.slice(0, 16);
            const provider = session.provider.slice(0, 8);
            const toolRatio = `${session.toolCallCount}/${session.toolResultCount}`;
            const isRecentlyActive = Date.now() - session.lastActivity.getTime() < oneHourMs;
            const textCol = isSelected ? colors.selectedFg : colors.textSecondary;
            const dimCol = isSelected ? colors.selectedMuted : colors.textMuted;
            const warnCol = isSelected ? colors.selectedFg : session.errorCount > 0 ? colors.error : colors.textMuted;

            return (
              <box
                key={session.filePath}
                height={1}
                paddingLeft={1}
                flexDirection="row"
                backgroundColor={isSelected ? colors.selectedBg : "transparent"}
                onMouseDown={() => onSelect(session)}
              >
                <box width={13}>
                  <text><span fg={textCol}>{isSelected ? "> " : "  "}{agentName}</span></text>
                </box>
                <box width={8}>
                  <text><span fg={dimCol}>{session.startedAge}</span></text>
                </box>
                <box width={8}>
                  <text><span fg={textCol}>{session.lastActivityAge}</span></text>
                </box>
                <box width={8}>
                  <text><span fg={textCol}>{session.eventCount}</span></text>
                </box>
                <box width={10}>
                  <text><span fg={dimCol}>{session.messageCount}</span></text>
                </box>
                <box width={8}>
                  <text><span fg={dimCol}>{toolRatio}</span></text>
                </box>
                <box width={6}>
                  <text><span fg={warnCol}>{session.errorCount}</span></text>
                </box>
                <box width={10}>
                  <text><span fg={dimCol}>{provider}</span></text>
                </box>
                <box width={18}>
                  <text><span fg={textCol}>{model}</span></text>
                </box>
                <box width={10}>
                  <text><span fg={textCol}>{session.tokens}</span></text>
                </box>
                <box flexGrow={1}>
                  <text>
                    {isRecentlyActive && (
                      <span fg={isSelected ? colors.selectedFg : colors.success}>[active]</span>
                    )}
                    {isRecentlyActive && flags && <span fg={dimCol}> </span>}
                    {session.compactionCount > 0 && (
                      <span fg={isSelected ? colors.selectedFg : colors.info}>{`[cmp:${session.compactionCount}]`}</span>
                    )}
                    {session.compactionCount > 0 && flags && <span fg={dimCol}> </span>}
                    <span fg={dimCol}>{flags}</span>
                  </text>
                </box>
              </box>
            );
          })}
        </box>
      </scrollbox>
    </box>
  );
}
