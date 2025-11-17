import React, { useEffect, useState } from "react";

import { PartnerSummary, PartnerStatus } from "../api/partners";
import { Modal } from "../components/Modal";
import { PartnerForm } from "../components/PartnerForm";
import { PartnerTable } from "../components/PartnerTable";
import { usePartnerAdmin } from "../hooks/usePartnerAdmin";

const STATUS_OPTIONS: PartnerStatus[] = ["ACTIVE", "INACTIVE", "PENDING"];

export const AdminPartnersPage: React.FC = () => {
  const {
    partners,
    meta,
    filters,
    isLoading,
    error,
    success,
    loadPartners,
    createPartner,
    updatePartner,
  } = usePartnerAdmin({ initialFilters: { page: 1, perPage: 20 } });
  const [selectedPartner, setSelectedPartner] = useState<PartnerSummary | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  useEffect(() => {
    loadPartners();
  }, [loadPartners]);

  const handleSelectPartner = (partner: PartnerSummary) => {
    setSelectedPartner(partner);
  };

  const handleOpenCreate = () => setIsCreateModalOpen(true);
  const handleCloseCreate = () => setIsCreateModalOpen(false);
  const handleCreateSuccess = () => setIsCreateModalOpen(false);

  const handleOpenEdit = (partner: PartnerSummary) => {
    setSelectedPartner(partner);
    setIsEditModalOpen(true);
  };
  const handleCloseEdit = () => setIsEditModalOpen(false);
  const handleEditSuccess = () => setIsEditModalOpen(false);

  const handleStatusFilter = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value || undefined;
    loadPartners({ page: 1, status: value as PartnerStatus | undefined });
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value.trim() || undefined;
    loadPartners({ page: 1, search: value });
  };

  const handlePageChange = (page: number) => {
    loadPartners({ page });
  };

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.heading}>Partner Administration</h1>
          <p style={styles.subtitle}>Create partners, adjust SLA targets, and keep contacts up to date.</p>
        </div>
        <div style={styles.filters}>
          <select style={styles.filterInput} onChange={handleStatusFilter} defaultValue={filters.status || ""}>
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <input
            type="search"
            placeholder="Search partner name"
            defaultValue={filters.search || ""}
            onChange={handleSearchChange}
            style={styles.filterInput}
          />
          <button type="button" style={styles.refresh} onClick={() => loadPartners()}>
            Refresh
          </button>
          <button type="button" style={styles.create} onClick={handleOpenCreate}>
            Add partner
          </button>
        </div>
      </header>

      {error ? <div style={styles.error}>{error}</div> : null}
      {success ? <div style={styles.success}>{success}</div> : null}

      <PartnerTable
        partners={partners}
        meta={meta}
        isLoading={isLoading}
        selectedPartnerId={selectedPartner?.id}
        onSelect={handleSelectPartner}
        onPageChange={handlePageChange}
        onEdit={handleOpenEdit}
      />

      <Modal isOpen={isCreateModalOpen} onClose={handleCloseCreate} title="Create partner">
        <PartnerForm mode="create" onSubmit={createPartner} onSuccess={handleCreateSuccess} />
      </Modal>

      <Modal
        isOpen={isEditModalOpen && Boolean(selectedPartner)}
        onClose={handleCloseEdit}
        title={selectedPartner ? `Edit ${selectedPartner.name}` : "Edit partner"}
      >
        {selectedPartner ? (
          <PartnerForm
            mode="edit"
            partner={selectedPartner}
            onSubmit={updatePartner}
            onSuccess={handleEditSuccess}
          />
        ) : null}
      </Modal>
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
  create: {
    padding: "0.5rem 1.1rem",
    borderRadius: 8,
    border: "none",
    background: "#2563eb",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 600,
    boxShadow: "0 4px 12px rgba(37, 99, 235, 0.35)",
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
};
