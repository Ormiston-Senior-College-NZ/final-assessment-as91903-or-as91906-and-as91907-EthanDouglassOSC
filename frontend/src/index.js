/*
 * BROWSER ENTRY POINT
 * Loads global CSS, restores the persisted dark-mode class, creates the React
 * root, and mounts the complete application inside React Strict Mode.
 */
import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";

document.body.classList.toggle(
  "dark-mode",
  localStorage.getItem("theme") === "dark",
);

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
