import React, { useId, useState } from "react";

import {
  CreatePartnerPayload,
  PartnerSummary,
  PartnerStatus,
  UpdatePartnerPayload,
} from "../api/partners";
import { Button, Select, TextField } from "./ui";

interface PartnerFormProps {
  mode: "create" | "edit";
  partner?: PartnerSummary | null;
  onSubmit: (payload: CreatePartnerPayload | UpdatePartnerPayload) => Promise<unknown>;
  onSuccess?: () => void;
}

const PARTNER_STATUSES: PartnerStatus[] = ["ACTIVE", "INACTIVE", "PENDING"];

export const PartnerForm: React.FC<PartnerFormProps> = ({ mode, partner, onSubmit, onSuccess }) => {
  const notesId = useId();
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
    <form className="app-form" onSubmit={handleSubmit}>
      <TextField
        label="Name"
        type="text"
        required
        value={name}
        onChange={(event) => setName(event.target.value)}
      />

      <Select
        label="Status"
        value={status}
        onChange={(event) => setStatus(event.target.value as PartnerStatus)}
        options={PARTNER_STATUSES}
      />

      <fieldset className="app-panel app-adm-fieldset">
        <legend className="app-section-title app-adm-legend">Primary contact</legend>
        <TextField
          label="Contact name"
          type="text"
          value={contactName}
          onChange={(event) => setContactName(event.target.value)}
        />
        <TextField
          label="Contact email"
          type="email"
          value={contactEmail}
          onChange={(event) => setContactEmail(event.target.value)}
        />
        <TextField
          label="Contact phone"
          type="tel"
          value={contactPhone}
          onChange={(event) => setContactPhone(event.target.value)}
        />
      </fieldset>

      <fieldset className="app-panel app-adm-fieldset">
        <legend className="app-section-title app-adm-legend">SLA (optional)</legend>
        <TextField
          label="Lead response minutes"
          type="number"
          min={0}
          value={responseMinutes}
          onChange={(event) => setResponseMinutes(event.target.value)}
        />
        <TextField
          label="Contract turnaround days"
          type="number"
          min={0}
          value={contractDays}
          onChange={(event) => setContractDays(event.target.value)}
        />
      </fieldset>

      <div className="iz-field">
        <label className="iz-field__label" htmlFor={notesId}>
          Notes
        </label>
        <textarea
          id={notesId}
          className="app-textarea"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </div>

      {error ? <div className="app-alert app-alert--danger">{error}</div> : null}

      <div className="app-form-actions">
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : mode === "edit" ? "Save changes" : "Create partner"}
        </Button>
      </div>
    </form>
  );
};
