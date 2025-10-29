import React, { useEffect, useMemo, useState } from "react";

import { LeadDetail, FinancingPayload, assignLead } from "../api/leads";
import { LEAD_STATUS_LABELS, LeadStatus } from "../constants/leadStatus";
import { DocumentForm } from "./DocumentForm";
import { FinancingForm } from "./FinancingForm";
import { StatusUpdateForm } from "./StatusUpdateForm";
import { useAuth } from "../hooks/useAuth";
import { useToasts } from "../hooks/useToasts";
import { fetchUsers } from "../api/users";
import { ApiError } from "../api/client";

interface LeadDetailCardProps {
  lead: LeadDetail | null;
  onRefresh: () => void | Promise<void>;
  onStatusUpdate: (payload: { status: LeadStatus; notes?: string }) => Promise<void>;
  onSaveFinancing: (payload: FinancingPayload) => Promise<void>;
  onAddDocument: (payload: { type: string; file: File; checksum?: string }) => Promise<void>;
}

export const LeadDetailCard: React.FC<LeadDetailCardProps> = ({
  lead,
  onRefresh,
  onStatusUpdate,
  onSaveFinancing,
  onAddDocument,
}) => {
  const { token, user } = useAuth();
  const toast = useToasts();
  const isAdmin = user?.role === "ADMIN";
  const [operatorOptions, setOperatorOptions] = useState<Array<{ id: string; email: string; fullName?: string | null }>>([]);
  const [isLoadingOperators, setIsLoadingOperators] = useState(false);
  const [isUpdatingAssignment, setIsUpdatingAssignment] = useState(false);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin || !token) {
      return;
    }

    let cancelled = false;

    const loadOperators = async () => {
      setIsLoadingOperators(true);
      try {
        const response = await fetchUsers(token, { role: "OPERATOR", perPage: 200 });
        if (!cancelled) {
          setOperatorOptions(
            response.data.map((user) => ({ id: user.id, email: user.email, fullName: user.fullName }))
          );
        }
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Failed to load operators";
        if (!cancelled) {
          setAssignmentError(message);
        }
        toast.error(message);
      } finally {
        if (!cancelled) {
          setIsLoadingOperators(false);
        }
      }
    };

    loadOperators();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, token]);

  const handleAssignmentChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    if (!token || !lead) return;
    const nextValue = event.target.value;
    const userId = nextValue || null;

    setIsUpdatingAssignment(true);
    setAssignmentError(null);
    try {
      await assignLead(token, lead.id, userId);
      toast.success(userId ? "Lead assigned" : "Lead marked as unassigned");
      await Promise.resolve(onRefresh());
      window.dispatchEvent(new CustomEvent("lead-assignment-updated", { detail: { leadId: lead.id } }));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to update assignment";
      setAssignmentError(message);
      toast.error(message);
    } finally {
      setIsUpdatingAssignment(false);
    }
  };

  const mergedOperatorOptions = useMemo(() => {
    if (!isAdmin) return [];
    const list = [...operatorOptions];
    if (lead?.assignedUser && !list.some((item) => item.id === lead.assignedUser?.id)) {
      list.push({
        id: lead.assignedUser.id,
        email: lead.assignedUser.email,
        fullName: lead.assignedUser.fullName,
      });
    }
    return list;
  }, [isAdmin, operatorOptions, lead?.assignedUser]);

  const assignedUserId = lead?.assignedUser?.id ?? "";
  const assignedEmail = lead?.assignedUser?.email || (isAdmin ? "Do przypisania" : "Unassigned");

  if (!lead) {
    return (
      <section style={styles.placeholder}>
        <p>Select a lead to view details.</p>
      </section>
    );
  }

  const formatCurrentVehicle = () => {
    const vehicle = lead.vehicleCurrent;
    if (!vehicle) return "—";
    const baseParts = [vehicle.make, vehicle.model].filter(Boolean);
    const base = baseParts.length ? baseParts.join(" ").trim() : "—";
    const meta: string[] = [];
    if (vehicle.year) {
      meta.push(`Rocznik: ${vehicle.year}`);
    }
    if (typeof vehicle.mileage === "number" && Number.isFinite(vehicle.mileage)) {
      const mileageValue = new Intl.NumberFormat("pl-PL").format(vehicle.mileage);
      meta.push(`Przebieg: ${mileageValue} km`);
    }
    return meta.length ? `${base}${base === "—" ? "" : ", "}${meta.join(", ")}` : base;
  };

  const formatDesiredVehicle = () => {
    const vehicle = lead.vehicleDesired;
    if (!vehicle) return "—";
    const baseParts = [vehicle.make, vehicle.model].filter(Boolean);
    const base = baseParts.length ? baseParts.join(" ").trim() : "—";
    const meta: string[] = [];
    if (vehicle.year) {
      meta.push(`Rocznik: ${vehicle.year}`);
    }
    const preferences = vehicle.preferences as { notes?: unknown } | null | undefined;
    const notes =
      preferences && typeof preferences.notes === "string" ? preferences.notes.trim() : "";
    if (notes) {
      meta.push(`Info: ${notes}`);
    }
    return meta.length ? `${base}${base === "—" ? "" : ", "}${meta.join(", ")}` : base;
  };

  return (
    <section style={styles.container}>
      <header style={styles.header}>
        <div>
          <h2 style={styles.title}>
            {lead.customerProfile
              ? `${lead.customerProfile.firstName} ${lead.customerProfile.lastName}`
              : "Lead Detail"}
          </h2>
          <p style={styles.subtitle}>{lead.customerProfile?.email}</p>
        </div>
        <button type="button" style={styles.refreshButton} onClick={onRefresh}>
          Refresh
        </button>
      </header>

      <div style={styles.section}>
        <span style={styles.badge}>{LEAD_STATUS_LABELS[lead.status]}</span>
        <div style={styles.grid}>
          <InfoItem label="Partner" value={lead.partner?.name || lead.partnerId} />
                  <InfoItem
          label="Assigned To"
          value={
            isAdmin ? (
              <div style={styles.assignmentControl}>
                <select
                  value={assignedUserId}
                  onChange={handleAssignmentChange}
                  style={{
                    ...styles.assignmentSelect,
                    background: assignedUserId ? "#ffffff" : "#fef3c7",
                  }}
                  disabled={isLoadingOperators || isUpdatingAssignment}
                >
                  <option value="">Do przypisania</option>
                  {mergedOperatorOptions.map((operator) => (
                    <option key={operator.id} value={operator.id}>
                      {operator.email}
                      {operator.fullName ? ` (${operator.fullName})` : ""}
                    </option>
                  ))}
                </select>
                {assignmentError ? <div style={styles.assignError}>{assignmentError}</div> : null}
              </div>
            ) : (
              assignedEmail
            )
          }
        />
          <InfoItem
            label="Created"
            value={new Date(lead.leadCreatedAt).toLocaleString()}
          />
          <InfoItem
            label="Last Contact"
            value={lead.lastContactAt ? new Date(lead.lastContactAt).toLocaleString() : "—"}
          />
        </div>
      </div>

      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Vehicle Interest</h3>
        <InfoItem label="Current Vehicle" value={formatCurrentVehicle()} />
        <InfoItem label="Desired Vehicle" value={formatDesiredVehicle()} />
      </div>

      <StatusUpdateForm lead={lead} onSubmit={onStatusUpdate} />

      <FinancingForm
        application={lead.financingApps[0] ?? null}
        onSave={async (payload) => {
          await onSaveFinancing(payload);
          onRefresh();
        }}
      />

      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Documents</h3>
        <ul style={styles.docList}>
          {lead.documents.length ? (
            lead.documents.map((doc) => (
              <li key={doc.id} style={styles.docItem}>
                <div>
                  <strong>{doc.type}</strong>
                  <div style={styles.subtleText}>
                    <a href={doc.filePath} target="_blank" rel="noopener noreferrer">
                      {doc.originalName || doc.filePath}
                    </a>
                  </div>
                  <div style={styles.subtleText}>
                    {doc.mimeType ? `${doc.mimeType} · ` : ""}
                    {doc.sizeBytes ? `${Math.round(doc.sizeBytes / 1024)} KB` : ""}
                  </div>
                  {doc.checksum ? (
                    <div style={styles.subtleText}>Checksum: {doc.checksum}</div>
                  ) : null}
                </div>
                <small>{new Date(doc.uploadedAt).toLocaleString()}</small>
              </li>
            ))
          ) : (
            <li style={styles.subtleText}>No documents yet.</li>
          )}
        </ul>
        <DocumentForm
          onSubmit={async (payload) => {
            await onAddDocument(payload);
            const refreshResult = onRefresh();
            if (refreshResult instanceof Promise) {
              await refreshResult;
            }
          }}
        />
      </div>

      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Recent Activity</h3>
        <ul style={styles.auditList}>
          {lead.auditLogs.length ? (
            lead.auditLogs.map((log) => (
              <li key={log.id} style={styles.auditItem}>
                <div>
                  <strong>{formatAuditAction(log.action, log.field)}</strong>
                  <div style={styles.auditMeta}>
                    {log.user?.fullName || "System"} · {new Date(log.createdAt).toLocaleString()}
                  </div>
                  {renderAuditDetails(log)}
                </div>
              </li>
            ))
          ) : (
            <li style={styles.subtleText}>No activity logged yet.</li>
          )}
        </ul>
      </div>
    </section>
  );
};

