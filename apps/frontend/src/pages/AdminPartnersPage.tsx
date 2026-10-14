import React, { useEffect, useState } from "react";

import { PartnerSummary, PartnerStatus } from "../api/partners";
import { Modal } from "../components/Modal";
import { PartnerForm } from "../components/PartnerForm";
import { PartnerTable } from "../components/PartnerTable";
import { Button, Select, TextField } from "../components/ui";
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
    <div className="app-page">
      <div className="app-title-row">
        <div>
          <h1 className="app-page-title">Partner administration</h1>
          <p className="app-page-desc">Create partners, adjust SLA targets, and keep contacts up to date.</p>
        </div>
        <div className="app-title-row__acts app-adm-acts">
          <Select
            aria-label="Status"
            className="app-adm-filter"
            onChange={handleStatusFilter}
            defaultValue={filters.status || ""}
            options={[{ value: "", label: "All statuses" }, ...STATUS_OPTIONS]}
          />
          <TextField
            type="search"
            icon="search"
            aria-label="Search partner name"
            className="app-adm-filter"
            placeholder="Search partner name"
            defaultValue={filters.search || ""}
            onChange={handleSearchChange}
          />
          <Button variant="secondary" onClick={() => loadPartners()}>
            Refresh
          </Button>
          <Button variant="primary" icon="plus" onClick={handleOpenCreate}>
            Add partner
          </Button>
        </div>
      </div>

      {error ? <div className="app-alert app-alert--danger">{error}</div> : null}
      {success ? <div className="app-alert app-alert--success">{success}</div> : null}

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
