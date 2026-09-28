import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./index.css";
import { applyStoredFontScale } from "./lib/settings";

applyStoredFontScale();

const root = document.getElementById("root");
if (!root) throw new Error("CatHouse: #root is missing from the webview HTML");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
