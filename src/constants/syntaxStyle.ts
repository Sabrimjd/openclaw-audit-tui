import { RGBA, SyntaxStyle } from "@opentui/core";

export const syntaxStyle = SyntaxStyle.fromStyles({
  keyword: { fg: RGBA.fromHex("#7dd3fc"), bold: true },
  string: { fg: RGBA.fromHex("#86efac") },
  number: { fg: RGBA.fromHex("#fbbf24") },
  type: { fg: RGBA.fromHex("#c4b5fd") },
  function: { fg: RGBA.fromHex("#67e8f9") },
  property: { fg: RGBA.fromHex("#93c5fd") },
  comment: { fg: RGBA.fromHex("#64748b"), italic: true },
  operator: { fg: RGBA.fromHex("#94a3b8") },
  punctuation: { fg: RGBA.fromHex("#94a3b8") },
  default: { fg: RGBA.fromHex("#d8e6f5") },
});
