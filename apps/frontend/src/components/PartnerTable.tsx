import React from "react";

import { PartnerSummary } from "../api/partners";
import { Badge, Button, Card, DataTable } from "./ui";
import type { DataTableColumn, Tone } from "./ui";

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

  const columns: DataTableColumn<PartnerSummary>[] = [
    {
      key: "name",
      header: "Name",
      render: (partner) => (
        <div className="iz-table__person">
          <div>
            <b>{partner.name}</b>
            <span>
              {new Date(partner.createdAt).toLocaleDateString()} · Updated{" "}
              {new Date(partner.updatedAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (partner) => renderStatusBadge(partner.status),
    },
    {
      key: "contact",
      header: "Primary contact",
      render: (partner) => (
        <div className="iz-table__person">
          <div>
            <b>{partner.contact?.name || "—"}</b>
            <span>{partner.contact?.email || partner.contact?.phone || ""}</span>
          </div>
        </div>
      ),
    },
    {
      key: "notes",
      header: "Notes",
      render: (partner) => (partner.notes ? partner.notes.slice(0, 80) : "—"),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (partner) => (
        <Button
          variant="secondary"
          size="sm"
          onClick={(event) => {
            event.stopPropagation();
            onSelect(partner);
            onEdit?.(partner);
          }}
        >
          Edit
        </Button>
      ),
    },
  ];

  return (
    <Card
      title="Partners"
      subtitle={meta ? `${meta.total} total` : `${partners.length} loaded`}
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
        rows={isLoading ? [] : partners}
        rowKey="id"
        selectedKey={selectedPartnerId ?? undefined}
        onRowClick={onSelect}
        empty={isLoading ? "Loading partners..." : "No partners found."}
        columns={columns}
      />
    </Card>
  );
};
