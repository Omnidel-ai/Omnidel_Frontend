import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { ConsoleApp, type ConsoleData } from "./console";
import consoleData from "./data/console.json";
import "./styles/global.css";

const CONSOLE = consoleData as ConsoleData;

const isConsole = () => window.location.hash.startsWith("#/console");

/**
 * Two applications share this workspace: the OmniDel app, and the platform
 * console under `#/console/…`. They share components, never a frame.
 */
function Root() {
  const [consoleOpen, setConsoleOpen] = useState(isConsole);
  useEffect(() => {
    const onHash = () => setConsoleOpen(isConsole());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return consoleOpen ? <ConsoleApp data={CONSOLE} /> : <App />;
}

const container = document.getElementById("root");
if (!container) throw new Error("#root not found in index.html");

createRoot(container).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
