import React, { useEffect, useState } from "react";

import { fetchCurrentPartner } from "../api/partners";
import { useAuth } from "../hooks/useAuth";
import { Avatar, NavItem, NavSection } from "./ui";
import type { IconName } from "./ui";

interface SidebarItem {
  to: string;
  label: string;
  roles?: string[];
  icon: IconName;
}

interface SidebarSection {
  label: string;
  items: SidebarItem[];
}

interface AppSidebarProps {
  isCollapsed: boolean;
}

const SECTIONS: SidebarSection[] = [
  {
    label: "Overview",
    items: [
      { to: "/leads", label: "Leads", icon: "users" },
      { to: "/analytics", label: "Analytics", icon: "chart", roles: ["OPERATOR", "SUPERVISOR", "ADMIN"] },
    ],
  },
  {
    label: "Administration",
    items: [
      { to: "/admin/partners", label: "Partners", icon: "briefcase", roles: ["ADMIN"] },
      { to: "/admin/users", label: "Users", icon: "users", roles: ["ADMIN", "SUPERVISOR"] },
      { to: "/admin/consents", label: "Consents", icon: "shield", roles: ["ADMIN"] },
      {
        to: "/admin/consent-records",
        label: "Consent records",
        icon: "archive",
        roles: ["ADMIN", "SUPERVISOR", "OPERATOR"],
      },
    ],
  },
];

const formatRole = (role: string) => {
  const text = role.replace(/_/g, " ").toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
};

export const AppSidebar: React.FC<AppSidebarProps> = ({ isCollapsed }) => {
  const { user, token, logout } = useAuth();
  const [partnerName, setPartnerName] = useState<string | null>(user?.partner?.name ?? null);

  useEffect(() => {
    if (!user) return;
    setPartnerName(user.partner?.name ?? null);
  }, [user]);

  useEffect(() => {
    if (!user || !token || partnerName || !user.partnerId) {
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
  }, [token, partnerName, user]);

  if (!user) {
    return null;
  }

  const isPartnerRole = user.role === "PARTNER_MANAGER" || user.role === "PARTNER_EMPLOYEE" || user.role === "PARTNER";
  const subtitle = isPartnerRole && partnerName ? partnerName : formatRole(user.role);
  const displayName = user.fullName || user.email;

  const sections = SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.roles || item.roles.includes(user.role)),
  })).filter((section) => section.items.length > 0);

  return (
    <aside className="app-sidebar">
      <div className="app-brand">
        <div className="app-brand__tile">
          <img src="/logo.svg" alt="" width={16} height={16} />
        </div>
        <div className="app-brand__text">
          <b>Izzy CRM</b>
          <span>Leasing desk</span>
        </div>
      </div>
      <nav className="app-sidebar__nav" aria-label="Primary">
        {sections.map((section) => (
          <NavSection key={section.label} label={section.label}>
            {section.items.map((item) => (
              <NavItem
                key={item.to}
                to={item.to}
                icon={item.icon}
                label={item.label}
                title={isCollapsed ? item.label : undefined}
              />
            ))}
          </NavSection>
        ))}
      </nav>
      <div className="app-sidebar__foot">
        <div className="app-me">
          <Avatar name={displayName} />
          <div className="app-me__text">
            <b>{displayName}</b>
            <span>{subtitle}</span>
          </div>
        </div>
        <NavItem icon="log-out" label="Log out" onClick={logout} title={isCollapsed ? "Log out" : undefined} />
      </div>
    </aside>
  );
};
