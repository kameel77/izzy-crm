import { apiFetch } from "./client";

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  partnerId?: string | null;
  partner?: { id: string; name: string } | null;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

export const loginRequest = (email: string, password: string) =>
  apiFetch<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

export const requestPasswordReset = (email: string) =>
  apiFetch<void>("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
