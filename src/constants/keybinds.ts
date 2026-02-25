// Keyboard shortcuts
export const keybinds = {
  // Navigation
  up: ["up", "k"],
  down: ["down", "j"],
  left: ["left", "h"],
  right: ["right", "l"],
  pageUp: ["pageup"],
  pageDown: ["pagedown"],
  goToTop: ["g"],
  goToBottom: ["G"],

  // Actions
  select: ["enter"],
  back: ["escape"],
  quit: ["q"],
  refresh: ["r"],
  help: ["?"],

  // Panels
  focusSidebar: ["1"],
  focusContent: ["2"],
  focusFilter: ["3"],
  nextPanel: ["tab"],
  prevPanel: ["shift+tab"],

  // Filter
  toggleFilter: ["f"],
  focusSearch: ["/"],
  clearSearch: ["escape"],

  // Entry types
  filterAll: ["a"],
  filterUser: ["u"],
  filterAssistant: ["s"],
  filterTool: ["t"],
};

// Help text for footer
export const helpText = [
  { key: "j/k", action: "Navigate" },
  { key: "Enter", action: "Select" },
  { key: "Ctrl+P", action: "Palette" },
  { key: "Shift+F", action: "Advanced Filter" },
  { key: "Backspace", action: "Backstack" },
  { key: "Esc", action: "Back" },
  { key: "a", action: "All Events" },
  { key: "/", action: "Search" },
  { key: "f", action: "Filter" },
  { key: "q", action: "Quit" },
];

// Format help text for display
export function formatHelpText(): string {
  return helpText.map((h) => `${h.key}: ${h.action}`).join(" | ");
}
