import React from "react";

import { UserSummary } from "../api/users";

interface UserTableProps {
  users: UserSummary[];
  meta?: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  } | null;
  isLoading: boolean;
  selectedUserId?: string | null;
  onSelect: (user: UserSummary) => void;
  onPageChange: (page: number) => void;
}

export const UserTable: React.FC<UserTableProps> = ({
  users,
  meta,
  isLoading,
  selectedUserId,
  onSelect,
  onPageChange,
}) => {
  const page = meta?.page ?? 1;
  const totalPages = meta?.totalPages ?? 1;

  return (
    <section style={styles.container}>
      <header style={styles.header}>
        <h2 style={styles.title}>Users</h2>
        <span style={styles.caption}>
          {meta ? `${meta.total} total` : `${users.length} loaded`}
        </span>
      </header>

      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Partner</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} style={styles.loader}>Loading users...</td>
              </tr>
            ) : users.length ? (
              users.map((user) => (
                <tr
                  key={user.id}
                  style={user.id === selectedUserId ? styles.selectedRow : styles.row}
                  onClick={() => onSelect(user)}
                >
                  <td>
                    <strong>{user.fullName}</strong>
                    <div style={styles.subtle}>{user.phone || ""}</div>
                  </td>
                  <td>{user.email}</td>
                  <td>
                    <span style={styles.badge}>{user.role}</span>
                  </td>
                  <td>{user.status}</td>
                  <td>{user.partner?.name || "—"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} style={styles.loader}>No users found.</td>
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
        <span>Page {page} of {totalPages}</span>
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
