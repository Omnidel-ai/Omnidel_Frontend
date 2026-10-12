import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/globals.css";
import "./styles/work-journey.css";
import { installDemoApi } from "./demo/api";
import { RouterProvider } from "./next/router";
import { App } from "./App";

// Before the first render: AppBootstrap fetches /api/auth/me on mount.
installDemoApi();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider>
      <App />
    </RouterProvider>
  </StrictMode>,
);
