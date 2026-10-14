import React, { useId, useState } from "react";

import { LeadDetail } from "../api/leads";
import {
  LEAD_STATUS_LABELS,
  LEAD_STATUSES,
  LeadStatus,
} from "../constants/leadStatus";
import { Button, Icon } from "./ui";

interface StatusUpdateFormProps {
  lead: LeadDetail;
  onSubmit: (payload: { status: LeadStatus; notes?: string }) => Promise<void>;
}

export const StatusUpdateForm: React.FC<StatusUpdateFormProps> = ({ lead, onSubmit }) => {
  const [status, setStatus] = useState<LeadStatus>(lead.status);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const statusId = useId();
  const notesId = useId();

  const availableStatuses = LEAD_STATUSES.filter((s) => s !== lead.status);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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
    return <div className="app-alert app-alert--info">No other statuses available for selection.</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="app-form app-panel">
      <h3 className="app-section-title">Update status</h3>
      <div className="iz-field">
        <label className="iz-field__label" htmlFor={statusId}>
          Next status
        </label>
        <div className="iz-field__control">
          <select
            id={statusId}
            value={status}
            onChange={(event) => setStatus(event.target.value as LeadStatus)}
          >
            <option value={lead.status} disabled>
              {LEAD_STATUS_LABELS[lead.status]} (Current)
            </option>
            {availableStatuses.map((value) => (
              <option key={value} value={value}>
                {LEAD_STATUS_LABELS[value]}
              </option>
            ))}
          </select>
          <Icon name="chevron-down" size={16} className="iz-field__chevron" />
        </div>
      </div>
      <div className="iz-field">
        <label className="iz-field__label" htmlFor={notesId}>
          Notes <em>(optional)</em>
        </label>
        <textarea
          id={notesId}
          className="app-textarea"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
        />
      </div>
      {error ? <div className="app-alert app-alert--danger">{error}</div> : null}
      <div className="app-form-actions app-form-actions--start">
        <Button type="submit" variant="secondary" disabled={isSubmitting}>
          {isSubmitting ? "Updating..." : "Update status"}
        </Button>
      </div>
    </form>
  );
};
