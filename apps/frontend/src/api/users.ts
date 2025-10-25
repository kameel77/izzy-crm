import { apiFetch } from "./client";

export interface UserSummary {
  id: string;
  email: string;
  fullName: string;
  phone?: string | null;
  role: string;
  status: string;
  partner?: {
    id: string;
    name: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserListResponse {
  data: UserSummary[];
  meta: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

export interface UserFilters {
  page?: number;
  perPage?: number;
  role?: string;
  status?: string;
  partnerId?: string;
  search?: string;
}

export const fetchUsers = (token: string, filters: UserFilters = {}) => {
  const params = new URLSearchParams();
  if (filters.page) params.set("page", String(filters.page));
  if (filters.perPage) params.set("perPage", String(filters.perPage));
  if (filters.role) params.set("role", filters.role);
  if (filters.status) params.set("status", filters.status);
  if (filters.partnerId) params.set("partnerId", filters.partnerId);
  if (filters.search) params.set("search", filters.search);

  const query = params.toString();
  return apiFetch<UserListResponse>(`/api/users${query ? `?${query}` : ""}`, {
    token,
  });
};

export interface CreateUserPayload {
  email: string;
  fullName: string;
  role: string;
  phone?: string;
  partnerId?: string;
  status?: string;
  password?: string;
}

export const createUser = (token: string, payload: CreateUserPayload) =>
  apiFetch<UserSummary>("/api/users", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });

export interface UpdateUserPayload {
  id: string;
  fullName?: string;
  phone?: string | null;
  role?: string;
  status?: string;
  partnerId?: string | null;
  password?: string;
}

export const updateUser = (token: string, payload: UpdateUserPayload) =>
  apiFetch<UserSummary>(`/api/users/${payload.id}`, {
    method: "PATCH",
    token,
    body: JSON.stringify({
      fullName: payload.fullName,
      phone: payload.phone,
      role: payload.role,
      status: payload.status,
      partnerId: payload.partnerId,
      password: payload.password,
    }),
  });

export const resetPassword = (token: string, userId: string, password: string) =>
  apiFetch<void>(`/api/users/${userId}/reset-password`, {
    method: "POST",
    token,
    body: JSON.stringify({ password }),
  });
