import React from "react";

import { LeadSummary } from "../api/leads";
import { LeadStatus, LEAD_STATUS_LABELS } from "../constants/leadStatus";

interface LeadListProps {
  leads: LeadSummary[];
  isLoading: boolean;
  selectedLeadId?: string | null;
  onSelect: (leadId: string) => void;
  onRefresh: () => void;
  onCreateLeadClick: () => void;
  onMore: (leadId: string) => void;
  onStatusFilterChange: (status: LeadStatus | "") => void;
  statusFilter: LeadStatus | "";
  search: string;
  onSearchChange: (value: string) => void;
  meta?: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  } | null;
  onPageChange: (page: number) => void;
}

export const LeadList: React.FC<LeadListProps> = ({
  leads,
  isLoading,
  selectedLeadId,
  onSelect,
  onRefresh,
  onCreateLeadClick,
  onMore,
  statusFilter,
  onStatusFilterChange,
  search,
  onSearchChange,
  meta,
  onPageChange,
}) => {
  const page = meta?.page ?? 1;
  const totalPages = meta?.totalPages ?? 1;

  return (
    <section style={styles.container}>
      <header style={styles.header}>
        <div style={styles.filters}>
          <input
            placeholder="Search customer..."
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            style={styles.searchInput}
          />
          <select
            value={statusFilter}
            onChange={(event) => onStatusFilterChange(event.target.value as LeadStatus | "")}
            style={styles.select}
          >
            <option value="">All statuses</option>
            {Object.entries(LEAD_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button type="button" style={styles.refreshButton} onClick={onRefresh}>
            Refresh
          </button>
          <button type="button" style={styles.createButton} onClick={onCreateLeadClick}>
            Create lead
          </button>
        </div>
        <span style={styles.count}>
          {meta ? `${meta.total} results` : `${leads.length} results`}
        </span>
      </header>

      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.tableHeadCell}>Customer</th>
              <th style={styles.tableHeadCell}>Consents</th>
              <th style={styles.tableHeadCell}>Status</th>
              <th style={styles.tableHeadCell}>Assigned</th>
              <th style={styles.tableHeadCell}>Partner</th>
              <th style={styles.tableHeadCell}>Created</th>
              <th aria-label="Lead actions" style={{ ...styles.tableHeadCell, textAlign: "right" }} />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} style={{ ...styles.tableCell, ...styles.loadingCell }}>
                  Loading leads...
                </td>
              </tr>
            ) : leads.length ? (
              leads.map((lead) => (
                <tr
                  key={lead.id}
                  style={
                    lead.id === selectedLeadId ? styles.selectedRow : styles.clickableRow
                  }
                  onClick={() => onSelect(lead.id)}
                >
                  <td style={styles.tableCell}>
                    <strong>
                      {lead.customerProfile
                        ? `${lead.customerProfile.firstName} ${lead.customerProfile.lastName}`
                        : "—"}
                    </strong>
                    <div style={styles.subtleText}>{lead.customerProfile?.email}</div>
                  </td>
                  <td style={styles.tableCell}>
                    <ConsentStatusIndicator status={lead.consentStatus} />
                  </td>
                  <td style={styles.tableCell}>
                    <span style={styles.badge}>{LEAD_STATUS_LABELS[lead.status]}</span>
                  </td>
                  <td style={styles.tableCell}>
                    {lead.assignedUser?.fullName || <span style={styles.subtleText}>Unassigned</span>}
                  </td>
                  <td style={styles.tableCell}>{lead.partner?.name || lead.partnerId}</td>
                  <td style={styles.tableCell}>{new Date(lead.leadCreatedAt).toLocaleString()}</td>
                  <td style={{ ...styles.tableCell, ...styles.actionsCell }}>
                    <button
                      type="button"
                      style={styles.moreButton}
                      onClick={(event) => {
                        event.stopPropagation();
                        onMore(lead.id);
                      }}
                    >
                      More
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} style={{ ...styles.tableCell, ...styles.loadingCell }}>
                  No leads found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={styles.pagination}>
        <button
          type="button"
          style={styles.paginationButton}
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1 || isLoading}
        >
          Previous
        </button>
        <span style={styles.paginationInfo}>
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          style={styles.paginationButton}
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages || isLoading}
        >
          Next
        </button>
      </div>
    </section>
  );
};

