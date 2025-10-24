import React, { useState } from "react";

import { LeadDetail } from "../api/leads";
import {
  LEAD_STATUS_LABELS,
  LEAD_STATUS_TRANSITIONS,
  LeadStatus,
} from "../constants/leadStatus";

interface StatusUpdateFormProps {
  lead: LeadDetail;
  onSubmit: (payload: { status: LeadStatus; notes?: string }) => Promise<void>;
}

export const StatusUpdateForm: React.FC<StatusUpdateFormProps> = ({ lead, onSubmit }) => {
  const [status, setStatus] = useState<LeadStatus>(
    LEAD_STATUS_TRANSITIONS[lead.status][0] ?? lead.status,
  );
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableStatuses = LEAD_STATUS_TRANSITIONS[lead.status];

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!availableStatuses.length) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmit({ status, notes: notes.trim() || undefined });
      setNotes("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!availableStatuses.length) {
    return <p style={styles.hint}>This lead is complete. No further transitions available.</p>;
  }

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <h3 style={styles.title}>Update Status</h3>
      <label style={styles.label}>
        Next status
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as LeadStatus)}
          style={styles.select}
        >
          {availableStatuses.map((value) => (
            <option key={value} value={value}>
              {LEAD_STATUS_LABELS[value]}
            </option>
          ))}
        </select>
      </label>
      <label style={styles.label}>
        Notes (optional)
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          style={styles.textarea}
          rows={3}
        />
      </label>
      {error ? <div style={styles.error}>{error}</div> : null}
      <button type="submit" style={styles.submit} disabled={isSubmitting}>
        {isSubmitting ? "Updating..." : "Update Status"}
      </button>
    </form>
  );
};

const styles: Record<string, React.CSSProperties> = {
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    padding: "1rem",
  },
  title: {
    margin: 0,
    fontSize: "1rem",
    fontWeight: 600,
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: "0.35rem",
    fontSize: "0.9rem",
  },
  select: {
    padding: "0.5rem 0.75rem",
    borderRadius: 8,
    border: "1px solid #d1d5db",
  },
  textarea: {
    padding: "0.5rem 0.75rem",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    resize: "vertical",
  },
  submit: {
    alignSelf: "flex-start",
    padding: "0.5rem 1rem",
    border: "none",
    borderRadius: 8,
    background: "#2563eb",
    color: "#fff",
    cursor: "pointer",
  },
  error: {
    background: "#fee2e2",
    color: "#b91c1c",
    padding: "0.5rem",
    borderRadius: 8,
  },
  hint: {
    margin: "1rem 0",
    padding: "0.75rem",
    borderRadius: 8,
    background: "#f3f4f6",
    color: "#4b5563",
  },
};
