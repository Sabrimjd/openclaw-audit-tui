export const colors = {
  // Foundation
  bgPrimary: "#0f1720",
  bgSecondary: "#152131",
  bgHighlight: "#27445f",
  bgSelected: "#1f4b6b",

  // Surfaces
  panelBg: "#152131",
  panelHeaderBg: "#1b2b40",
  panelHeaderActive: "#27445f",
  tableHeaderBg: "#122133",
  footerBg: "#122133",

  // Text
  textPrimary: "#d8e6f5",
  textSecondary: "#9db2c7",
  textMuted: "#74879b",
  textDim: "#55687b",

  // Selection
  selectedBg: "#1f4b6b",
  selectedFg: "#eef6ff",
  selectedMuted: "#c7dcf4",

  // Entry type icon colors
  typeUser: "#7dd3fc",
  typeAssistant: "#86efac",
  typeToolResult: "#fcd34d",
  typeSystem: "#d8e6f5",
  typeWarning: "#fb923c",

  // Status
  success: "#34d399",
  warning: "#f59e0b",
  error: "#f87171",
  info: "#38bdf8",

  // Borders
  borderNormal: "#32465d",
  borderFocus: "#22d3ee",
  borderActive: "#38bdf8",

  // Accent
  accent: "#22d3ee",
  accentDim: "#155e75",

  // Role specific
  roleUser: "#7dd3fc",
  roleAssistant: "#86efac",
  roleTool: "#fcd34d",
};

// Get color for entry icon - returns the color for the icon only
export function getEntryColor(entry: { type: string; message?: { role?: string } }): string {
  if (entry.type === "message" && entry.message) {
    switch (entry.message.role) {
      case "user": return colors.typeUser;        // cyan
      case "assistant": return colors.typeAssistant; // green
      case "toolResult": return colors.typeToolResult; // yellow
    }
  }
  switch (entry.type) {
    case "session": return colors.typeSystem;     // white
    case "model_change": return colors.typeWarning; // yellow
    case "thinking_level_change": return colors.typeWarning; // yellow
    case "compaction": return colors.typeWarning; // yellow
    case "custom": return colors.typeSystem;      // white
    default: return colors.textSecondary;
  }
}
