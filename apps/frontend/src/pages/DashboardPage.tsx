import React, { useCallback, useEffect, useMemo, useState } from "react";

import { ApiError } from "../api/client";
import {
  LeadDetail,
  LeadListResponse,
  LeadSummary,
  createLead,
  fetchLeadDetail,
  fetchLeads,
  saveFinancingApplication,
  updateLeadStatus,
  uploadLeadDocument,
  FinancingPayload,
} from "../api/leads";
import { CreateLeadForm } from "../components/CreateLeadForm";
import { LeadDetailCard } from "../components/LeadDetailCard";
import { LeadList } from "../components/LeadList";
import { Modal } from "../components/Modal";
import { Button, Icon } from "../components/ui";
import { LeadStatus } from "../constants/leadStatus";
import { useAuth } from "../hooks/useAuth";
import { useToasts } from "../providers/ToastProvider";

export const DashboardPage: React.FC = () => {
  const { token, user } = useAuth();
  const { addToast } = useToasts();
  const perPage = 25;
  const [leadList, setLeadList] = useState<LeadSummary[]>([]);
  const [leadMeta, setLeadMeta] = useState<LeadListResponse["meta"] | null>(null);
  const [isLoadingLeads, setIsLoadingLeads] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<LeadDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "">("");
  const [search, setSearch] = useState("");
  const [notification, setNotification] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCreateLeadOpen, setIsCreateLeadOpen] = useState(false);
  const [isLeadDetailOpen, setIsLeadDetailOpen] = useState(false);

  const loadLeadDetail = useCallback(
    async (leadId: string) => {
      if (!token) return;
      setIsLoadingDetail(true);
      setError(null);
      try {
        const detail = await fetchLeadDetail(token, leadId);
        setSelectedLead(detail);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Failed to load lead detail");
      } finally {
        setIsLoadingDetail(false);
      }
    },
    [token],
  );

  const loadLeads = useCallback(
    async (options?: { selectLeadId?: string; pageOverride?: number }) => {
      if (!token) return;
      setIsLoadingLeads(true);
      setError(null);
      try {
        const targetPage = options?.pageOverride ?? page;
        const response = await fetchLeads(token, {
          page: targetPage,
          perPage,
          status: statusFilter,
          search: search.trim() || undefined,
        });
        setLeadList(response.data);
        setLeadMeta(response.meta);
        setPage(response.meta.page);
        const idToSelect =
          options?.selectLeadId ||
          selectedLeadId ||
          response.data[0]?.id ||
          null;
        setSelectedLeadId(idToSelect);
        if (idToSelect) {
          await loadLeadDetail(idToSelect);
        } else {
          setSelectedLead(null);
        }
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Failed to load leads");
      } finally {
        setIsLoadingLeads(false);
      }
    },
    [token, statusFilter, search, page, perPage, selectedLeadId, loadLeadDetail],
  );

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  const handlePageChange = (nextPage: number) => {
    if (!leadMeta) {
      setPage(nextPage);
      return;
    }
    if (nextPage < 1 || nextPage > leadMeta.totalPages) return;
    setPage(nextPage);
    loadLeads({ pageOverride: nextPage, selectLeadId: selectedLeadId ?? undefined });
  };

  const handleStatusFilterChange = (value: LeadStatus | "") => {
    setStatusFilter(value);
    setPage(1);
    loadLeads({ pageOverride: 1, selectLeadId: selectedLeadId ?? undefined });
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
    loadLeads({ pageOverride: 1, selectLeadId: selectedLeadId ?? undefined });
  };

  const handleSelectLead = async (leadId: string) => {
    setSelectedLeadId(leadId);
    await loadLeadDetail(leadId);
  };

  const handleOpenLeadDetail = async (leadId: string) => {
    await handleSelectLead(leadId);
    setIsLeadDetailOpen(true);
  };

  const handleCreateLead = async (payload: Parameters<typeof createLead>[1]) => {
    if (!token) return;
    setNotification(null);
    setError(null);
    try {
      const lead = await createLead(token, payload);
      addToast(`Lead ${lead.id} created`, "success");
      setSelectedLeadId(lead.id);
      await loadLeads({ selectLeadId: lead.id });
      setIsCreateLeadOpen(false);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to create lead";
      setError(message);
      addToast(message, "error");
    }
  };

  const handleStatusUpdate = async (payload: { status: LeadStatus; notes?: string }) => {
    if (!token || !selectedLeadId) return;
    setNotification(null);
    setError(null);
    try {
      await updateLeadStatus(token, selectedLeadId, payload);
      addToast("Lead status updated", "success");
      await loadLeads({ selectLeadId: selectedLeadId });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to update status";
      setError(message);
      addToast(message, "error");
      throw (err instanceof Error ? err : new Error(message));
    }
  };

  const handleSaveFinancing = async (payload: FinancingPayload) => {
    if (!token || !selectedLeadId) return;
    setNotification(null);
    setError(null);
    try {
      await saveFinancingApplication(token, selectedLeadId, payload);
      addToast("Financing info saved", "success");
      await loadLeadDetail(selectedLeadId);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to save financing info";
      setError(message);
      addToast(message, "error");
      throw err;
    }
  };

  const handleAddDocument = async (payload: { type: string; file: File }) => {
    if (!token || !selectedLeadId) return;
    setNotification(null);
    setError(null);
    try {
      await uploadLeadDocument(token, selectedLeadId, payload);
      addToast("Document uploaded", "success");
      await loadLeadDetail(selectedLeadId);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to upload document";
      setError(message);
      addToast(message, "error");
      throw err;
    }
  };

  const metaSummary = useMemo(() => {
    if (!leadMeta) return "";
    return `${leadMeta.total} total leads`;
  }, [leadMeta]);

  return (
    <div className="app-page">
      <div className="app-title-row">
        <div>
          <h1 className="app-page-title">Leads</h1>
          <p className="app-page-desc">
            Zalogowany/a jako <strong>{user?.fullName || user?.email}</strong>{user?.partner ? ` (Partner: ${user.partner.name})` : ""} · {metaSummary}
          </p>
        </div>
        <div className="app-title-row__acts">
          <Button icon="plus" onClick={() => setIsCreateLeadOpen(true)}>
            New lead
          </Button>
        </div>
      </div>

      {notification ? (
        <div className="app-alert app-alert--success" role="status">
          <Icon name="check" />
          {notification}
        </div>
      ) : null}
      {error ? (
        <div className="app-alert app-alert--danger" role="alert">
          <Icon name="alert" />
          {error}
        </div>
      ) : null}

      <LeadList
        leads={leadList}
        isLoading={isLoadingLeads}
        selectedLeadId={selectedLeadId}
        onRefresh={() => loadLeads({ selectLeadId: selectedLeadId ?? undefined })}
        onMore={handleOpenLeadDetail}
        statusFilter={statusFilter}
        onStatusFilterChange={handleStatusFilterChange}
        search={search}
        onSearchChange={handleSearchChange}
        meta={leadMeta}
        onPageChange={handlePageChange}
      />

      <Modal
        isOpen={isCreateLeadOpen}
        onClose={() => setIsCreateLeadOpen(false)}
        title="Formularz wprowadzania danych leada"
      >
        <CreateLeadForm
          onCreate={handleCreateLead}
          defaultPartnerId={user?.partnerId}
        />
      </Modal>

      <Modal
        isOpen={isLeadDetailOpen}
        onClose={() => setIsLeadDetailOpen(false)}
        title="Lead detail"
        width="min(1000px, 96%)"
      >
        {isLoadingDetail ? (
          <div className="app-empty">Loading lead detail...</div>
        ) : (
          <LeadDetailCard
            lead={selectedLead}
            onRefresh={() => (selectedLeadId ? loadLeadDetail(selectedLeadId) : undefined)}
            onStatusUpdate={handleStatusUpdate}
            onSaveFinancing={handleSaveFinancing}
            onAddDocument={handleAddDocument}
          />
        )}
      </Modal>
    </div>
  );
};
