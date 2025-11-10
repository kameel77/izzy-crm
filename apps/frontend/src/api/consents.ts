import { apiFetch } from "./client";

export type ConsentTemplateDto = {
  id: string;
  consentType: string;
  formType: string;
  title: string;
  content: string;
  helpText?: string | null;
  version: number;
  isActive: boolean;
  isRequired: boolean;
  tags: string[];
};

export async function fetchConsentTemplates(params: {
  formType?: string;
  applicationFormId: string;
  leadId: string;
}) {
  const query = new URLSearchParams();
  if (params.formType) {
    query.set("form_type", params.formType);
  }
  query.set("applicationFormId", params.applicationFormId);
  query.set("leadId", params.leadId);

  const response = await apiFetch<{ data: ConsentTemplateDto[] }>(
    `/api/consent-templates?${query.toString()}`,
    { token: null },
  );
  return response.data;
}

export async function fetchAuthenticatedConsentTemplates(params: { formType: string, includeInactive?: boolean }) {
  const query = new URLSearchParams();
  query.set("form_type", params.formType);
  if (params.includeInactive) {
    query.set("include_inactive", "true");
  }

  const response = await apiFetch<{ data: ConsentTemplateDto[] }>(
    `/api/consent-templates?${query.toString()}`,
  );
  return response.data;
}

export type CreateConsentTemplatePayload = Omit<ConsentTemplateDto, "id" | "tags"> & { tags?: string[] };
export type UpdateConsentTemplatePayload = Partial<CreateConsentTemplatePayload>;

export async function createConsentTemplate(payload: CreateConsentTemplatePayload) {
  return apiFetch<ConsentTemplateDto>("/api/consent-templates", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateConsentTemplate(id: string, payload: UpdateConsentTemplatePayload) {
  return apiFetch<ConsentTemplateDto>(`/api/consent-templates/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteConsentTemplate(id: string) {
  return apiFetch(`/api/consent-templates/${id}`, {
    method: "DELETE",
  });
}

export type SubmitConsentRequest = {
  applicationFormId: string;
  leadId: string;
  accessCodeHash: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  consents: Array<{
    consentTemplateId: string;
    version: number;
    consentGiven: boolean;
    consentText?: string;
    acceptedAt?: string;
  }>;
};

export async function submitConsents(payload: SubmitConsentRequest) {
  return apiFetch<{ processed: number }>("/api/consent-records", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function logUnlockAttempt(applicationFormId: string, success: boolean) {
  try {
    await apiFetch(`/api/application-forms/${applicationFormId}/log-unlock-attempt`, {
      method: "POST",
      body: JSON.stringify({ success }),
      token: null, // Ensure this is an unauthenticated call
    });
  } catch (error) {
    // Fail silently on the client side
    console.warn("Failed to log unlock attempt", error);
  }
}
