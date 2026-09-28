import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./index.css";

const root = document.getElementById("root");
if (!root) throw new Error("CatHouse: #root is missing from the webview HTML");
const view = root.dataset.view === "dashboard" ? "dashboard" : "sidebar";

createRoot(root).render(
  <StrictMode>
    <App view={view} />
  </StrictMode>,
);
