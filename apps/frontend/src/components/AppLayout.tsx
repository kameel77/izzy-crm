import React from "react";

import { useAuth } from "../hooks/useAuth";
import { AppHeader } from "./AppHeader";
import { AppSidebar } from "./AppSidebar";

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { user } = useAuth();

  if (!user) {
    return <>{children}</>;
  }

  return (
    <div style={styles.shell}>
      <AppHeader />
      <div style={styles.body}>
        <AppSidebar />
        <main style={styles.main}>{children}</main>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  shell: {
    minHeight: "100vh",
    background: "#0b1220",
    display: "flex",
    flexDirection: "column",
  },
  body: {
    flex: 1,
    display: "flex",
    gap: "2rem",
    padding: "2rem",
    background: "linear-gradient(160deg, rgba(15, 23, 42, 0.96) 0%, rgba(15, 23, 42, 0.92) 100%)",
  },
  main: {
    flex: 1,
    borderRadius: "1.25rem",
    background: "#f9fafb",
    padding: "2rem",
    boxShadow: "0 20px 35px rgba(15, 23, 42, 0.25)",
    overflow: "auto",
  },
};
