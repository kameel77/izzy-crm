import React from "react";

import { useAuth } from "../hooks/useAuth";
import { AppHeader } from "./AppHeader";
import { AppSidebar } from "./AppSidebar";

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { user } = useAuth();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches,
  );

  if (!user) {
    return <>{children}</>;
  }

  return (
    <div className={isSidebarCollapsed ? "app-shell app-shell--collapsed" : "app-shell"}>
      <AppSidebar isCollapsed={isSidebarCollapsed} />
      <div className="app-main">
        <AppHeader
          onToggleSidebar={() => setIsSidebarCollapsed((value) => !value)}
          isSidebarCollapsed={isSidebarCollapsed}
        />
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
};
