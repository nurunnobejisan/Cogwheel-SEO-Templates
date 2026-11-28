import React from "react";
import ReactDOM from "react-dom/client";
import { SidePanelApp } from "./SidePanelApp";
import "../index.css";
// Keep the Phase E template-renderer wrapper reachable (it is the extension's
// single renderer entry point exercised by tests/template-render.test.ts).
import "../core/templates/template-engine";

const root = document.getElementById("root");
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <SidePanelApp />
    </React.StrictMode>
  );
}
