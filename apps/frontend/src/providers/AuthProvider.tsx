import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { loginRequest, AuthUser } from "../api/auth";
import { AUTH_STORAGE_KEY } from "../constants/auth";

interface AuthContextValue {
  token: string | null;
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface StoredAuth {
  token: string;
  user: AuthUser;
}

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as StoredAuth;
        setToken(parsed.token);
        setUser(parsed.user);
      } catch (error) {
        console.warn("Failed to parse auth payload", error);
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await loginRequest(email, password);
    setToken(response.token);
    setUser(response.user);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(response));
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }, []);

  const value = useMemo(
    () => ({
      token,
      user,
      isLoading,
      login,
      logout,
    }),
    [token, user, isLoading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return context;
};
