import React from "react";
import { NavLink } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";

interface NavItem {
  to: string;
  label: string;
  roles?: string[];
  description?: string;
}

export const AppSidebar: React.FC = () => {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  const items: NavItem[] = [
    { to: "/leads", label: "Lead Workspace", description: "Manage and follow up on all leads" },
    {
      to: "/analytics",
      label: "Analytics",
      description: "Visualize volume, conversion, and funnel health",
      roles: ["OPERATOR", "SUPERVISOR", "ADMIN"],
    },
    {
      to: "/admin/users",
      label: "User Admin",
      description: "Invite teammates, manage roles, and reset passwords",
      roles: ["ADMIN", "SUPERVISOR"],
    },
  ];

  return (
    <aside style={styles.sidebar}>
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
                ...(isActive ? styles.linkActive : {}),
              })}
            >
              <span style={styles.linkLabel}>{item.label}</span>
              {item.description ? <span style={styles.linkDescription}>{item.description}</span> : null}
            </NavLink>
          ))}
      </nav>
    </aside>
  );
};

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: "260px",
    minHeight: "calc(100vh - 72px)",
    background: "linear-gradient(180deg, #0f172a 0%, #111827 45%, #030712 100%)",
    color: "#cbd5f5",
    padding: "1.5rem 1.25rem",
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
    position: "sticky",
    top: "72px",
    borderRight: "1px solid rgba(148, 163, 184, 0.2)",
  },
  nav: {
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  },
  link: {
    display: "flex",
    flexDirection: "column",
    gap: "0.25rem",
    padding: "0.85rem",
    borderRadius: "0.75rem",
    textDecoration: "none",
    color: "#e2e8f0",
    background: "rgba(255, 255, 255, 0.02)",
    border: "1px solid rgba(148, 163, 184, 0.15)",
    transition: "border-color 0.2s ease, transform 0.2s ease, background 0.2s ease",
  },
  linkActive: {
    borderColor: "#38bdf8",
    background: "rgba(56, 189, 248, 0.08)",
    transform: "translateX(4px)",
  },
  linkLabel: {
    fontWeight: 600,
    fontSize: "0.95rem",
    letterSpacing: "0.01em",
  },
  linkDescription: {
    fontSize: "0.75rem",
    color: "#94a3b8",
    lineHeight: 1.4,
  },
};
