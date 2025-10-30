import React from "react";

import { useAuth } from "../hooks/useAuth";
import { AppHeader } from "./AppHeader";
import { AppSidebar } from "./AppSidebar";

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { user } = useAuth();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(true);

  if (!user) {
    return <>{children}</>;
  }

  return (
    <div style={styles.shell}>
      <AppHeader
        onToggleSidebar={() => setIsSidebarCollapsed((value) => !value)}
        isSidebarCollapsed={isSidebarCollapsed}
      />
      <div
        style={{
          ...styles.body,
          ...(isSidebarCollapsed ? styles.bodyCollapsed : {}),
        }}
      >
        <AppSidebar isCollapsed={isSidebarCollapsed} />
        <main style={styles.main}>{children}</main>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  shell: {
    minHeight: "100vh",
    width: "100%",
    background: "var(--app-surface)",
    display: "flex",
    flexDirection: "column",
    color: "var(--app-text)",
    fontFamily: "var(--font-family-sans)",
  },
  body: {
    flex: 1,
    display: "flex",
    gap: "2rem",
    padding: "2rem",
    background: "var(--app-surface)",
  },
  bodyCollapsed: {
    gap: "1.5rem",
  },
  main: {
    flex: 1,
    borderRadius: "1.25rem",
    background: "var(--app-surface-elevated)",
    padding: "2rem",
    boxShadow: "0 24px 48px rgba(15, 23, 42, 0.12)",
    overflow: "auto",
    position: "relative",
  },
};
