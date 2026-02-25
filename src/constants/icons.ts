import type { AuditEntry } from "../types";

type IconSet = {
  user: string;
  assistant: string;
  toolResult: string;
  session: string;
  modelChange: string;
  thinkingLevel: string;
  custom: string;
  compaction: string;
  unknown: string;
};

const asciiIcons: IconSet = {
  user: "U",
  assistant: "A",
  toolResult: "R",
  session: "S",
  modelChange: "M",
  thinkingLevel: "T",
  custom: "C",
  compaction: "X",
  unknown: "?",
};

const nerdIcons: IconSet = {
  user: "",
  assistant: "",
  toolResult: "",
  session: "󰒲",
  modelChange: "",
  thinkingLevel: "󰋗",
  custom: "",
  compaction: "",
  unknown: "",
};

function detectNerdFontSupport(): boolean {
  const mode = process.env.AUDIT_TUI_ICON_MODE?.toLowerCase();
  if (mode === "ascii") return false;
  if (mode === "nerd") return true;

  if (process.env.AUDIT_TUI_ASCII === "1") return false;
  if (process.env.CI === "true") return false;

  const term = process.env.TERM?.toLowerCase() ?? "";
  if (term === "linux") return false;

  return true;
}

export function isUsingNerdIcons(): boolean {
  return detectNerdFontSupport();
}

export function getIconSet(): IconSet {
  return detectNerdFontSupport() ? nerdIcons : asciiIcons;
}

export function getEntryIcon(entry: AuditEntry): string {
  const icons = getIconSet();
  switch (entry.type) {
    case "session":
      return icons.session;
    case "model_change":
      return icons.modelChange;
    case "thinking_level_change":
      return icons.thinkingLevel;
    case "custom":
      return icons.custom;
    case "compaction":
      return icons.compaction;
    case "message":
      if (entry.message.role === "user") return icons.user;
      if (entry.message.role === "assistant") return icons.assistant;
      if (entry.message.role === "toolResult") return icons.toolResult;
      return icons.unknown;
    default:
      return icons.unknown;
  }
}
