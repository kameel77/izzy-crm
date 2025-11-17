import { apiFetch } from "./client";

export type PartnerStatus = "ACTIVE" | "INACTIVE" | "PENDING";

export interface PartnerContact {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
}

export interface PartnerSummary {
  id: string;
  name: string;
  status: PartnerStatus;
  contact: PartnerContact | null;
  slaRules: Record<string, unknown> | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PartnerFilters {
  page?: number;
  perPage?: number;
  status?: PartnerStatus;
  search?: string;
}

export interface PartnerListResponse {
  data: PartnerSummary[];
  meta: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

export interface CreatePartnerPayload {
  name: string;
  status?: PartnerStatus;
  contact?: PartnerContact | null;
  slaRules?: Record<string, unknown> | null;
  notes?: string | null;
}

export interface UpdatePartnerPayload extends CreatePartnerPayload {
  id: string;
}

export const fetchPartners = async (token: string, filters: PartnerFilters = {}) => {
  const params = new URLSearchParams();
  if (filters.page) params.set("page", String(filters.page));
  if (filters.perPage) params.set("perPage", String(filters.perPage));
  if (filters.status) params.set("status", filters.status);
  if (filters.search) params.set("search", filters.search);

  const query = params.toString();
  return apiFetch<PartnerListResponse>(`/api/partners${query ? `?${query}` : ""}`, {
    token,
  });
};

export const createPartner = async (token: string, payload: CreatePartnerPayload) => {
  return apiFetch<PartnerSummary>("/api/partners", {
    method: "POST",
    body: JSON.stringify(payload),
    token,
  });
};

export const updatePartner = async (token: string, payload: UpdatePartnerPayload) => {
  return apiFetch<PartnerSummary>(`/api/partners/${payload.id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
    token,
  });
};
