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
