import { LeadStatus } from "../constants/leadStatus";
import { apiFetch } from "./client";

export interface LeadUser {
  id: string;
  fullName: string;
  email: string;
}

export interface LeadPartner {
  id: string;
  name: string;
}

export interface LeadCustomerProfile {
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  address?: {
    city?: string | null;
    voivodeship?: string | null;
    customerType?: string | null;
    [key: string]: unknown;
  } | null;
}

export interface LeadSummary {
  id: string;
  status: LeadStatus;
  partnerId: string;
  leadCreatedAt: string;
  claimedAt?: string | null;
  lastContactAt?: string | null;
  nextActionAt?: string | null;
  assignedUser?: LeadUser | null;
  partner?: LeadPartner | null;
  customerProfile?: LeadCustomerProfile | null;
  consentStatus: "complete" | "incomplete" | "missing_required" | "no_templates";
}

export interface LeadDetail extends LeadSummary {
  applicationForm?: {
    id: string;
    status: string;
    isClientActive: boolean;
    uniqueLink?: string | null;
    linkExpiresAt?: string | null;
    submittedAt?: string | null;
    lastClientActivity?: string | null;
    unlockHistory?: unknown;
    formData?: unknown;
  } | null;
  customerProfile?: LeadCustomerProfile | null;
  notes: LeadNote[];
  vehicleCurrent?: {
    make?: string | null;
    model?: string | null;
    year?: number | null;
    mileage?: number | null;
    ownershipStatus?: string | null;
  } | null;
  vehicleDesired?: {
    make?: string | null;
    model?: string | null;
    year?: number | null;
    budget?: string | null;
    preferences?: Record<string, unknown> | null;
  } | null;
  financingApps: Array<{
    id: string;
    leadId: string;
    bank: string;
    loanAmount?: string | null;
    downPayment?: string | null;
    decision?: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  documents: Array<{
    id: string;
    type: string;
    filePath: string;
    uploadedAt: string;
    checksum?: string | null;
    originalName?: string | null;
    mimeType?: string | null;
    sizeBytes?: number | null;
    storageProvider?: string | null;
  }>;
  offers: Array<{
    id: string;
    title: string;
    price?: string | null;
    availabilityStatus: string;
    createdAt: string;
  }>;
  agreement?: {
    id: string;
    signatureStatus: string;
    signedAt?: string | null;
  } | null;
  auditLogs: Array<{
    id: string;
    action: string;
    field?: string | null;
    metadata?: Record<string, unknown> | null;
    oldValue?: unknown;
    newValue?: unknown;
    createdAt: string;
    user?: {
      id: string;
      fullName: string;
      email: string;
    } | null;
  }>;
  consentRecords: Array<{
    id: string;
    consentTemplateId: string;
    consentType: string;
    applicationFormId?: string | null;
    leadId: string;
    consentGiven: boolean;
    consentMethod: string;
    ipAddress?: string | null;
    userAgent?: string | null;
    recordedByUserId?: string | null;
    partnerId?: string | null;
    recordedAt: string;
    withdrawnAt?: string | null;
    notes?: string | null;
    version: number;
    consentText: string;
    accessCodeHash?: string | null;
    helpTextSnapshot?: string | null;
    createdAt: string;
    updatedAt: string;
    consentTemplate: {
      id: string;
      title: string;
      content: string;
      version: number;
    };
    recordedBy?: {
      id: string;
      fullName: string;
      email: string;
    } | null;
    partner?: {
      id: string;
      name: string;
    } | null;
  }>;
}

export interface LeadNote {
  id: string;
  content: string;
  link?: string | null;
  type: "MANUAL" | "EMAIL_SENT" | "EMAIL_RECEIVED";
  metadata?: {
    to?: string;
    from?: string;
    senderEmail?: string;
    subject?: string;
    links?: string[];
    direction?: "INCOMING" | "OUTGOING";
    html?: string;
    messageId?: string | null;
    replyToNoteId?: string | null;
    quotedHtml?: string | null;
  } | null;
  createdAt: string;
  author?: {
    id: string;
    fullName: string;
    email: string;
  } | null;
}

export const sendLeadEmail = (
  token: string,
  leadId: string,
  payload: {
    message: string;
    links: string[];
    subject?: string;
    replyToNoteId?: string;
    quotedHtml?: string;
    quotedText?: string;
  },
) =>
  apiFetch<LeadNote>(`/api/leads/${leadId}/email`, {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });

export interface LeadListFilters {
  page?: number;
  perPage?: number;
  status?: LeadStatus | "";
  search?: string;
  assigned?: "unassigned" | "";
}

export interface LeadListResponse {
  data: LeadSummary[];
  meta: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

export const fetchLeads = (token: string, filters: LeadListFilters = {}) => {
  const params = new URLSearchParams();
  if (filters.page) params.set("page", String(filters.page));
  if (filters.perPage) params.set("perPage", String(filters.perPage));
  if (filters.status) params.set("status", filters.status);
  if (filters.search) params.set("search", filters.search);
  if (filters.assigned) params.set("assigned", filters.assigned);

  const query = params.toString();
  const path = `/api/leads${query ? `?${query}` : ""}`;

  return apiFetch<LeadListResponse>(path, { token });
};

export const fetchLeadDetail = (token: string, id: string) =>
  apiFetch<LeadDetail>(`/api/leads/${id}`, { token });

export interface CreateLeadPayload {
  partnerId?: string;
  customer: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    customerType?: string;
    city?: string;
    voivodeship?: string;
  };
  currentVehicle?: {
    make?: string;
    model?: string;
    year?: number;
    mileage?: number;
  };
  desiredVehicle?: {
    make?: string;
    model?: string;
    year?: number;
    budget?: number;
    preferences?: {
      notes?: string;
    };
  };
  financing?: {
    downPayment?: number;
  };
}

export const createLead = (token: string, payload: CreateLeadPayload) =>
  apiFetch<LeadSummary>("/api/leads", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });


