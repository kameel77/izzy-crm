import React from "react";
import { NavLink } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";

interface NavItem {
  to: string;
  label: string;
  roles?: string[];
  description?: string;
  icon: React.ReactNode;
}

interface AppSidebarProps {
  isCollapsed: boolean;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({ isCollapsed }) => {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  const items: NavItem[] = [
    {
      to: "/leads",
      label: "Lead Workspace",
      description: "Manage and follow up on all leads",
      icon: <InboxIcon />,
    },
    {
      to: "/analytics",
      label: "Analytics",
      description: "Visualize volume, conversion, and funnel health",
      roles: ["OPERATOR", "SUPERVISOR", "ADMIN"],
      icon: <AnalyticsIcon />,
    },
    {
      to: "/admin/users",
      label: "User Admin",
      description: "Invite teammates, manage roles, and reset passwords",
      roles: ["ADMIN", "SUPERVISOR"],
      icon: <UsersIcon />,
    },
    {
      to: "/admin/consents",
      label: "Consent Management",
      description: "Manage consent templates for all forms",
      roles: ["ADMIN"],
      icon: <ShieldIcon />,
    },
  ];

  return (
    <aside
      style={{
        ...styles.sidebar,
        ...(isCollapsed ? styles.sidebarCollapsed : {}),
      }}
      aria-label="Primary navigation"
    >
      <nav style={styles.nav}>
        {items
          .filter((item) => {
            if (!item.roles) return true;
            return item.roles.includes(user.role);
          })
          .map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              style={({ isActive }) => ({
                ...styles.link,
                ...(isCollapsed ? styles.linkCollapsed : {}),
                ...(isActive ? styles.linkActive : {}),
              })}
              title={isCollapsed ? item.label : undefined}
            >
              <span
                style={{
                  ...styles.iconWrapper,
                  ...(isCollapsed ? styles.iconWrapperCollapsed : {}),
                }}
                aria-hidden="true"
              >
                {item.icon}
              </span>
              {!isCollapsed ? (
                <span style={styles.linkContent}>
                  <span style={styles.linkLabel}>{item.label}</span>
                  {item.description ? <span style={styles.linkDescription}>{item.description}</span> : null}
                </span>
              ) : null}
            </NavLink>
          ))}
      </nav>
    </aside>
  );
};

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: "var(--app-sidebar-width)",
    minHeight: "calc(100vh - var(--app-header-height))",
    background: "linear-gradient(180deg, #0f172a 0%, #111827 50%, #020617 100%)",
    color: "#cbd5f5",
    padding: "1.5rem 1.25rem",
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
    position: "sticky",
    top: "var(--app-header-height)",
    borderRight: "1px solid rgba(148, 163, 184, 0.18)",
    transition: "width 0.2s ease, padding 0.2s ease",
    fontFamily: "var(--font-family-sans)",
  },
  sidebarCollapsed: {
    width: "var(--app-sidebar-width-collapsed)",
    padding: "1.5rem 0.75rem",
    alignItems: "center",
  },
  nav: {
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  },
  link: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    padding: "0.85rem",
    borderRadius: "0.75rem",
    textDecoration: "none",
    color: "#e2e8f0",
    background: "rgba(255, 255, 255, 0.02)",
    borderStyle: "solid",
    borderWidth: "1px",
    borderColor: "rgba(148, 163, 184, 0.15)",
    transition: "border-color 0.2s ease, transform 0.2s ease, background 0.2s ease",
    fontWeight: "var(--font-weight-medium)",
  },
  linkCollapsed: {
    justifyContent: "center",
    padding: "0.85rem 0.5rem",
  },
  linkActive: {
    borderColor: "#38bdf8",
    background: "rgba(56, 189, 248, 0.08)",
    transform: "translateX(4px)",
  },
  iconWrapper: {
    width: "32px",
    height: "32px",
    borderRadius: "10px",
    background: "rgba(56, 189, 248, 0.1)",
    color: "#38bdf8",
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
  },
  iconWrapperCollapsed: {
    width: "40px",
    height: "40px",
  },
  linkContent: {
    display: "flex",
    flexDirection: "column",
    gap: "0.25rem",
  },
  linkLabel: {
    fontWeight: "var(--font-weight-medium)",
    fontSize: "0.95rem",
    letterSpacing: "0.01em",
  },
  linkDescription: {
    fontSize: "0.75rem",
    color: "#94a3b8",
    lineHeight: 1.4,
  },
};

const InboxIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M4 5h16l-1.5 9H5.5L4 5Z" />
    <path d="M3 5l4 14h10l4-14" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M9 12h6" strokeLinecap="round" />
  </svg>
);

const AnalyticsIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M5 3v18" strokeLinecap="round" />
    <path d="M3 19h18" strokeLinecap="round" />
    <rect x="7" y="10" width="3" height="6" rx="1" />
    <rect x="12" y="6" width="3" height="10" rx="1" />
    <rect x="17" y="12" width="3" height="4" rx="1" />
  </svg>
);

const UsersIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="9" cy="8" r="3" />
    <path d="M15 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
    <path d="M3 20c.6-3.4 3.3-6 6-6s5.4 2.6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M15.5 14c2.5 0 4.8 2 5.5 5" strokeLinecap="round" />
  </svg>
);

const ShieldIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
