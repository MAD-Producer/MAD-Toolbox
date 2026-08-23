import React from "react";
import ReactDOM from "react-dom/client";
import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/carousel/styles.css";
import "./styles/tokens.css";
import "./styles/fonts.css";
import "./styles/shell.css";
import "./styles/controls.css";
import "./styles/animations.css";
import "./styles/about.css";
import "./styles/layout.css";
import "./styles/notifications.css";
import App from "./app/App";
import { theme } from "./theme";
import { isWindows } from "./lib/platform";
import "./locale";

document.documentElement.dataset.platform = isWindows ? "windows" : "macos";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="light">
      <Notifications position="bottom-left" />
      <App />
    </MantineProvider>
  </React.StrictMode>
);
