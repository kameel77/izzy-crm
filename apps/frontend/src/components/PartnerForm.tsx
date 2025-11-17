import React, { useState } from "react";

import {
  CreatePartnerPayload,
  PartnerSummary,
  PartnerStatus,
  UpdatePartnerPayload,
} from "../api/partners";

interface PartnerFormProps {
  mode: "create" | "edit";
  partner?: PartnerSummary | null;
  onSubmit: (payload: CreatePartnerPayload | UpdatePartnerPayload) => Promise<unknown>;
  onSuccess?: () => void;
}

const PARTNER_STATUSES: PartnerStatus[] = ["ACTIVE", "INACTIVE", "PENDING"];

export const PartnerForm: React.FC<PartnerFormProps> = ({ mode, partner, onSubmit, onSuccess }) => {
  const [name, setName] = useState(partner?.name ?? "");
  const [status, setStatus] = useState<PartnerStatus>(partner?.status ?? "ACTIVE");
  const [contactName, setContactName] = useState(partner?.contact?.name ?? "");
  const [contactEmail, setContactEmail] = useState(partner?.contact?.email ?? "");
  const [contactPhone, setContactPhone] = useState(partner?.contact?.phone ?? "");
  const [responseMinutes, setResponseMinutes] = useState(
    partner?.slaRules && typeof partner.slaRules === "object" && "leadResponseMinutes" in partner.slaRules
      ? Number(partner.slaRules.leadResponseMinutes)
      : "",
  );
  const [contractDays, setContractDays] = useState(
    partner?.slaRules && typeof partner.slaRules === "object" && "contractTurnaroundDays" in partner.slaRules
      ? Number(partner.slaRules.contractTurnaroundDays)
      : "",
  );
  const [notes, setNotes] = useState(partner?.notes ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buildContactPayload = () => {
    const hasContact = contactName || contactEmail || contactPhone;
    if (!hasContact) return null;
    return {
      name: contactName || undefined,
      email: contactEmail || undefined,
      phone: contactPhone || undefined,
    };
  };

  const buildSlaPayload = () => {
    const payload: Record<string, number> = {};
    if (responseMinutes) {
      payload.leadResponseMinutes = Number(responseMinutes);
    }
    if (contractDays) {
      payload.contractTurnaroundDays = Number(contractDays);
    }
    return Object.keys(payload).length ? payload : null;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const contactPayload = buildContactPayload();
    const slaPayload = buildSlaPayload();

    const basePayload: CreatePartnerPayload = {
      name,
      status,
      contact: contactPayload,
      slaRules: slaPayload,
      notes: notes ? notes : null,
    };

    try {
      if (mode === "edit" && partner) {
        await onSubmit({ ...(basePayload as UpdatePartnerPayload), id: partner.id });
      } else {
        await onSubmit(basePayload);
      }
      if (!partner) {
        setName("");
        setStatus("ACTIVE");
        setContactName("");
        setContactEmail("");
        setContactPhone("");
        setResponseMinutes("");
        setContractDays("");
        setNotes("");
      }
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save partner");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form style={styles.form} onSubmit={handleSubmit}>
      <label style={styles.field}>
        <span>Name</span>
        <input
          type="text"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          style={styles.input}
        />
      </label>

      <label style={styles.field}>
        <span>Status</span>
        <select value={status} onChange={(event) => setStatus(event.target.value as PartnerStatus)} style={styles.input}>
          {PARTNER_STATUSES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <fieldset style={styles.fieldset}>
        <legend style={styles.legend}>Primary contact</legend>
        <label style={styles.field}>
          <span>Contact name</span>
          <input
            type="text"
            value={contactName}
            onChange={(event) => setContactName(event.target.value)}
            style={styles.input}
          />
        </label>
        <label style={styles.field}>
          <span>Contact email</span>
          <input
            type="email"
            value={contactEmail}
            onChange={(event) => setContactEmail(event.target.value)}
            style={styles.input}
          />
        </label>
        <label style={styles.field}>
          <span>Contact phone</span>
          <input
            type="tel"
            value={contactPhone}
            onChange={(event) => setContactPhone(event.target.value)}
            style={styles.input}
          />
        </label>
      </fieldset>

      <fieldset style={styles.fieldset}>
        <legend style={styles.legend}>SLA (optional)</legend>
        <label style={styles.field}>
          <span>Lead response minutes</span>
          <input
            type="number"
            min={0}
            value={responseMinutes}
            onChange={(event) => setResponseMinutes(event.target.value)}
            style={styles.input}
          />
        </label>
        <label style={styles.field}>
          <span>Contract turnaround days</span>
          <input
            type="number"
            min={0}
            value={contractDays}
            onChange={(event) => setContractDays(event.target.value)}
            style={styles.input}
          />
        </label>
      </fieldset>

      <label style={styles.field}>
        <span>Notes</span>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          style={{ ...styles.input, minHeight: "120px", resize: "vertical" }}
        />
      </label>

      {error ? <div style={styles.error}>{error}</div> : null}

      <button type="submit" style={styles.submit} disabled={isSubmitting}>
        {isSubmitting ? "Saving..." : mode === "edit" ? "Save changes" : "Create partner"}
      </button>
    </form>
  );
};

const styles: Record<string, React.CSSProperties> = {
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "0.35rem",
    fontSize: "0.9rem",
  },
  fieldset: {
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    padding: "1rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  },
  legend: {
    padding: "0 0.5rem",
    fontWeight: 600,
    color: "#334155",
  },
  input: {
    padding: "0.65rem 0.85rem",
    borderRadius: 8,
    border: "1px solid #cbd5f5",
    fontSize: "1rem",
  },
  submit: {
    marginTop: "0.5rem",
    padding: "0.75rem 1rem",
    borderRadius: 8,
    border: "none",
    background: "#2563eb",
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
    boxShadow: "0 10px 20px rgba(37, 99, 235, 0.35)",
  },
  error: {
    background: "#fee2e2",
    color: "#b91c1c",
    padding: "0.75rem",
    borderRadius: 8,
  },
};
