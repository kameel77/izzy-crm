import { LeadStatus } from "../constants/leadStatus";
import { API_BASE_URL, ApiError, apiFetch } from "./client";

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
}

export interface LeadDetail extends LeadSummary {
  customerProfile?: LeadCustomerProfile | null;
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
    bank: string;
    loanAmount?: string | null;
    decision?: string | null;
    createdAt: string;
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
  leadNotes: LeadNote[];
}

export interface LeadNoteAttachment {
  id: string;
  originalName: string;
  mimeType?: string | null;
  sizeBytes: number;
  downloadUrl: string;
  storageProvider: string;
  createdAt: string;
}

export interface LeadNote {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  author: LeadUser | null;
  attachments: LeadNoteAttachment[];
}

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
  checksum?: string;
}

export const uploadLeadDocument = (
  token: string,
  leadId: string,
  payload: CreateDocumentPayload,
) => {
  const formData = new FormData();
  formData.append("file", payload.file);
  formData.append("type", payload.type);
  if (payload.checksum) {
    formData.append("checksum", payload.checksum);
  }

  return apiFetch<{ id: string }>(`/api/leads/${leadId}/documents/upload`, {
    method: "POST",
    token,
    body: formData,
  });
};

export interface CreateLeadNotePayload {
  content: string;
  attachments?: File[];
}

export const createLeadNote = async (
  token: string,
  leadId: string,
  payload: CreateLeadNotePayload,
) => {
  const formData = new FormData();
  formData.append("content", payload.content);
  if (payload.attachments?.length) {
    payload.attachments.forEach((file) => {
      formData.append("attachments", file);
    });
  }

  return apiFetch<LeadNote>(`/api/leads/${leadId}/notes`, {
    method: "POST",
    token,
    body: formData,
  });
};

export interface DownloadAttachmentResult {
  blob: Blob;
  filename: string;
  contentType: string;
}

const parseContentDisposition = (header: string | null): string => {
  if (!header) return "attachment";
  const filenameStarMatch = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (filenameStarMatch?.[1]) {
    try {
      return decodeURIComponent(filenameStarMatch[1]);
    } catch (error) {
      return filenameStarMatch[1];
    }
  }
  const filenameMatch = header.match(/filename="?([^";]+)"?/i);
  return filenameMatch?.[1] ?? "attachment";
};

export const downloadLeadNoteAttachment = async (
  token: string,
  leadId: string,
  noteId: string,
  attachmentId: string,
): Promise<DownloadAttachmentResult> => {
  const response = await fetch(
    `${API_BASE_URL}/api/leads/${leadId}/notes/${noteId}/attachments/${attachmentId}/download`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) {
    const message = `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status, await response.text());
  }

  const blob = await response.blob();
  const filename = parseContentDisposition(response.headers.get("content-disposition"));
  const contentType = response.headers.get("content-type") ?? "application/octet-stream";

  return { blob, filename, contentType };
};
