import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { App } from "./App";

// Create the CLI renderer
const renderer = await createCliRenderer({
  exitOnCtrlC: false, // We handle quit ourselves
});

// Render the app
createRoot(renderer).render(<App />);
