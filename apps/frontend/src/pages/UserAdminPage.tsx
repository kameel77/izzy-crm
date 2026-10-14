import React, { useEffect, useState } from "react";

import { UpdateUserPayload, UserSummary } from "../api/users";
import { Modal } from "../components/Modal";
import { Button, Select, TextField } from "../components/ui";
import { UserForm } from "../components/UserForm";
import { UserTable } from "../components/UserTable";
import { useAuth } from "../hooks/useAuth";
import { useUserAdmin } from "../hooks/useUserAdmin";

const ROLE_FILTER_OPTIONS = [
  { value: "", label: "All roles" },
  { value: "PARTNER", label: "Partner" },
  { value: "PARTNER_MANAGER", label: "Partner manager" },
  { value: "PARTNER_EMPLOYEE", label: "Partner employee" },
  { value: "OPERATOR", label: "Operator" },
  { value: "SUPERVISOR", label: "Supervisor" },
  { value: "ADMIN", label: "Admin" },
  { value: "AUDITOR", label: "Auditor" },
];

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "INVITED", label: "Invited" },
  { value: "INACTIVE", label: "Inactive" },
];

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
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleSelectUser = (u: UserSummary) => {
    setSelectedUser(u);
  };

  const handleOpenCreateModal = () => {
    setIsCreateModalOpen(true);
  };

  const handleCloseCreateModal = () => {
    setIsCreateModalOpen(false);
  };

  const handleOpenEditModal = (u: UserSummary) => {
    setSelectedUser(u);
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
  };

  const handleCreateSuccess = () => {
    setIsCreateModalOpen(false);
  };

  const handleEditSuccess = () => {
    setIsEditModalOpen(false);
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
    <div className="app-page">
      <div className="app-title-row">
        <div>
          <h1 className="app-page-title">User administration</h1>
          <p className="app-page-desc">Invite teammates, manage roles, and reset passwords.</p>
        </div>
        <div className="app-title-row__acts app-adm-acts">
          <Select
            aria-label="Role"
            className="app-adm-filter"
            onChange={handleRoleFilter}
            defaultValue={filters.role || ""}
            options={ROLE_FILTER_OPTIONS}
          />
          <Select
            aria-label="Status"
            className="app-adm-filter"
            onChange={handleStatusFilter}
            defaultValue={filters.status || ""}
            options={STATUS_FILTER_OPTIONS}
          />
          <TextField
            type="search"
            icon="search"
            aria-label="Search name or email"
            className="app-adm-filter"
            placeholder="Search name or email"
            defaultValue={filters.search || ""}
            onChange={handleSearchChange}
          />
          <Button variant="secondary" onClick={() => loadUsers()}>
            Refresh
          </Button>
          <Button variant="primary" icon="plus" onClick={handleOpenCreateModal}>
            Create user
          </Button>
        </div>
      </div>

      {error ? <div className="app-alert app-alert--danger">{error}</div> : null}
      {success ? <div className="app-alert app-alert--success">{success}</div> : null}

      <UserTable
        users={users}
        meta={meta}
        isLoading={isLoading}
        selectedUserId={selectedUser?.id}
        onSelect={handleSelectUser}
        onPageChange={handlePageChange}
        onEdit={handleOpenEditModal}
      />

      <Modal isOpen={isCreateModalOpen} onClose={handleCloseCreateModal} title="Create user">
        <UserForm
          mode="create"
          onSubmit={createUser}
          onSuccess={handleCreateSuccess}
        />
      </Modal>

      <Modal
        isOpen={isEditModalOpen && Boolean(selectedUser)}
        onClose={handleCloseEditModal}
        title={selectedUser ? `Edit ${selectedUser.fullName || selectedUser.email}` : "Edit user"}
      >
        {selectedUser ? (
          <UserForm
            mode="edit"
            user={selectedUser}
            onSubmit={(payload) => updateUser(payload as UpdateUserPayload)}
            onResetPassword={isAdmin ? resetPassword : undefined}
            onSuccess={handleEditSuccess}
          />
        ) : null}
      </Modal>
    </div>
  );
};
