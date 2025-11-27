import { AUTH_STORAGE_KEY } from "../constants/auth";

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

const DEFAULT_BASE_URL = "http://localhost:4000";

let hasScheduledLogout = false;

const clearStoredAuth = () => {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch (error) {
    console.warn("Failed to clear stored auth", error);
  }
};

const redirectToLogin = () => {
  if (typeof window === "undefined") return;
  const currentLocation = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const redirectParam = encodeURIComponent(currentLocation || "/");
  window.location.replace(`/login?reason=expired&from=${redirectParam}`);
};

const handleUnauthorized = () => {
  if (hasScheduledLogout) return;
  hasScheduledLogout = true;
  clearStoredAuth();
  redirectToLogin();
};

export const API_BASE_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) ||
  DEFAULT_BASE_URL;

interface ApiFetchOptions extends RequestInit {
  token?: string | null;
}

export async function apiFetch<TResponse>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<TResponse> {
  const { token: tokenOption, headers, ...rest } = options;
  const init: RequestInit = { ...rest };
  const mergedHeaders = new Headers(headers as HeadersInit | undefined);
  const isFormData = init.body instanceof FormData;

  if (!isFormData && init.body !== undefined && !mergedHeaders.has("Content-Type")) {
    mergedHeaders.set("Content-Type", "application/json");
  }

  let token = tokenOption;
  if (token === undefined) {
    const rawAuth = localStorage.getItem(AUTH_STORAGE_KEY);
    if (rawAuth) {
      try {
        const parsedAuth = JSON.parse(rawAuth);
        token = parsedAuth.token;
      } catch {
        token = null;
      }
    } else {
      token = null;
    }
  }

  if (token === null) {
    mergedHeaders.delete("Authorization");
  } else if (token) {
    mergedHeaders.set("Authorization", `Bearer ${token}`);
  }

  console.log("Using token for auth:", token);

  init.headers = mergedHeaders;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
  });

  let payload: unknown = null;
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    payload = await response.json();
  } else if (response.status !== 204) {
    payload = await response.text();
  }

  if (!response.ok) {
    if (response.status === 401 && token) {
      handleUnauthorized();
    }

    const message =
      (typeof payload === "object" && payload && "message" in payload
        ? (payload as { message?: string }).message
        : undefined) || `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status, payload);
  }

  return payload as TResponse;
}
