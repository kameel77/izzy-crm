import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { AuthProvider } from "./providers/AuthProvider";
import { TelemetryProvider } from "./hooks/useTelemetry";
import { ToastProvider } from "./providers/ToastProvider";
import "./styles/global.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Failed to find the root element");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <TelemetryProvider>
        <AuthProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </AuthProvider>
      </TelemetryProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
