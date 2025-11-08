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

export async function fetchConsentTemplates(formType = "financing_application") {
  const response = await apiFetch<{ data: ConsentTemplateDto[] }>(
    `/api/consent-templates?form_type=${encodeURIComponent(formType)}`,
  );
  return response.data;
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
