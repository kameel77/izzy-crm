import React from "react";

import { LeadSummary } from "../api/leads";
import { LeadStatus, LEAD_STATUS_LABELS } from "../constants/leadStatus";

interface LeadListProps {
  leads: LeadSummary[];
  isLoading: boolean;
  selectedLeadId?: string | null;
  onSelect: (leadId: string) => void;
  onRefresh: () => void;
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
        </div>
        <span style={styles.count}>
          {meta ? `${meta.total} results` : `${leads.length} results`}
        </span>
      </header>

      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Status</th>
              <th>Assigned</th>
              <th>Partner</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} style={styles.loadingCell}>
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
                  <td>
                    <strong>
                      {lead.customerProfile
                        ? `${lead.customerProfile.firstName} ${lead.customerProfile.lastName}`
                        : "—"}
                    </strong>
                    <div style={styles.subtleText}>{lead.customerProfile?.email}</div>
                  </td>
                  <td>
                    <span style={styles.badge}>{LEAD_STATUS_LABELS[lead.status]}</span>
                  </td>
                  <td>{lead.assignedUser?.fullName || <span style={styles.subtleText}>Unassigned</span>}</td>
                  <td>{lead.partner?.name || lead.partnerId}</td>
                  <td>{new Date(lead.leadCreatedAt).toLocaleString()}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} style={styles.loadingCell}>
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

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: "#fff",
    borderRadius: 12,
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
    padding: "1.5rem",
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
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
    border: "1px solid #2563eb",
    background: "#2563eb",
    color: "#fff",
    cursor: "pointer",
  },
  tableWrapper: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  clickableRow: {
    cursor: "pointer",
  },
  selectedRow: {
    cursor: "pointer",
    background: "#e0ecff",
  },
  loadingCell: {
    textAlign: "center",
    padding: "1.5rem",
    color: "#6b7280",
  },
  badge: {
    display: "inline-block",
    padding: "0.25rem 0.5rem",
    borderRadius: 999,
    background: "#eef2ff",
    color: "#3730a3",
    fontSize: "0.85rem",
  },
  count: {
    fontSize: "0.9rem",
    color: "#6b7280",
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
    border: "1px solid #d1d5db",
    background: "#fff",
    cursor: "pointer",
    minWidth: 100,
  },
  paginationInfo: {
    fontSize: "0.9rem",
    color: "#4b5563",
  },
  subtleText: {
    color: "#6b7280",
    fontSize: "0.85rem",
  },
};
