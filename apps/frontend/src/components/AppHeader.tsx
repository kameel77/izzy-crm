import React from "react";
import { NavLink } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";

export const AppHeader: React.FC = () => {
  const { user, logout } = useAuth();

  if (!user) {
    return null;
  }

  const canManage = user.role === "ADMIN" || user.role === "SUPERVISOR";

  const navLinks = [
    { to: "/leads", label: "Leads" },
    ...(canManage ? [{ to: "/admin/users", label: "User Admin" }] : []),
  ];

  return (
    <header style={styles.header}>
      <div style={styles.brandGroup}>
        <span style={styles.brand}>Izzy CRM</span>
        <nav style={styles.nav}>
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              style={({ isActive }) => ({
                ...styles.navLink,
                ...(isActive ? styles.navLinkActive : {}),
              })}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <div style={styles.userGroup}>
        <div style={styles.userMeta}>
          <strong>{user.fullName || user.email}</strong>
          <span style={styles.userRole}>{user.role}</span>
        </div>
        <button type="button" onClick={logout} style={styles.logout}>
          Log out
        </button>
      </div>
    </header>
  );
};

const styles: Record<string, React.CSSProperties> = {
  header: {
    position: "sticky",
    top: 0,
    zIndex: 50,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0.75rem 2rem",
    background: "#0f172a",
    color: "#f8fafc",
    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.3)",
  },
  brandGroup: {
    display: "flex",
    alignItems: "center",
    gap: "1.5rem",
  },
  brand: {
    fontSize: "1.2rem",
    fontWeight: 700,
    letterSpacing: "0.02em",
  },
  nav: {
    display: "flex",
    gap: "1rem",
  },
  navLink: {
    color: "#cbd5f5",
    textDecoration: "none",
    fontWeight: 500,
    paddingBottom: "0.2rem",
    borderBottom: "2px solid transparent",
  },
  navLinkActive: {
    color: "#fff",
    borderBottomColor: "#38bdf8",
  },
  userGroup: {
    display: "flex",
    alignItems: "center",
    gap: "1rem",
  },
  userMeta: {
    display: "flex",
    flexDirection: "column",
    gap: "0.2rem",
    fontSize: "0.85rem",
    textAlign: "right",
  },
  userRole: {
    fontSize: "0.75rem",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  logout: {
    padding: "0.4rem 0.75rem",
    borderRadius: 8,
    border: "1px solid rgba(148, 163, 184, 0.5)",
    background: "transparent",
    color: "#e2e8f0",
    cursor: "pointer",
  },
};
