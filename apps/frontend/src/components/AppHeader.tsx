import React, { useEffect, useState } from "react";

import { useAuth } from "../hooks/useAuth";
import { fetchCurrentPartner } from "../api/partners";

interface AppHeaderProps {
  onToggleSidebar: () => void;
  isSidebarCollapsed: boolean;
}

export const AppHeader: React.FC<AppHeaderProps> = ({ onToggleSidebar, isSidebarCollapsed }) => {
  const { user, token, logout } = useAuth();
  const [partnerName, setPartnerName] = useState<string | null>(user?.partner?.name ?? null);

  if (!user) {
    return null;
  }

  useEffect(() => {
    setPartnerName(user.partner?.name ?? null);
  }, [user.partner?.name]);

  useEffect(() => {
    if (!token || partnerName || !user.partnerId) {
      return;
    }
    let cancelled = false;

    fetchCurrentPartner(token)
      .then((partner) => {
        if (!cancelled) {
          setPartnerName(partner.name);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [token, partnerName, user.partnerId]);

  const isPartnerRole = user.role === "PARTNER_MANAGER" || user.role === "PARTNER_EMPLOYEE" || user.role === "PARTNER";
  const partnerLabel = partnerName || user.partnerId || null;

  return (
    <header style={styles.header}>
      <div style={styles.brandGroup}>
        <button
          type="button"
          onClick={onToggleSidebar}
          style={styles.sidebarToggle}
          aria-label={isSidebarCollapsed ? "Expand navigation" : "Collapse navigation"}
          aria-pressed={isSidebarCollapsed}
        >
          <SidebarToggleIcon isCollapsed={isSidebarCollapsed} />
        </button>
        <div style={styles.brandMark}>Izzy</div>
        <div>
          <div style={styles.productName}>Izzy CRM</div>
          <div style={styles.productTagline}>Financing Operations Control Room</div>
        </div>
      </div>
      <div style={styles.userCluster}>
        <div style={styles.userBadge}>{initials(user.fullName || user.email)}</div>
        <div style={styles.userMeta}>
          <span style={styles.userName}>{user.fullName || user.email}</span>
          <span style={styles.userDetails}>
            {!isPartnerRole ? <span style={styles.roleBadge}>{user.role}</span> : null}
            {partnerLabel ? <span style={styles.partner}>Partner: {partnerLabel}</span> : null}
          </span>
        </div>
        <button type="button" onClick={logout} style={styles.logout}>
          Log out
        </button>
      </div>
    </header>
  );
};

const initials = (value: string) => {
  if (!value) return "IZ";
  const trimmed = value.trim();
  if (!trimmed) return "IZ";
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

const styles: Record<string, React.CSSProperties> = {
  header: {
    position: "sticky",
    top: 0,
    zIndex: 60,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0.9rem 2rem",
    height: "var(--app-header-height)",
    background: "rgba(15, 23, 42, 0.92)",
    backdropFilter: "blur(18px)",
    color: "#f8fafc",
    borderBottom: "1px solid rgba(148, 163, 184, 0.25)",
    boxShadow: "0 18px 30px rgba(15, 23, 42, 0.28)",
    fontFamily: "var(--font-family-sans)",
  },
  brandGroup: {
    display: "flex",
    alignItems: "center",
    gap: "1rem",
  },
  sidebarToggle: {
    width: "40px",
    height: "40px",
    borderRadius: "12px",
    border: "1px solid rgba(148, 163, 184, 0.4)",
    background: "rgba(15, 23, 42, 0.6)",
    color: "#e2e8f0",
    cursor: "pointer",
    display: "grid",
    placeItems: "center",
    fontSize: "1rem",
  },
  brandMark: {
    width: "40px",
    height: "40px",
    borderRadius: "12px",
    background: "linear-gradient(135deg, #38bdf8, #0ea5e9)",
    color: "#0f172a",
    display: "grid",
    placeItems: "center",
    fontWeight: 800,
    fontSize: "1rem",
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  },
  productName: {
    fontSize: "1.25rem",
    fontWeight: "var(--font-weight-bold)",
    letterSpacing: "0.02em",
  },
  productTagline: {
    marginTop: "0.2rem",
    fontSize: "0.8rem",
    color: "#94a3b8",
    letterSpacing: "0.05em",
    textTransform: "uppercase",
  },
  userCluster: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    fontFamily: "var(--font-family-sans)",
  },
  userBadge: {
    width: "42px",
    height: "42px",
    borderRadius: "12px",
    background: "rgba(56, 189, 248, 0.25)",
    border: "1px solid rgba(56, 189, 248, 0.5)",
    color: "#f8fafc",
    display: "grid",
    placeItems: "center",
    fontWeight: 600,
    letterSpacing: "0.04em",
  },
  userMeta: {
    display: "flex",
    flexDirection: "column",
    gap: "0.2rem",
    fontSize: "0.85rem",
  },
  userName: {
    fontWeight: "var(--font-weight-medium)",
    letterSpacing: "0.01em",
  },
  userDetails: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    fontSize: "0.75rem",
    color: "#cbd5f5",
  },
  roleBadge: {
    padding: "0.1rem 0.45rem",
    borderRadius: "999px",
    background: "rgba(56, 189, 248, 0.15)",
    border: "1px solid rgba(56, 189, 248, 0.4)",
    color: "#bae6fd",
    fontWeight: 600,
    letterSpacing: "0.08em",
  },
  partner: {
    color: "#94a3b8",
  },
  logout: {
    padding: "0.45rem 0.85rem",
    borderRadius: "0.6rem",
    border: "1px solid rgba(148, 163, 184, 0.35)",
    background: "rgba(255, 255, 255, 0.04)",
    color: "#f1f5f9",
    cursor: "pointer",
    fontWeight: "var(--font-weight-medium)",
    letterSpacing: "0.01em",
    fontFamily: "var(--font-family-sans)",
  },
};

const SidebarToggleIcon: React.FC<{ isCollapsed: boolean }> = ({ isCollapsed }) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ transform: isCollapsed ? "none" : "rotate(180deg)", transition: "transform 0.2s ease" }}
    aria-hidden="true"
  >
    <path d="M9 6l6 6-6 6" />
  </svg>
);
