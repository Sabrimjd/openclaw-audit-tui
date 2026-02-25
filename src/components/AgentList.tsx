import type { Agent } from "../types";
import { colors } from "../constants/colors";

interface AgentListProps {
  agents: Agent[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  isFocused: boolean;
}

export function AgentList({
  agents,
  selectedIndex,
  onSelect,
  isFocused,
}: AgentListProps) {
  // Calculate total sessions
  const totalSessions = agents.reduce((sum, a) => sum + a.sessionCount, 0);
  const focusIndicator = isFocused ? "[*]" : "[ ]";

  return (
    <box
      flexDirection="column"
      width={22}
      backgroundColor={colors.panelBg}
      border
      borderStyle="single"
      borderColor={isFocused ? colors.borderFocus : colors.borderNormal}
    >
      {/* Header with focus indicator */}
      <box
        height={1}
        paddingLeft={1}
        backgroundColor={isFocused ? colors.panelHeaderActive : colors.panelHeaderBg}
      >
        <text><span fg={isFocused ? colors.selectedFg : colors.textSecondary}>{focusIndicator} Agents ({agents.length})</span></text>
      </box>

      {/* Summary */}
      <box
        height={1}
        paddingLeft={1}
        backgroundColor={colors.tableHeaderBg}
      >
        <text><span fg={colors.textMuted}>{`Total: ${totalSessions} sessions`}</span></text>
      </box>

      {/* Agent list */}
      <scrollbox flexGrow={1} focused={false}>
        <box flexDirection="column">
          {agents.map((agent, index) => {
            const isSelected = index === selectedIndex && isFocused;
            const prefix = isSelected ? "> " : "  ";
            const name = agent.name.slice(0, 14);
            const count = agent.sessionCount;
            const textColor = isSelected ? colors.selectedFg : colors.textSecondary;

            return (
              <box
                key={agent.name}
                height={1}
                paddingLeft={1}
                backgroundColor={isSelected ? colors.selectedBg : "transparent"}
                onMouseDown={() => onSelect(index)}
              >
                <text><span fg={textColor}>{prefix}{name} ({count})</span></text>
              </box>
            );
          })}
        </box>
      </scrollbox>
    </box>
  );
}
