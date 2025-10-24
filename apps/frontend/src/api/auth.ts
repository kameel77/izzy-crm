import { apiFetch } from "./client";

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  partnerId?: string | null;
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
