import React from "react";

import { UserSummary } from "../api/users";
import { Badge, Button, Card, DataTable } from "./ui";
import type { DataTableColumn, Tone } from "./ui";

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
  onEdit?: (user: UserSummary) => void;
}

const STATUS_BADGES: Record<string, { tone: Tone; label: string }> = {
  ACTIVE: { tone: "success", label: "Active" },
  PENDING: { tone: "warning", label: "Pending" },
  INVITED: { tone: "warning", label: "Invited" },
  INACTIVE: { tone: "neutral", label: "Inactive" },
};

const renderStatusBadge = (status: string) => {
  const badge = STATUS_BADGES[status];
  return <Badge tone={badge?.tone ?? "neutral"}>{badge?.label ?? status}</Badge>;
};

const formatRole = (role: string) => {
  const text = role.toLowerCase().replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
};

export const UserTable: React.FC<UserTableProps> = ({
  users,
  meta,
  isLoading,
  selectedUserId,
  onSelect,
  onPageChange,
  onEdit,
}) => {
  const page = meta?.page ?? 1;
  const totalPages = meta?.totalPages ?? 1;

  const columns: DataTableColumn<UserSummary>[] = [
    {
      key: "fullName",
      header: "Name",
      render: (user) => (
        <div className="iz-table__person">
          <div>
            <b>{user.fullName}</b>
            <span>{user.phone || ""}</span>
          </div>
        </div>
      ),
    },
    { key: "email", header: "Email", render: (user) => user.email },
    { key: "role", header: "Role", render: (user) => <Badge tone="neutral">{formatRole(user.role)}</Badge> },
    { key: "status", header: "Status", render: (user) => renderStatusBadge(user.status) },
    { key: "partner", header: "Partner", render: (user) => user.partner?.name || "—" },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (user) => (
        <Button
          variant="secondary"
          size="sm"
          onClick={(event) => {
            event.stopPropagation();
            onSelect(user);
            onEdit?.(user);
          }}
        >
          Edit
        </Button>
      ),
    },
  ];

  return (
    <Card
      title="Users"
      subtitle={meta ? `${meta.total} total` : `${users.length} loaded`}
      flush
      footer={
        <>
          <Button
            variant="secondary"
            size="sm"
            icon="chevron-left"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1 || isLoading}
          >
            Previous
          </Button>
          <span className="iz-tnum app-adm-page">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            iconRight="chevron-right"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages || isLoading}
          >
            Next
          </Button>
        </>
      }
    >
      <DataTable
        rows={isLoading ? [] : users}
        rowKey="id"
        selectedKey={selectedUserId ?? undefined}
        onRowClick={onSelect}
        empty={isLoading ? "Loading users..." : "No users found."}
        columns={columns}
      />
    </Card>
  );
};
