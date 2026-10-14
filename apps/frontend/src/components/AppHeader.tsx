import React from "react";
import { useLocation } from "react-router-dom";

import { Button, Icon } from "./ui";
import type { IconName } from "./ui";

interface AppHeaderProps {
  onToggleSidebar: () => void;
  isSidebarCollapsed: boolean;
}

interface Crumb {
  prefix: string;
  icon: IconName;
  label: string;
}

// consent-records must precede consents so the more specific prefix wins.
const CRUMBS: Crumb[] = [
  { prefix: "/leads", icon: "users", label: "Leads" },
  { prefix: "/analytics", icon: "chart", label: "Analytics" },
  { prefix: "/admin/partners", icon: "briefcase", label: "Partners" },
  { prefix: "/admin/users", icon: "users", label: "Users" },
  { prefix: "/admin/consent-records", icon: "archive", label: "Consent records" },
  { prefix: "/admin/consents", icon: "shield", label: "Consents" },
];

const FALLBACK_CRUMB: Pick<Crumb, "icon" | "label"> = { icon: "dashboard", label: "Izzy CRM" };

export const AppHeader: React.FC<AppHeaderProps> = ({ onToggleSidebar, isSidebarCollapsed }) => {
  const { pathname } = useLocation();
  const crumb = CRUMBS.find((item) => pathname === item.prefix || pathname.startsWith(`${item.prefix}/`)) ?? FALLBACK_CRUMB;

  return (
    <header className="app-header">
      <Button
        variant="ghost"
        size="sm"
        icon="panel-left"
        aria-label={isSidebarCollapsed ? "Expand navigation" : "Collapse navigation"}
        aria-pressed={isSidebarCollapsed}
        onClick={onToggleSidebar}
      />
      <div className="app-crumb">
        <Icon name={crumb.icon} />
        <b>{crumb.label}</b>
      </div>
    </header>
  );
};
