import React from "react";

type TelemetryEvent =
  | "consents_modal_shown"
  | "consents_modal_closed"
  | "consents_submit_success"
  | "consents_submit_error";

type TelemetryPayload = Record<string, unknown>;

type TelemetryContextValue = {
  track: (event: TelemetryEvent, payload?: TelemetryPayload) => void;
};

const TelemetryContext = React.createContext<TelemetryContextValue | undefined>(undefined);

export const TelemetryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const track = React.useCallback((event: TelemetryEvent, payload?: TelemetryPayload) => {
    if (process.env.NODE_ENV === "test") return;
    const record = {
      event,
      payload,
      timestamp: new Date().toISOString(),
    };
    // eslint-disable-next-line no-console
    console.info("[telemetry]", record);
  }, []);

  return <TelemetryContext.Provider value={{ track }}>{children}</TelemetryContext.Provider>;
};

export const useTelemetry = () => {
  const ctx = React.useContext(TelemetryContext);
  if (!ctx) {
    throw new Error("useTelemetry must be used within TelemetryProvider");
  }
  return ctx;
};
