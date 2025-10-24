import React from "react";

import { LeadDetail } from "../api/leads";
import { LEAD_STATUS_LABELS, LeadStatus } from "../constants/leadStatus";
import { StatusUpdateForm } from "./StatusUpdateForm";

interface LeadDetailCardProps {
  lead: LeadDetail | null;
  onRefresh: () => void;
  onStatusUpdate: (payload: { status: LeadStatus; notes?: string }) => Promise<void>;
}

export const LeadDetailCard: React.FC<LeadDetailCardProps> = ({
  lead,
  onRefresh,
  onStatusUpdate,
}) => {
  if (!lead) {
    return (
      <section style={styles.placeholder}>
        <p>Select a lead to view details.</p>
      </section>
    );
  }

  return (
    <section style={styles.container}>
      <header style={styles.header}>
        <div>
          <h2 style={styles.title}>
            {lead.customerProfile
              ? `${lead.customerProfile.firstName} ${lead.customerProfile.lastName}`
              : "Lead Detail"}
          </h2>
          <p style={styles.subtitle}>{lead.customerProfile?.email}</p>
        </div>
        <button type="button" style={styles.refreshButton} onClick={onRefresh}>
          Refresh
        </button>
      </header>

      <div style={styles.section}>
        <span style={styles.badge}>{LEAD_STATUS_LABELS[lead.status]}</span>
        <div style={styles.grid}>
          <InfoItem label="Partner" value={lead.partner?.name || lead.partnerId} />
          <InfoItem
            label="Assigned To"
            value={lead.assignedUser?.fullName || "Unassigned"}
          />
          <InfoItem
            label="Created"
            value={new Date(lead.leadCreatedAt).toLocaleString()}
          />
          <InfoItem
            label="Last Contact"
            value={lead.lastContactAt ? new Date(lead.lastContactAt).toLocaleString() : "—"}
          />
        </div>
      </div>

      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Vehicle Interest</h3>
        <InfoItem
          label="Current Vehicle"
          value={
            lead.vehicleCurrent
              ? `${lead.vehicleCurrent.make || "?"} ${lead.vehicleCurrent.model || ""}`
              : "—"
          }
        />
        <InfoItem
          label="Desired Vehicle"
          value={
            lead.vehicleDesired
              ? `${lead.vehicleDesired.make || "?"} ${lead.vehicleDesired.model || ""}`
              : "—"
          }
        />
      </div>

      <StatusUpdateForm lead={lead} onSubmit={onStatusUpdate} />
    </section>
  );
};

const InfoItem: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div style={styles.infoItem}>
    <span style={styles.infoLabel}>{label}</span>
    <span>{value}</span>
  </div>
);

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: "#fff",
    borderRadius: 12,
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
    padding: "1.5rem",
    display: "flex",
    flexDirection: "column",
    gap: "1.25rem",
  },
  placeholder: {
    background: "#fff",
    borderRadius: 12,
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.04)",
    padding: "2rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#6b7280",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "1rem",
  },
  title: {
    margin: 0,
    fontSize: "1.5rem",
  },
  subtitle: {
    margin: "0.25rem 0 0",
    color: "#6b7280",
  },
  refreshButton: {
    padding: "0.5rem 0.75rem",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    background: "#f8fafc",
    cursor: "pointer",
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  },
  sectionTitle: {
    margin: 0,
    fontSize: "1.1rem",
  },
  grid: {
    display: "grid",
    gap: "0.75rem",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  },
  infoItem: {
    display: "flex",
    flexDirection: "column",
    gap: "0.25rem",
    fontSize: "0.95rem",
  },
  infoLabel: {
    color: "#6b7280",
    fontSize: "0.8rem",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  badge: {
    alignSelf: "flex-start",
    padding: "0.3rem 0.75rem",
    borderRadius: 999,
    background: "#f1f5f9",
    color: "#1d4ed8",
    fontSize: "0.85rem",
    fontWeight: 600,
  },
};