export const assignLead = (token: string, leadId: string, userId: string | null) =>
  apiFetch<LeadSummary>(`/api/leads/${leadId}/assignment`, {
    method: "PATCH",
    token,
    body: JSON.stringify({ userId }),
  });

export interface CreateApplicationFormLinkPayload {
  accessCode: string;
  expiresInDays?: number;
}

export interface CreateApplicationFormLinkResponse {
  applicationFormId: string;
  link: string;
  expiresAt: string;
  accessCode: string;
}

export const createApplicationFormLink = (
  token: string,
  leadId: string,
  payload: CreateApplicationFormLinkPayload,
) =>
  apiFetch<CreateApplicationFormLinkResponse>(`/api/leads/${leadId}/application-form`, {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });

export interface UpdateLeadStatusPayload {
  status: LeadStatus;
  notes?: string;
  lastContactAt?: string;
}

export const updateLeadStatus = (
  token: string,
  leadId: string,
  payload: UpdateLeadStatusPayload,
) =>
  apiFetch<LeadSummary>(`/api/leads/${leadId}/status`, {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });

export interface UpdateLeadCustomerPayload {
  firstName?: string;
  lastName?: string;
  email?: string | null;
  phone?: string | null;
  customerType?: string | null;
  city?: string | null;
  voivodeship?: string | null;
}

export const updateLeadCustomer = (
  token: string,
  leadId: string,
  payload: UpdateLeadCustomerPayload,
) =>
  apiFetch<Pick<LeadDetail, "customerProfile">>(`/api/leads/${leadId}/customer`, {
    method: "PATCH",
    token,
    body: JSON.stringify(payload),
  });

export interface CreateLeadNotePayload {
  content: string;
  link?: string;
}

export const createLeadNote = (
  token: string,
  leadId: string,
  payload: CreateLeadNotePayload,
) =>
  apiFetch<LeadNote>(`/api/leads/${leadId}/notes`, {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });

export interface FinancingApplication {
  id: string;
  leadId: string;
  bank: string;
  loanAmount?: string | null;
  downPayment?: string | null;
  termMonths?: number | null;
  income?: string | null;
  expenses?: string | null;
  decision?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FinancingPayload {
  applicationId?: string;
  bank: string;
  loanAmount?: number;
  downPayment?: number;
  termMonths?: number;
  income?: number;
  expenses?: number;
  decision?: string;
}

export const saveFinancingApplication = (
  token: string,
  leadId: string,
  payload: FinancingPayload,
) =>
  apiFetch<FinancingApplication>(`/api/leads/${leadId}/financing`, {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });

export interface CreateDocumentPayload {
  type: string;
  file: File;
}

export const uploadLeadDocument = (
  token: string,
  leadId: string,
  payload: CreateDocumentPayload,
) => {
  const formData = new FormData();
  formData.append("file", payload.file);
  formData.append("type", payload.type);

  return apiFetch<{ id: string }>(`/api/leads/${leadId}/documents/upload`, {
    method: "POST",
    token,
    body: formData,
  });
};

export async function generateApplicationFormLink(token: string, leadId: string, accessCode: string, expiresInDays?: number) {
  const response = await apiFetch<CreateApplicationFormLinkResponse>(`/api/leads/${leadId}/application-form`, {
    method: "POST",
    token,
    body: JSON.stringify({ accessCode, expiresInDays }),
  });
  return response;
}

export async function anonymizeLead(token: string, leadId: string) {
  return apiFetch(`/api/leads/${leadId}/anonymize`, {
    method: "POST",
    token,
  });
}



export interface UpdateLeadVehiclesPayload {
  current?: {
    make?: string;
    model?: string;
    year?: number;
    mileage?: number;
    ownershipStatus?: string;
  } | null;
  desired?: {
    make?: string;
    model?: string;
    year?: number;
    budget?: number | null;
    notes?: string;
  } | null;
  amountAvailable?: number | null;
}

export const updateLeadVehicles = (
  token: string,
  leadId: string,
  payload: UpdateLeadVehiclesPayload,
) =>
  apiFetch<Pick<LeadDetail, "vehicleCurrent" | "vehicleDesired" | "financingApps">>(
    `/api/leads/${leadId}/vehicles`,
    {
      method: "PATCH",
      token,
      body: JSON.stringify(payload),
    },
  );