const ConsentStatusIndicator: React.FC<{ status: LeadSummary["consentStatus"] }> = ({ status }) => {
  const meta = {
    complete: { label: "Complete", color: "#16a34a" },
    incomplete: { label: "Incomplete", color: "#f59e0b" },
    missing_required: { label: "Missing Required", color: "#dc2626" },
    no_templates: { label: "No Templates", color: "#6b7280" },
  }[status];

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
      <span style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: meta.color }} />
      <span>{meta.label}</span>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: "var(--app-surface-elevated)",
    borderRadius: 16,
    border: "1px solid var(--app-border)",
    boxShadow: "0 16px 32px rgba(15, 23, 42, 0.08)",
    padding: "1.5rem",
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
    fontFamily: "var(--font-family-sans)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "1rem",
    flexWrap: "wrap",
  },
  filters: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    flexWrap: "wrap",
  },
  searchInput: {
    padding: "0.5rem 0.75rem",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    minWidth: 200,
  },
  select: {
    padding: "0.5rem 0.75rem",
    borderRadius: 8,
    border: "1px solid #d1d5db",
  },
  refreshButton: {
    padding: "0.5rem 0.75rem",
    borderRadius: 8,
    border: "1px solid rgba(37, 99, 235, 0.25)",
    background: "rgba(37, 99, 235, 0.12)",
    color: "#1d4ed8",
    cursor: "pointer",
    fontWeight: 600,
  },
  createButton: {
    padding: "0.5rem 0.85rem",
    borderRadius: 8,
    border: "1px solid rgba(4, 120, 87, 0.35)",
    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    color: "#f8fafc",
    cursor: "pointer",
    fontWeight: 600,
  },
  tableWrapper: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "0.92rem",
  },
  tableHeadCell: {
    textAlign: "left",
    padding: "0.75rem",
    fontSize: "0.75rem",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--app-text-muted)",
    borderBottom: "1px solid #e2e8f0",
  },
  tableCell: {
    padding: "1rem 0.75rem",
    borderBottom: "1px solid #f1f5f9",
    verticalAlign: "top",
  },
  clickableRow: {
    cursor: "pointer",
  },
  selectedRow: {
    cursor: "pointer",
    background: "rgba(37, 99, 235, 0.12)",
  },
  loadingCell: {
    textAlign: "center",
    padding: "1.5rem",
    color: "var(--app-text-muted)",
  },
  badge: {
    display: "inline-block",
    padding: "0.25rem 0.5rem",
    borderRadius: 999,
    background: "rgba(79, 70, 229, 0.12)",
    color: "#4338ca",
    fontSize: "0.85rem",
    fontWeight: 600,
  },
  count: {
    fontSize: "0.9rem",
    color: "var(--app-text-muted)",
  },
  pagination: {
    marginTop: "0.5rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "1rem",
  },
  paginationButton: {
    padding: "0.5rem 0.9rem",
    borderRadius: 8,
    border: "1px solid #e2e8f0",
    background: "#fff",
    cursor: "pointer",
    minWidth: 100,
  },
  paginationInfo: {
    fontSize: "0.9rem",
    color: "#4b5563",
  },
  subtleText: {
    color: "var(--app-text-muted)",
    fontSize: "0.85rem",
  },
  actionsCell: {
    textAlign: "right",
    whiteSpace: "nowrap",
  },
  moreButton: {
    padding: "0.35rem 0.75rem",
    borderRadius: 999,
    border: "1px solid #1d4ed8",
    background: "#1d4ed8",
    color: "#fff",
    cursor: "pointer",
    fontSize: "0.85rem",
  },
};
