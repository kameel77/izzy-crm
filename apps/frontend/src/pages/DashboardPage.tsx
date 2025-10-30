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
import { LeadStatus } from "../constants/leadStatus";
import { useAuth } from "../hooks/useAuth";
import { useToasts } from "../hooks/useToasts";

export const DashboardPage: React.FC = () => {
  const { token, user } = useAuth();
  const toast = useToasts();
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
      toast.success(`Lead ${lead.id} created`);
      setSelectedLeadId(lead.id);
      await loadLeads({ selectLeadId: lead.id });
      setIsCreateLeadOpen(false);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to create lead";
      setError(message);
      toast.error(message);
    }
  };

  const handleStatusUpdate = async (payload: { status: LeadStatus; notes?: string }) => {
    if (!token || !selectedLeadId) return;
    setNotification(null);
    setError(null);
    try {
      await updateLeadStatus(token, selectedLeadId, payload);
      toast.success("Lead status updated");
      await loadLeads({ selectLeadId: selectedLeadId });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to update status";
      setError(message);
      toast.error(message);
      throw (err instanceof Error ? err : new Error(message));
    }
  };

  const handleSaveFinancing = async (payload: FinancingPayload) => {
    if (!token || !selectedLeadId) return;
    setNotification(null);
    setError(null);
    try {
      await saveFinancingApplication(token, selectedLeadId, payload);
      toast.success("Financing info saved");
      await loadLeadDetail(selectedLeadId);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to save financing info";
      setError(message);
      toast.error(message);
      throw err;
    }
  };

  const handleAddDocument = async (payload: { type: string; file: File; checksum?: string }) => {
    if (!token || !selectedLeadId) return;
    setNotification(null);
    setError(null);
    try {
      await uploadLeadDocument(token, selectedLeadId, payload);
      toast.success("Document uploaded");
      await loadLeadDetail(selectedLeadId);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to upload document";
      setError(message);
      toast.error(message);
      throw err;
    }
  };

  const metaSummary = useMemo(() => {
    if (!leadMeta) return "";
    return `${leadMeta.total} total leads`;
  }, [leadMeta]);

  return (
    <div style={styles.page}>
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.heading}>Lead Dashboard</h1>
          <p style={styles.meta}>
            Signed in as <strong>{user?.fullName || user?.email}</strong>{user?.partnerId ? ` (Partner ${user.partnerId})` : ""} · {metaSummary}
          </p>
        </div>
      </div>

      {notification ? <div style={styles.notice}>{notification}</div> : null}
      {error ? <div style={styles.error}>{error}</div> : null}

      <div style={styles.layout}>
        <LeadList
          leads={leadList}
          isLoading={isLoadingLeads}
          selectedLeadId={selectedLeadId}
          onSelect={handleSelectLead}
          onRefresh={() => loadLeads({ selectLeadId: selectedLeadId ?? undefined })}
          onCreateLeadClick={() => setIsCreateLeadOpen(true)}
          onMore={handleOpenLeadDetail}
          statusFilter={statusFilter}
          onStatusFilterChange={handleStatusFilterChange}
          search={search}
          onSearchChange={handleSearchChange}
          meta={leadMeta}
          onPageChange={handlePageChange}
        />
      </div>

      <Modal
        isOpen={isCreateLeadOpen}
        onClose={() => setIsCreateLeadOpen(false)}
        title="Quick lead capture"
      >
        <CreateLeadForm
          onCreate={handleCreateLead}
          defaultPartnerId={user?.partnerId}
          hidePartnerField={user?.role !== "ADMIN"}
        />
      </Modal>

      <Modal
        isOpen={isLeadDetailOpen}
        onClose={() => setIsLeadDetailOpen(false)}
        title="Lead detail"
        width="min(1000px, 96%)"
      >
        {isLoadingDetail ? (
          <div style={styles.detailLoader}>Loading lead detail...</div>
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

const styles: Record<string, React.CSSProperties> = {
  page: {
    display: "flex",
    flexDirection: "column",
    gap: "1.5rem",
    fontFamily: "var(--font-family-sans)",
  },
  pageHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: "1.5rem",
    borderRadius: "1rem",
    background: "var(--app-surface-elevated)",
    border: "1px solid var(--app-border)",
    boxShadow: "0 18px 32px rgba(15, 23, 42, 0.08)",
  },
  heading: {
    margin: 0,
    fontSize: "2rem",
    fontWeight: "var(--font-weight-bold)",
  },
  meta: {
    margin: "0.25rem 0 0",
    color: "var(--app-text-muted)",
  },
  notice: {
    padding: "0.75rem",
    borderRadius: 8,
    background: "rgba(16, 185, 129, 0.12)",
    color: "var(--app-success)",
    border: "1px solid rgba(16, 185, 129, 0.2)",
  },
  error: {
    padding: "0.75rem",
    borderRadius: 8,
    background: "rgba(239, 68, 68, 0.12)",
    color: "var(--app-danger)",
    border: "1px solid rgba(239, 68, 68, 0.2)",
  },
  layout: {
    display: "flex",
    flexDirection: "column",
    gap: "1.5rem",
  },
  detailLoader: {
    padding: "1rem",
    borderRadius: 12,
    background: "#f3f4f6",
    color: "#1f2937",
    fontWeight: 500,
    textAlign: "center",
  },
};
