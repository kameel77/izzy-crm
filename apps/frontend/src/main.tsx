import React from "react";
import ReactDOM from "react-dom/client";

const App = () => (
  <div>
    <h1>Izzy CRM Frontend</h1>
    <p>Frontend scaffold is online.</p>
  </div>
);

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Failed to find the root element");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
