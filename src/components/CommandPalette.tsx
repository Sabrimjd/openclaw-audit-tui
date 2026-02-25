import { colors } from "../constants/colors";

export interface PaletteCommand {
  id: string;
  title: string;
  subtitle?: string;
  onRun: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  commands: PaletteCommand[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
}

export function CommandPalette({
  isOpen,
  query,
  onQueryChange,
  commands,
  selectedIndex,
  onSelectIndex,
}: CommandPaletteProps) {
  if (!isOpen) return null;

  return (
    <box
      position="absolute"
      top={2}
      left={6}
      right={6}
      bottom={4}
      zIndex={20}
      border
      borderStyle="single"
      borderColor={colors.borderFocus}
      backgroundColor={colors.panelBg}
      flexDirection="column"
    >
      <box height={1} paddingLeft={1} backgroundColor={colors.panelHeaderActive}>
        <text><span fg={colors.selectedFg}>Command Palette</span></text>
      </box>
      <box height={2} paddingLeft={1} paddingRight={1} flexDirection="row" alignItems="center">
        <text><span fg={colors.textMuted}>Query:</span></text>
        <box width={1} />
        <input
          value={query}
          onChange={onQueryChange}
          focused
          placeholder="type command, agent, session..."
          textColor={colors.textPrimary}
          backgroundColor={colors.bgPrimary}
          width={48}
        />
      </box>
      <scrollbox flexGrow={1} focused={false}>
        <box flexDirection="column">
          {commands.map((command, index) => {
            const selected = index === selectedIndex;
            return (
              <box
                key={command.id}
                height={2}
                paddingLeft={1}
                backgroundColor={selected ? colors.selectedBg : "transparent"}
                onMouseDown={() => onSelectIndex(index)}
              >
                <text>
                  <span fg={selected ? colors.selectedFg : colors.textPrimary}>{command.title}</span>
                  {command.subtitle && (
                    <span fg={selected ? colors.selectedMuted : colors.textMuted}>{`  ${command.subtitle}`}</span>
                  )}
                </text>
              </box>
            );
          })}
        </box>
      </scrollbox>
      <box height={1} paddingLeft={1} backgroundColor={colors.footerBg}>
        <text><span fg={colors.textMuted}>Enter: run | Esc: close | j/k: navigate</span></text>
      </box>
    </box>
  );
}
