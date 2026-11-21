import React from "react";
import ReactDOM from "react-dom/client";
import { SidePanelApp } from "./SidePanelApp";
import "../index.css";

const root = document.getElementById("root");
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <SidePanelApp />
    </React.StrictMode>
  );
}
