import React, { useEffect, useState } from "react";

import { UpdateUserPayload, UserSummary } from "../api/users";
import { UserForm } from "../components/UserForm";
import { UserTable } from "../components/UserTable";
import { useAuth } from "../hooks/useAuth";
import { useUserAdmin } from "../hooks/useUserAdmin";

export const UserAdminPage: React.FC = () => {
  const { user } = useAuth();
  const {
    users,
    meta,
    filters,
    isLoading,
    error,
    success,
    loadUsers,
    createUser,
    updateUser,
    resetPassword,
  } = useUserAdmin({ initialFilters: { perPage: 20, page: 1 } });
  const [selectedUser, setSelectedUser] = useState<UserSummary | null>(null);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleSelectUser = (u: UserSummary) => {
    setSelectedUser(u);
  };

  const handlePageChange = (page: number) => {
    loadUsers({ page });
  };

  const handleRoleFilter = (event: React.ChangeEvent<HTMLSelectElement>) => {
    loadUsers({ page: 1, role: event.target.value || undefined });
  };

  const handleStatusFilter = (event: React.ChangeEvent<HTMLSelectElement>) => {
    loadUsers({ page: 1, status: event.target.value || undefined });
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    loadUsers({ page: 1, search: event.target.value || undefined });
  };

  const isAdmin = user?.role === "ADMIN";

  return (
      <div style={styles.page}>
        <header style={styles.header}>
          <div>
            <h1 style={styles.heading}>User Administration</h1>
            <p style={styles.subtitle}>Invite teammates, manage roles, and reset passwords.</p>
          </div>
          <div style={styles.filters}>
            <select style={styles.filterInput} onChange={handleRoleFilter} defaultValue={filters.role || ""}>
              <option value="">All roles</option>
              <option value="PARTNER">Partner</option>
              <option value="PARTNER_MANAGER">Partner Manager</option>
              <option value="PARTNER_EMPLOYEE">Partner Employee</option>
              <option value="OPERATOR">Operator</option>
              <option value="SUPERVISOR">Supervisor</option>
              <option value="ADMIN">Admin</option>
              <option value="AUDITOR">Auditor</option>
            </select>
            <select style={styles.filterInput} onChange={handleStatusFilter} defaultValue={filters.status || ""}>
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INVITED">Invited</option>
              <option value="INACTIVE">Inactive</option>
            </select>
            <input
              type="search"
              placeholder="Search name or email"
              defaultValue={filters.search || ""}
              onChange={handleSearchChange}
              style={styles.filterInput}
            />
            <button type="button" style={styles.refresh} onClick={() => loadUsers()}>Refresh</button>
          </div>
        </header>

        {error ? <div style={styles.error}>{error}</div> : null}
        {success ? <div style={styles.success}>{success}</div> : null}

        <div style={styles.layout}>
          <UserTable
            users={users}
            meta={meta}
            isLoading={isLoading}
            selectedUserId={selectedUser?.id}
            onSelect={handleSelectUser}
            onPageChange={handlePageChange}
          />

          <div style={styles.forms}>
            <UserForm
              mode="create"
              onSubmit={createUser}
            />
            <UserForm
              mode="edit"
              user={selectedUser}
              onSubmit={(payload) => updateUser(payload as UpdateUserPayload)}
              onResetPassword={isAdmin ? resetPassword : undefined}
            />
          </div>
        </div>
      </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
    display: "flex",
    flexDirection: "column",
    gap: "1.5rem",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "1rem",
    flexWrap: "wrap",
    padding: "1.5rem",
    borderRadius: "1rem",
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 12px 24px rgba(15, 23, 42, 0.08)",
  },
  heading: {
    margin: 0,
    fontSize: "2rem",
  },
  subtitle: {
    margin: "0.25rem 0 0",
    color: "#6b7280",
  },
  filters: {
    display: "flex",
    gap: "0.75rem",
    flexWrap: "wrap",
  },
  filterInput: {
    padding: "0.5rem 0.75rem",
    borderRadius: 8,
    border: "1px solid #d1d5db",
  },
  refresh: {
    padding: "0.5rem 1rem",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    background: "#fff",
    cursor: "pointer",
  },
  error: {
    background: "#fee2e2",
    color: "#b91c1c",
    padding: "0.75rem",
    borderRadius: 8,
  },
  success: {
    background: "#ecfdf5",
    color: "#047857",
    padding: "0.75rem",
    borderRadius: 8,
  },
  layout: {
    display: "grid",
    gap: "1.5rem",
    gridTemplateColumns: "1.5fr 1fr",
  },
  forms: {
    display: "flex",
    flexDirection: "column",
    gap: "1.5rem",
  },
};