const InfoItem: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div style={styles.infoItem}>
    <span style={styles.infoLabel}>{label}</span>
    <div style={styles.infoValue}>{value}</div>
  </div>
);

const formatAuditAction = (action: string, field?: string | null) => {
  switch (action) {
    case "status_change":
      return "Lead status updated";
    case "financing_update":
      return "Financing data saved";
    case "document_added":
      return "Document attached";
    default:
      return field ? `${action} (${field})` : action;
  }
};

const renderAuditDetails = (log: LeadDetail["auditLogs"][number]) => {
  if (log.action === "status_change" && typeof log.newValue === "string") {
    return <div style={styles.auditDetails}>Status: {LEAD_STATUS_LABELS[log.newValue as LeadStatus] || log.newValue}</div>;
  }

  if (log.action === "document_added" && log.metadata) {
    const doc = log.metadata as { type?: string; filePath?: string };
    return (
      <div style={styles.auditDetails}>
        {doc.type ? <div>Type: {doc.type}</div> : null}
        {doc.filePath ? <div>Path: {doc.filePath}</div> : null}
      </div>
    );
  }

  if (log.action === "document_added" && log.newValue) {
    const doc = log.newValue as {
      filePath?: string;
      originalName?: string;
      mimeType?: string;
      size?: number;
    };
    return (
      <div style={styles.auditDetails}>
        {doc.originalName ? <div>Original name: {doc.originalName}</div> : null}
        {doc.mimeType ? <div>Type: {doc.mimeType}</div> : null}
        {doc.size ? <div>Size: {Math.round(doc.size / 1024)} KB</div> : null}
        {doc.filePath ? (
          <div>
            Link: <a href={doc.filePath}>{doc.filePath}</a>
          </div>
        ) : null}
      </div>
    );
  }

  if (log.action === "financing_update" && log.newValue) {
    const payload = log.newValue as Record<string, unknown>;
    return (
      <div style={styles.auditDetails}>
        {Object.entries(payload)
          .filter(([, value]) => value !== null && value !== undefined && value !== "")
          .slice(0, 4)
          .map(([key, value]) => (
            <div key={key}>
              {key}: {String(value)}
            </div>
          ))}
      </div>
    );
  }

  if (log.metadata) {
    return (
      <div style={styles.auditDetails}>{JSON.stringify(log.metadata)}</div>
    );
  }

  return null;
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: "#fff",
    borderRadius: 12,
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
    padding: "1.5rem",
    display: "flex",
    flexDirection: "column",
    gap: "1.25rem",
  },
  placeholder: {
    background: "#fff",
    borderRadius: 12,
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.04)",
    padding: "2rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#6b7280",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "1rem",
  },
  title: {
    margin: 0,
    fontSize: "1.5rem",
  },
  subtitle: {
    margin: "0.25rem 0 0",
    color: "#6b7280",
  },
  refreshButton: {
    padding: "0.5rem 0.75rem",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    background: "#f8fafc",
    cursor: "pointer",
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  },
  sectionTitle: {
    margin: 0,
    fontSize: "1.1rem",
  },
  grid: {
    display: "grid",
    gap: "0.75rem",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  },
  infoItem: {
    display: "flex",
    flexDirection: "column",
    gap: "0.25rem",
    fontSize: "0.95rem",
  },
  infoLabel: {
    color: "#6b7280",
    fontSize: "0.8rem",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  infoValue: {
    display: "flex",
    flexDirection: "column",
    gap: "0.25rem",
  },
  badge: {
    alignSelf: "flex-start",
    padding: "0.3rem 0.75rem",
    borderRadius: 999,
    background: "#f1f5f9",
    color: "#1d4ed8",
    fontSize: "0.85rem",
    fontWeight: 600,
  },
  docList: {
    listStyle: "none",
    padding: 0,
    margin: 0,
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  },
  docItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    padding: "0.75rem 1rem",
  },
  auditList: {
    listStyle: "none",
    padding: 0,
    margin: 0,
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  },
  auditItem: {
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    padding: "0.75rem 1rem",
    background: "#f8fafc",
  },
  auditMeta: {
    fontSize: "0.8rem",
    color: "#6b7280",
    marginTop: "0.25rem",
  },
  assignmentControl: {
    display: "flex",
    flexDirection: "column",
    gap: "0.3rem",
    maxWidth: "280px",
  },
  assignmentSelect: {
    padding: "0.45rem 0.75rem",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    fontSize: "0.9rem",
    pointerEvents: "auto",
    cursor: "pointer",
  },
  assignError: {
    fontSize: "0.8rem",
    color: "#b91c1c",
  },
  auditDetails: {
    marginTop: "0.5rem",
    fontSize: "0.85rem",
    color: "#4b5563",
    lineHeight: 1.4,
  },
};
