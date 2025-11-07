import React, { useCallback, useEffect, useMemo, useState } from "react";

import {
  LeadDetail,
  FinancingPayload,
  assignLead,
  createLeadNote,
  updateLeadVehicles,
  LeadNote,
} from "../api/leads";
import { LEAD_STATUS_LABELS, LeadStatus } from "../constants/leadStatus";
import { DocumentForm } from "./DocumentForm";
import { FinancingForm } from "./FinancingForm";
import { StatusUpdateForm } from "./StatusUpdateForm";
import { useAuth } from "../hooks/useAuth";
import { useToasts } from "../hooks/useToasts";
import { fetchUsers } from "../api/users";
import { ApiError, API_BASE_URL } from "../api/client";
import { Modal } from "./Modal";

type VehicleFormState = {
  current: {
    make: string;
    model: string;
    year: string;
    mileage: string;
    ownershipStatus: string;
  };
  desired: {
    make: string;
    model: string;
    year: string;
    budget: string;
    amountAvailable: string;
    notes: string;
  };
};

const resolveDocumentUrl = (path: string) => {
  if (!path) return "#";
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  if (path.startsWith("/")) {
    return `${API_BASE_URL}${path}`;
  }
  return `${API_BASE_URL}/${path}`;
};

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
  const canEditVehicles =
    user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "OPERATOR";
  const [operatorOptions, setOperatorOptions] = useState<Array<{ id: string; email: string; fullName?: string | null }>>([]);
  const [isLoadingOperators, setIsLoadingOperators] = useState(false);
  const [isUpdatingAssignment, setIsUpdatingAssignment] = useState(false);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [notes, setNotes] = useState<LeadNote[]>(lead?.notes ?? []);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [noteLink, setNoteLink] = useState("");
  const [noteErrors, setNoteErrors] = useState<{ content?: string; link?: string }>({});
  const [isSavingNote, setIsSavingNote] = useState(false);
  const buildVehicleFormState = useCallback((): VehicleFormState => {
    const preferences = lead?.vehicleDesired?.preferences;
    const desiredNotes =
      typeof (preferences as { notes?: unknown } | null | undefined)?.notes === "string"
        ? String((preferences as { notes?: unknown }).notes ?? "")
        : "";
    const latestFinancingApp = lead?.financingApps?.[0];

    return {
      current: {
        make: lead?.vehicleCurrent?.make ?? "",
        model: lead?.vehicleCurrent?.model ?? "",
        year: lead?.vehicleCurrent?.year?.toString() ?? "",
        mileage: lead?.vehicleCurrent?.mileage?.toString() ?? "",
        ownershipStatus: lead?.vehicleCurrent?.ownershipStatus ?? "",
      },
      desired: {
        make: lead?.vehicleDesired?.make ?? "",
        model: lead?.vehicleDesired?.model ?? "",
        year: lead?.vehicleDesired?.year?.toString() ?? "",
        budget: lead?.vehicleDesired?.budget ?? "",
        amountAvailable: latestFinancingApp?.downPayment
          ? String(latestFinancingApp.downPayment)
          : "",
        notes: desiredNotes,
      },
    };
  }, [lead]);
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [vehicleForm, setVehicleForm] = useState<VehicleFormState>(buildVehicleFormState);
  const [vehicleErrors, setVehicleErrors] = useState<Record<string, string>>({});
  const [isSavingVehicles, setIsSavingVehicles] = useState(false);

  useEffect(() => {
    setNotes(lead?.notes ?? []);
  }, [lead]);

  useEffect(() => {
    setVehicleForm(buildVehicleFormState());
    setVehicleErrors({});
  }, [buildVehicleFormState]);

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

  const handleVehicleModalOpen = () => {
    setVehicleForm(buildVehicleFormState());
    setVehicleErrors({});
    setIsVehicleModalOpen(true);
  };

  const handleCloseVehicleModal = () => {
    setIsVehicleModalOpen(false);
    setVehicleErrors({});
  };

  const handleVehicleFieldChange = (
    section: "current" | "desired",
    field: string,
    value: string,
  ) => {
    setVehicleForm((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));
  };

  const buildVehiclePayload = () => {
    const errors: Record<string, string> = {};
    const trimOrUndefined = (value: string) => {
      const trimmed = value.trim();
      return trimmed.length ? trimmed : undefined;
    };
    const parseNumberField = (
      value: string,
      path: string,
      options?: { allowFloat?: boolean; min?: number; max?: number },
    ) => {
      const trimmed = value.trim();
      if (!trimmed) return undefined;
      const parsed = options?.allowFloat ? Number(trimmed) : parseInt(trimmed, 10);
      if (Number.isNaN(parsed)) {
        errors[path] = "Invalid number";
        return undefined;
      }
      if (typeof options?.min === "number" && parsed < options.min) {
        errors[path] = `Must be ≥ ${options.min}`;
        return undefined;
      }
      if (typeof options?.max === "number" && parsed > options.max) {
        errors[path] = `Must be ≤ ${options.max}`;
        return undefined;
      }
      return parsed;
    };

    const current = {
      make: trimOrUndefined(vehicleForm.current.make),
      model: trimOrUndefined(vehicleForm.current.model),
      year: parseNumberField(vehicleForm.current.year, "current.year", {
        min: 1900,
        max: new Date().getFullYear() + 1,
      }),
      mileage: parseNumberField(vehicleForm.current.mileage, "current.mileage", {
        min: 0,
      }),
      ownershipStatus: trimOrUndefined(vehicleForm.current.ownershipStatus),
    };

    const desiredBudgetRaw = vehicleForm.desired.budget.trim();
    const desiredBudget =
      desiredBudgetRaw.length === 0
        ? null
        : parseNumberField(desiredBudgetRaw, "desired.budget", {
            allowFloat: true,
            min: 0,
          });
    const amountAvailableRaw = vehicleForm.desired.amountAvailable.trim();
    let amountAvailable: number | null | undefined;
    if (amountAvailableRaw.length === 0) {
      amountAvailable = null;
    } else {
      amountAvailable = parseNumberField(amountAvailableRaw, "desired.amountAvailable", {
        allowFloat: true,
        min: 0,
      });
    }
    const existingDesiredPreferences = lead?.vehicleDesired?.preferences as
      | { notes?: unknown }
      | null
      | undefined;
    const previousNotes =
      typeof existingDesiredPreferences?.notes === "string"
        ? String(existingDesiredPreferences.notes).trim()
        : "";

    const desired: {
      make?: string;
      model?: string;
      year?: number;
      budget?: number | null;
      notes?: string;
    } = {
      make: trimOrUndefined(vehicleForm.desired.make),
      model: trimOrUndefined(vehicleForm.desired.model),
      year: parseNumberField(vehicleForm.desired.year, "desired.year", {
        min: 1900,
        max: new Date().getFullYear() + 1,
      }),
      budget: desiredBudget,
    };
    const notesValue = vehicleForm.desired.notes.trim();
    if (notesValue.length) {
      desired.notes = notesValue;
    } else if (previousNotes) {
      desired.notes = "";
    }

    if (Object.keys(errors).length) {
      setVehicleErrors(errors);
      return null;
    }

    setVehicleErrors({});

    const hasCurrentValues = Object.values(current).some(
      (value) => typeof value !== "undefined",
    );
    const hasDesiredValues =
      Boolean(
        desired.make ||
          desired.model ||
          typeof desired.year !== "undefined" ||
          (desiredBudgetRaw.length > 0 && desiredBudget !== undefined) ||
          (amountAvailableRaw.length > 0 && typeof amountAvailable !== "undefined"),
      ) ||
      desiredBudget === null ||
      amountAvailable === null ||
      typeof desired.notes !== "undefined";

    const payload: Parameters<typeof updateLeadVehicles>[2] = {};
    payload.current = hasCurrentValues ? current : null;
    payload.desired = hasDesiredValues ? desired : null;
    if (typeof amountAvailable !== "undefined") {
      payload.amountAvailable = amountAvailable;
    }

    return payload;
  };

  const handleSaveVehicles = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token || !lead) return;
    const payload = buildVehiclePayload();
    if (!payload) {
      return;
    }

    setIsSavingVehicles(true);
    try {
      await updateLeadVehicles(token, lead.id, payload);
      toast.success("Vehicle details updated");
      setIsVehicleModalOpen(false);
      const refreshResult = onRefresh();
      if (refreshResult instanceof Promise) {
        await refreshResult;
      }
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to update vehicle details";
      toast.error(message);
    } finally {
      setIsSavingVehicles(false);
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

  const resetNoteForm = () => {
    setNoteContent("");
    setNoteLink("");
    setNoteErrors({});
  };

  const handleCloseNoteModal = () => {
    setIsNoteModalOpen(false);
    resetNoteForm();
  };

  const validateNoteForm = () => {
    const trimmedContent = noteContent.trim();
    const trimmedLink = noteLink.trim();
    const errors: { content?: string; link?: string } = {};

    if (!trimmedContent) {
      errors.content = "Note cannot be empty.";
    } else if (trimmedContent.length > 2000) {
      errors.content = "Note must be at most 2000 characters.";
    }

    if (trimmedLink) {
      try {
        const parsed = new URL(trimmedLink);
        if (!parsed.protocol.startsWith("http")) {
          errors.link = "Link must start with http or https.";
        }
      } catch (error) {
        errors.link = "Provide a valid URL.";
      }
    }

    setNoteErrors(errors);

    return {
      isValid: Object.keys(errors).length === 0,
      content: trimmedContent,
      link: trimmedLink ? trimmedLink : undefined,
    };
  };

  const handleSubmitNote = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !lead) return;

    const validation = validateNoteForm();
    if (!validation.isValid) {
      return;
    }

    setIsSavingNote(true);
    try {
      const createdNote = await createLeadNote(token, lead.id, {
        content: validation.content,
        link: validation.link,
      });
      setNotes((prev) => [createdNote, ...prev]);
      toast.success("Note added");
      handleCloseNoteModal();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to add note";
      toast.error(message);
    } finally {
      setIsSavingNote(false);
    }
  };

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

  const formatDesiredVehicle = (): React.ReactNode => {
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
      typeof preferences?.notes === "string" ? String(preferences.notes).trim() : "";
    const downPaymentRaw = lead.financingApps?.[0]?.downPayment;
    if (downPaymentRaw !== null && typeof downPaymentRaw !== "undefined" && downPaymentRaw !== "") {
      const parsed = Number(downPaymentRaw);
      const formatted =
        Number.isFinite(parsed) && parsed >= 0
          ? new Intl.NumberFormat("pl-PL", {
              style: "currency",
              currency: "PLN",
              minimumFractionDigits: 0,
            }).format(parsed)
          : `${downPaymentRaw} PLN`;
      meta.push(`Amount Available: ${formatted}`);
    }
    const summary = meta.length ? `${base}${base === "—" ? "" : ", "}${meta.join(", ")}` : base;
    if (notes) {
      return (
        <div style={styles.vehicleValue}>
          <div>{summary}</div>
          <div style={styles.additionalInfo}>Additional info: {notes}</div>
        </div>
      );
    }

    return summary;
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
        <div style={styles.sectionHeader}>
          <h3 style={styles.sectionTitle}>Notes</h3>
          <button type="button" style={styles.primaryButton} onClick={() => setIsNoteModalOpen(true)}>
            New note
          </button>
        </div>
        <ul style={styles.noteList}>
          {notes.length ? (
            notes.map((note) => (
              <li key={note.id} style={styles.noteItem}>
                <div style={styles.noteMeta}>
                  <span>{note.author?.fullName || note.author?.email || "Unknown"}</span>
                  <span>· {new Date(note.createdAt).toLocaleString()}</span>
                  {note.link ? (
                    <a
                      href={note.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={styles.noteLink}
                    >
                      Link
                    </a>
                  ) : null}
                </div>
                <p style={styles.noteContent}>{note.content}</p>
              </li>
            ))
          ) : (
            <li style={styles.noteEmpty}>No notes yet.</li>
          )}
        </ul>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <h3 style={styles.sectionTitle}>Vehicle Interest</h3>
          {canEditVehicles ? (
            <button
              type="button"
              style={styles.secondaryButton}
              onClick={handleVehicleModalOpen}
            >
              Edit
            </button>
          ) : null}
        </div>
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
                    <a
                      href={resolveDocumentUrl(doc.filePath)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
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

      <Modal isOpen={isNoteModalOpen} onClose={handleCloseNoteModal} title="Add note">
        <form onSubmit={handleSubmitNote} style={styles.modalForm}>
          <label style={styles.modalLabel}>
            Note
            <textarea
              required
              value={noteContent}
              onChange={(event) => setNoteContent(event.target.value)}
              style={styles.modalTextarea}
              maxLength={2000}
            />
            {noteErrors.content ? <span style={styles.errorText}>{noteErrors.content}</span> : null}
          </label>
          <label style={styles.modalLabel}>
            Link (optional)
            <input
              type="url"
              value={noteLink}
              onChange={(event) => setNoteLink(event.target.value)}
              style={styles.modalInput}
              placeholder="https://example.com"
            />
            {noteErrors.link ? <span style={styles.errorText}>{noteErrors.link}</span> : null}
          </label>
          <div style={styles.modalActions}>
            <button
              type="button"
              style={styles.secondaryButton}
              onClick={handleCloseNoteModal}
            >
              Cancel
            </button>
            <button type="submit" style={styles.primaryButton} disabled={isSavingNote}>
              {isSavingNote ? "Saving..." : "Save note"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isVehicleModalOpen}
        onClose={handleCloseVehicleModal}
        title="Edit vehicle details"
      >
        <form onSubmit={handleSaveVehicles} style={styles.modalForm}>
          <div style={styles.vehicleFormSection}>
            <h4 style={styles.modalSubheading}>Current vehicle</h4>
            <div style={styles.fieldGrid}>
              <label style={styles.modalLabel}>
                Make
                <input
                  type="text"
                  value={vehicleForm.current.make}
                  onChange={(event) =>
                    handleVehicleFieldChange("current", "make", event.target.value)
                  }
                  style={styles.modalInput}
                />
              </label>
              <label style={styles.modalLabel}>
                Model
                <input
                  type="text"
                  value={vehicleForm.current.model}
                  onChange={(event) =>
                    handleVehicleFieldChange("current", "model", event.target.value)
                  }
                  style={styles.modalInput}
                />
              </label>
              <label style={styles.modalLabel}>
                Year
                <input
                  type="number"
                  value={vehicleForm.current.year}
                  onChange={(event) =>
                    handleVehicleFieldChange("current", "year", event.target.value)
                  }
                  style={styles.modalInput}
                  min={1900}
                  max={new Date().getFullYear() + 1}
                />
                {vehicleErrors["current.year"] ? (
                  <span style={styles.errorText}>{vehicleErrors["current.year"]}</span>
                ) : null}
              </label>
              <label style={styles.modalLabel}>
                Mileage (km)
                <input
                  type="number"
                  value={vehicleForm.current.mileage}
                  onChange={(event) =>
                    handleVehicleFieldChange("current", "mileage", event.target.value)
                  }
                  style={styles.modalInput}
                  min={0}
                />
                {vehicleErrors["current.mileage"] ? (
                  <span style={styles.errorText}>{vehicleErrors["current.mileage"]}</span>
                ) : null}
              </label>
              <label style={styles.modalLabel}>
                Ownership status
                <input
                  type="text"
                  value={vehicleForm.current.ownershipStatus}
                  onChange={(event) =>
                    handleVehicleFieldChange(
                      "current",
                      "ownershipStatus",
                      event.target.value,
                    )
                  }
                  style={styles.modalInput}
                />
              </label>
            </div>
          </div>

          <div style={styles.vehicleFormSection}>
            <h4 style={styles.modalSubheading}>Desired vehicle</h4>
            <div style={styles.fieldGrid}>
              <label style={styles.modalLabel}>
                Make
                <input
                  type="text"
                  value={vehicleForm.desired.make}
                  onChange={(event) =>
                    handleVehicleFieldChange("desired", "make", event.target.value)
                  }
                  style={styles.modalInput}
                />
              </label>
              <label style={styles.modalLabel}>
                Model
                <input
                  type="text"
                  value={vehicleForm.desired.model}
                  onChange={(event) =>
                    handleVehicleFieldChange("desired", "model", event.target.value)
                  }
                  style={styles.modalInput}
                />
              </label>
              <label style={styles.modalLabel}>
                Year
                <input
                  type="number"
                  value={vehicleForm.desired.year}
                  onChange={(event) =>
                    handleVehicleFieldChange("desired", "year", event.target.value)
                  }
                  style={styles.modalInput}
                  min={1900}
                  max={new Date().getFullYear() + 1}
                />
                {vehicleErrors["desired.year"] ? (
                  <span style={styles.errorText}>{vehicleErrors["desired.year"]}</span>
                ) : null}
              </label>
              <label style={styles.modalLabel}>
                Budget
                <input
                  type="number"
                  value={vehicleForm.desired.budget}
                  onChange={(event) =>
                    handleVehicleFieldChange("desired", "budget", event.target.value)
                  }
                  style={styles.modalInput}
                  min={0}
                  step="100"
                />
                {vehicleErrors["desired.budget"] ? (
                  <span style={styles.errorText}>{vehicleErrors["desired.budget"]}</span>
                ) : null}
                <span style={styles.helperText}>Leave blank to remove budget</span>
              </label>
              <label style={styles.modalLabel}>
                Amount Available (PLN)
                <input
                  type="number"
                  value={vehicleForm.desired.amountAvailable}
                  onChange={(event) =>
                    handleVehicleFieldChange("desired", "amountAvailable", event.target.value)
                  }
                  style={styles.modalInput}
                  min={0}
                  step="0.01"
                />
                {vehicleErrors["desired.amountAvailable"] ? (
                  <span style={styles.errorText}>{vehicleErrors["desired.amountAvailable"]}</span>
                ) : null}
                <span style={styles.helperText}>Leave blank to clear the amount.</span>
              </label>
            </div>
            <label style={styles.modalLabel}>
              Notes
              <textarea
                value={vehicleForm.desired.notes}
                onChange={(event) =>
                  handleVehicleFieldChange("desired", "notes", event.target.value)
                }
                style={styles.modalTextarea}
                maxLength={500}
              />
              <span style={styles.helperText}>This maps to desired vehicle preferences.</span>
            </label>
          </div>

          <div style={styles.modalActions}>
            <button
              type="button"
              style={styles.secondaryButton}
              onClick={handleCloseVehicleModal}
            >
              Cancel
            </button>
            <button type="submit" style={styles.primaryButton} disabled={isSavingVehicles}>
              {isSavingVehicles ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </Modal>
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
        {doc.filePath ? (
          <div>
            Path:{" "}
            <a href={resolveDocumentUrl(doc.filePath)} target="_blank" rel="noopener noreferrer">
              {doc.filePath}
            </a>
          </div>
        ) : null}
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
            Link:{" "}
            <a href={resolveDocumentUrl(doc.filePath)} target="_blank" rel="noopener noreferrer">
              {doc.filePath}
            </a>
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
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "1rem",
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
  noteList: {
    listStyle: "none",
    padding: 0,
    margin: 0,
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  },
  docList: {
    listStyle: "none",
    padding: 0,
    margin: 0,
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  },
  noteItem: {
    background: "#fff",
    borderRadius: 10,
    border: "1px solid #e2e8f0",
    padding: "0.75rem 1rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08)",
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
  noteMeta: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "0.5rem",
    color: "#475569",
    fontSize: "0.85rem",
  },
  noteContent: {
    margin: 0,
    color: "#0f172a",
    whiteSpace: "pre-wrap",
    lineHeight: 1.5,
  },
  noteLink: {
    marginLeft: "auto",
    color: "#2563eb",
    textDecoration: "underline",
  },
  noteEmpty: {
    color: "#64748b",
    fontStyle: "italic",
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
  primaryButton: {
    background: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "0.5rem 1rem",
    cursor: "pointer",
    fontWeight: 600,
    boxShadow: "0 2px 6px rgba(37, 99, 235, 0.2)",
  },
  secondaryButton: {
    background: "#e2e8f0",
    color: "#1e293b",
    border: "none",
    borderRadius: 8,
    padding: "0.5rem 1rem",
    cursor: "pointer",
    fontWeight: 500,
  },
  auditDetails: {
    marginTop: "0.5rem",
    fontSize: "0.85rem",
    color: "#4b5563",
    lineHeight: 1.4,
  },
  errorText: {
    color: "#b91c1c",
    fontSize: "0.8rem",
  },
  modalForm: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  modalLabel: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
    fontWeight: 500,
    color: "#0f172a",
  },
  modalTextarea: {
    minHeight: "120px",
    borderRadius: 8,
    border: "1px solid #cbd5f5",
    padding: "0.75rem",
    fontFamily: "inherit",
    resize: "vertical",
  },
  modalInput: {
    borderRadius: 8,
    border: "1px solid #cbd5f5",
    padding: "0.5rem 0.75rem",
  },
  modalSubheading: {
    margin: 0,
    fontSize: "1rem",
    fontWeight: 600,
    color: "#0f172a",
  },
  vehicleFormSection: {
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  },
  fieldGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "0.75rem",
  },
  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "0.75rem",
  },
  helperText: {
    fontSize: "0.75rem",
    color: "#64748b",
  },
  vehicleValue: {
    display: "flex",
    flexDirection: "column",
    gap: "0.3rem",
  },
  additionalInfo: {
    fontSize: "0.85rem",
    color: "#475569",
  },
};
