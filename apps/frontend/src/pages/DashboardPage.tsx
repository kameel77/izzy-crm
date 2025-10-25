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
import { LeadStatus } from "../constants/leadStatus";
import { useAuth } from "../hooks/useAuth";

export const DashboardPage: React.FC = () => {
  const { token, user } = useAuth();
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

  const handleCreateLead = async (payload: Parameters<typeof createLead>[1]) => {
    if (!token) return;
    setNotification(null);
    setError(null);
    try {
      const lead = await createLead(token, payload);
      setNotification(`Lead ${lead.id} created`);
      await loadLeads({ selectLeadId: lead.id });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create lead");
    }
  };

  const handleStatusUpdate = async (payload: { status: LeadStatus; notes?: string }) => {
    if (!token || !selectedLeadId) return;
    setNotification(null);
    setError(null);
    try {
      await updateLeadStatus(token, selectedLeadId, payload);
      setNotification("Lead status updated");
      await loadLeads({ selectLeadId: selectedLeadId });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to update status";
      setError(message);
      throw (err instanceof Error ? err : new Error(message));
    }
  };

  const handleSaveFinancing = async (payload: FinancingPayload) => {
    if (!token || !selectedLeadId) return;
    setNotification(null);
    setError(null);
    try {
      await saveFinancingApplication(token, selectedLeadId, payload);
      setNotification("Financing info saved");
      await loadLeadDetail(selectedLeadId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save financing info");
      throw err;
    }
  };

  const handleAddDocument = async (payload: { type: string; file: File; checksum?: string }) => {
    if (!token || !selectedLeadId) return;
    setNotification(null);
    setError(null);
    try {
      await uploadLeadDocument(token, selectedLeadId, payload);
      setNotification("Document uploaded");
      await loadLeadDetail(selectedLeadId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to upload document");
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
            Signed in as <strong>{user?.fullName || user?.email}</strong> · {metaSummary}
          </p>
        </div>
      </div>

      {notification ? <div style={styles.notice}>{notification}</div> : null}
      {error ? <div style={styles.error}>{error}</div> : null}

      <div style={styles.layout}>
        <div style={styles.leftColumn}>
          <CreateLeadForm onCreate={handleCreateLead} defaultPartnerId={user?.partnerId} />
          <LeadList
            leads={leadList}
            isLoading={isLoadingLeads}
            selectedLeadId={selectedLeadId}
            onSelect={handleSelectLead}
            onRefresh={() => loadLeads({ selectLeadId: selectedLeadId ?? undefined })}
            statusFilter={statusFilter}
            onStatusFilterChange={handleStatusFilterChange}
            search={search}
            onSearchChange={handleSearchChange}
            meta={leadMeta}
            onPageChange={handlePageChange}
          />
        </div>
        <div style={styles.rightColumn}>
          {isLoadingDetail && selectedLeadId ? (
            <div style={styles.detailLoader}>Loading lead detail...</div>
          ) : null}
          <LeadDetailCard
            lead={selectedLead}
            onRefresh={() => (selectedLeadId ? loadLeadDetail(selectedLeadId) : undefined)}
            onStatusUpdate={handleStatusUpdate}
            onSaveFinancing={handleSaveFinancing}
            onAddDocument={handleAddDocument}
          />
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    padding: "6rem 2rem 2rem",
    minHeight: "100vh",
    background: "#f3f4f6",
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
    display: "flex",
    flexDirection: "column",
    gap: "1.5rem",
  },
  pageHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  heading: {
    margin: 0,
    fontSize: "2rem",
  },
  meta: {
    margin: "0.25rem 0 0",
    color: "#6b7280",
  },
  notice: {
    padding: "0.75rem",
    borderRadius: 8,
    background: "#ecfdf5",
    color: "#047857",
  },
  error: {
    padding: "0.75rem",
    borderRadius: 8,
    background: "#fee2e2",
    color: "#b91c1c",
  },
  layout: {
    display: "grid",
    gap: "1.5rem",
    gridTemplateColumns: "1fr 1fr",
  },
  leftColumn: {
    display: "flex",
    flexDirection: "column",
    gap: "1.5rem",
  },
  rightColumn: {
    display: "flex",
    flexDirection: "column",
    gap: "1.5rem",
  },
  detailLoader: {
    padding: "0.75rem",
    borderRadius: 8,
    background: "#f3f4f6",
    color: "#4b5563",
  },
};
