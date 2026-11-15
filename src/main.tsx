import React from "react";
import ReactDOM from "react-dom/client";
import "./styles/design-system.css";
import "./styles/shell.css";
import "./styles/controls.css";
import "./styles/animations.css";
import "./styles/about.css";
import "./styles/layout.css";
import App from "./app/App";
import { initTheme } from "./lib/theme";
import { AppToaster } from "./components/layout/AppToaster";
import { isWindows } from "./lib/platform";
import "./locale";

document.documentElement.dataset.platform = isWindows ? "windows" : "macos";
initTheme();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
    <AppToaster />
  </React.StrictMode>
);
