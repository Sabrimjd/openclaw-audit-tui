import type { ReactNode } from "react";
import { colors } from "../constants/colors";
import { formatHelpText } from "../constants/keybinds";

interface LayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  showHelp?: boolean;
  currentView?: "sessions" | "entries" | "all-events";
  focusPanel?: "sidebar" | "content" | "filter";
}

const VERSION = "0.2.0";

export function Layout({
  children,
  title = "OpenClaw Audit TUI",
  subtitle,
  showHelp = true,
  currentView = "sessions",
  focusPanel = "content",
}: LayoutProps) {
  // Build status line showing current navigation state
  const viewLabel = currentView === "sessions" ? "Tree View" : currentView === "all-events" ? "All View" : "Entries";
  const panelLabel =
    focusPanel === "sidebar" ? "[Agents]" : focusPanel === "filter" ? "[Filter]" : "[List]";
  const statusLine = `${viewLabel} > ${panelLabel}`;

  return (
    <box
      flexDirection="column"
      flexGrow={1}
      backgroundColor={colors.bgPrimary}
    >
      {/* Header with status */}
      <box
        flexDirection="row"
        height={1}
        paddingLeft={1}
        paddingRight={1}
        backgroundColor={colors.panelHeaderBg}
      >
        <text><span fg={colors.textPrimary}>{title} v{VERSION}</span></text>
        {subtitle && (
          <text><span fg={colors.textMuted}> | {subtitle}</span></text>
        )}
        <box flexGrow={1} />
        <text><span fg={colors.accent}>{statusLine}</span></text>
      </box>

      {/* Main content */}
      <box flexDirection="column" flexGrow={1}>
        {children}
      </box>

      {/* Footer */}
      {showHelp && (
        <box
          height={1}
          paddingLeft={1}
          paddingRight={1}
          backgroundColor={colors.footerBg}
        >
          <text><span fg={colors.textSecondary}>{formatHelpText()}</span></text>
        </box>
      )}
    </box>
  );
}
