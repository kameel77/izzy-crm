import React from "react";

import { PartnerSummary } from "../api/partners";

interface PartnerTableProps {
  partners: PartnerSummary[];
  meta?: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  } | null;
  isLoading: boolean;
  selectedPartnerId?: string | null;
  onSelect: (partner: PartnerSummary) => void;
  onPageChange: (page: number) => void;
  onEdit?: (partner: PartnerSummary) => void;
}

export const PartnerTable: React.FC<PartnerTableProps> = ({
  partners,
  meta,
  isLoading,
  selectedPartnerId,
  onSelect,
  onPageChange,
  onEdit,
}) => {
  const page = meta?.page ?? 1;
  const totalPages = meta?.totalPages ?? 1;

  return (
    <section style={styles.container}>
      <header style={styles.header}>
        <h2 style={styles.title}>Partners</h2>
        <span style={styles.caption}>{meta ? `${meta.total} total` : `${partners.length} loaded`}</span>
      </header>
      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Primary contact</th>
              <th>Notes</th>
              <th style={styles.actionsHeader}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} style={styles.loader}>
                  Loading partners...
                </td>
              </tr>
            ) : partners.length ? (
              partners.map((partner) => (
                <tr
                  key={partner.id}
                  style={partner.id === selectedPartnerId ? styles.selectedRow : styles.row}
                  onClick={() => onSelect(partner)}
                >
                  <td>
                    <strong>{partner.name}</strong>
                    <div style={styles.subtle}>
                      {new Date(partner.createdAt).toLocaleDateString()} · Updated{" "}
                      {new Date(partner.updatedAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td>
                    <span style={styles.badge}>{partner.status}</span>
                  </td>
                  <td>
                    <div>{partner.contact?.name || "—"}</div>
                    <div style={styles.subtle}>{partner.contact?.email || partner.contact?.phone || ""}</div>
                  </td>
                  <td>{partner.notes ? partner.notes.slice(0, 80) : "—"}</td>
                  <td style={styles.actionsCell}>
                    <button
                      type="button"
                      style={styles.actionButton}
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelect(partner);
                        onEdit?.(partner);
                      }}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} style={styles.loader}>
                  No partners found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <footer style={styles.pagination}>
        <button
          type="button"
          style={styles.pageButton}
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1 || isLoading}
        >
          Previous
        </button>
        <span>
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          style={styles.pageButton}
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages || isLoading}
        >
          Next
        </button>
      </footer>
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
  },
  title: {
    margin: 0,
  },
  caption: {
    color: "#6b7280",
  },
  tableWrapper: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  row: {
    cursor: "pointer",
  },
  selectedRow: {
    cursor: "pointer",
    background: "#eff6ff",
  },
  loader: {
    padding: "1rem",
    textAlign: "center",
    color: "#6b7280",
  },
  subtle: {
    fontSize: "0.8rem",
    color: "#6b7280",
  },
  badge: {
    display: "inline-block",
    padding: "0.25rem 0.5rem",
    background: "#f1f5f9",
    borderRadius: 999,
  },
  actionsHeader: {
    textAlign: "right",
  },
  actionsCell: {
    textAlign: "right",
  },
  actionButton: {
    padding: "0.35rem 0.85rem",
    borderRadius: 8,
    border: "1px solid #2563eb",
    background: "transparent",
    color: "#2563eb",
    cursor: "pointer",
    fontWeight: 600,
  },
  pagination: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pageButton: {
    padding: "0.5rem 1rem",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    background: "#fff",
    cursor: "pointer",
  },
};
