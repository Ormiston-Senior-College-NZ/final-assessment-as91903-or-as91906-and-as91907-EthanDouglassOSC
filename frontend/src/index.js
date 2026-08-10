/*
 * BROWSER ENTRY POINT
 * Loads global CSS, creates the React root, and mounts the complete application
 * inside React Strict Mode.
 */
import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";

// Attach the opaque login token to same-origin API requests automatically.
const browserFetch = window.fetch.bind(window);
window.fetch = (input, options = {}) => {
  const url = typeof input === "string" ? input : input.url;
  const isLocalApi = !/^https?:\/\//i.test(url) || url.startsWith(window.location.origin);
  const token = localStorage.getItem("authToken");
  if (!token || !isLocalApi) return browserFetch(input, options);
  const headers = new Headers(options.headers || (typeof input !== "string" ? input.headers : undefined));
  headers.set("Authorization", `Bearer ${token}`);
  return browserFetch(input, { ...options, headers });
};

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
