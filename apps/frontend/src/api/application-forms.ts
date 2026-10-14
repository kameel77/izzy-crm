import { apiFetch } from "./client";

export interface SaveProgressPayload {
  formData: object;
  currentStep: number;
  completionPercent: number;
}

const buildAccessHeaders = (accessCodeHash?: string | null): HeadersInit | undefined =>
  accessCodeHash ? { "X-Form-Access-Hash": accessCodeHash } : undefined;

export async function saveApplicationFormProgress(
  applicationFormId: string,
  payload: SaveProgressPayload,
  accessCodeHash?: string | null,
) {
  return apiFetch<{ id: string; lastAutoSave: string }>(
    `/api/application-forms/${applicationFormId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
      headers: buildAccessHeaders(accessCodeHash),
    },
  );
}

export async function getApplicationForm(
  applicationFormId: string,
  accessCodeHash?: string | null,
) {
  return apiFetch< {
    id: string;
    status?: string;
    currentStep?: number;
    completionPercent?: number;
    formData?: Record<string, unknown> | null;
    submittedAt?: string | null;
  }>(`/api/application-forms/${applicationFormId}`, {
    headers: buildAccessHeaders(accessCodeHash),
  });
}

export const submitApplicationForm = (
  applicationFormId: string,
  formData: Record<string, unknown>,
  accessCodeHash?: string | null,
) => {
  return apiFetch(`/api/application-forms/${applicationFormId}/submit`, {
    method: "POST",
    body: JSON.stringify({ formData }),
    headers: buildAccessHeaders(accessCodeHash),
  });
};

export const unlockApplicationForm = (applicationFormId: string, reason?: string) => {
  return apiFetch(`/api/application-forms/${applicationFormId}/unlock`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
};

export const verifyApplicationFormAccess = (payload: {
  applicationFormId: string;
  leadId: string;
  code: string;
}) => {
  return apiFetch<{ ok: true; accessCodeHash?: string }>(`/api/application-forms/verify-access`, {
    method: "POST",
    body: JSON.stringify(payload),
    token: null,
  });
};

export const heartbeatApplicationForm = (
  applicationFormId: string,
  accessCodeHash?: string | null,
) => {
  return apiFetch<{ ok: true }>(`/api/application-forms/${applicationFormId}/heartbeat`, {
    method: "POST",
    token: null,
    headers: buildAccessHeaders(accessCodeHash),
  });
};

