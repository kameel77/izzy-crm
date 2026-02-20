import { apiFetch } from "./client";

export interface SaveProgressPayload {
  formData: object;
  currentStep: number;
  completionPercent: number;
}

export async function saveApplicationFormProgress(
  applicationFormId: string,
  payload: SaveProgressPayload,
) {
  return apiFetch<{ id: string; lastAutoSave: string }>(
    `/api/application-forms/${applicationFormId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

export async function getApplicationForm(applicationFormId: string) {
  return apiFetch(`/api/application-forms/${applicationFormId}`);
}

export const submitApplicationForm = (applicationFormId: string, formData: Record<string, unknown>) => {
  return apiFetch(`/api/application-forms/${applicationFormId}/submit`, {
    method: 'POST',
    body: JSON.stringify({ formData }),
  });
};

export const unlockApplicationForm = (applicationFormId: string, reason?: string) => {
  return apiFetch(`/api/application-forms/${applicationFormId}/unlock`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
};

export const verifyApplicationFormAccess = (payload: {
  applicationFormId: string;
  leadId: string;
  code: string;
}) => {
  return apiFetch<{ ok: true }>(`/api/application-forms/verify-access`, {
    method: "POST",
    body: JSON.stringify(payload),
    token: null,
  });
};

export const heartbeatApplicationForm = (applicationFormId: string) => {
  return apiFetch<{ ok: true }>(`/api/application-forms/${applicationFormId}/heartbeat`, {
    method: "POST",
    token: null,
  });
};

