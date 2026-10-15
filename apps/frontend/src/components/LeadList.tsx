import React from "react";

import { LeadSummary } from "../api/leads";
import { LeadStatus, LEAD_STATUS_LABELS } from "../constants/leadStatus";
import { Avatar, Button, Card, DataTable, Select, StatusBadge, TextField } from "./ui";
import type { DataTableColumn } from "./ui";

interface LeadListProps {
  leads: LeadSummary[];
  isLoading: boolean;
  selectedLeadId?: string | null;
  onRefresh: () => void;
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

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  ...Object.entries(LEAD_STATUS_LABELS).map(([value, label]) => ({ value, label })),
];

export const LeadList: React.FC<LeadListProps> = ({
  leads,
  isLoading,
  selectedLeadId,
  onRefresh,
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

  const columns: DataTableColumn<LeadSummary>[] = [
    {
      key: "customer",
      header: "Klient",
      render: (lead) => {
        const fullName = lead.customerProfile
          ? `${lead.customerProfile.firstName} ${lead.customerProfile.lastName}`
          : "";
        return (
          <div className="iz-table__person">
            <Avatar name={fullName || "?"} />
            <div>
              <b>{fullName || "—"}</b>
              <span>{lead.customerProfile?.email}</span>
            </div>
          </div>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      render: (lead) => <StatusBadge status={lead.status} />,
    },
    {
      key: "assignedUser",
      header: "Przypisany",
      render: (lead) =>
        lead.assignedUser?.fullName ? (
          <div className="iz-table__person">
            <Avatar size="sm" name={lead.assignedUser.fullName} />
            {lead.assignedUser.fullName}
          </div>
        ) : (
          <span className="iz-table__muted">Nieprzypisany</span>
        ),
    },
    {
      key: "partner",
      header: "Partner",
      render: (lead) => lead.partner?.name || lead.partnerId,
    },
    {
      key: "leadCreatedAt",
      header: "Dodany",
      align: "right",
      render: (lead) => (
        <span className="iz-table__muted">
          {new Date(lead.leadCreatedAt).toLocaleString("pl-PL", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      width: 52,
      render: (lead) => (
        <Button
          variant="ghost"
          size="sm"
          icon="more"
          aria-label="Otwórz / Więcej"
          onClick={(event) => {
            event.stopPropagation();
            onMore(lead.id);
          }}
        />
      ),
    },
  ];

  return (
    <Card
      className="app-leads"
      title="Leads"
      icon="users"
      subtitle={meta ? `${meta.total} results` : `${leads.length} results`}
      flush
      actions={
        <>
          <TextField
            icon="search"
            placeholder="Wyszukaj klienta..."
            aria-label="Wyszukaj klienta"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            className="app-leads__search"
          />
          <Select
            aria-label="Status"
            value={statusFilter}
            onChange={(event) => onStatusFilterChange(event.target.value as LeadStatus | "")}
            options={STATUS_OPTIONS}
            className="app-leads__status"
          />
          <Button variant="secondary" size="sm" icon="refresh" onClick={onRefresh}>
            Odśwież
          </Button>
        </>
      }
      footer={
        <>
          <Button
            variant="secondary"
            size="sm"
            icon="chevron-left"
            disabled={page <= 1 || isLoading}
            onClick={() => onPageChange(page - 1)}
          >
            Poprzednia
          </Button>
          <span className="iz-tnum app-leads__page">
            Strona {page} z {totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            iconRight="chevron-right"
            disabled={page >= totalPages || isLoading}
            onClick={() => onPageChange(page + 1)}
          >
            Następna
          </Button>
        </>
      }
    >
      <DataTable
        rows={isLoading ? [] : leads}
        rowKey="id"
        selectedKey={selectedLeadId ?? undefined}
        onRowClick={(lead) => onMore(lead.id)}
        empty={isLoading ? "Loading leads..." : "No leads found."}
        columns={columns}
      />
    </Card>
  );
};
