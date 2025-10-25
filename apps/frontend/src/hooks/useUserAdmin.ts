import { useCallback, useState } from "react";

import {
  CreateUserPayload,
  UpdateUserPayload,
  createUser,
  fetchUsers,
  resetPassword,
  updateUser,
  UserFilters,
  UserListResponse,
  UserSummary,
} from "../api/users";
import { useAuth } from "./useAuth";

interface UseUserAdminOptions {
  initialFilters?: UserFilters;
}

export const useUserAdmin = (options: UseUserAdminOptions = {}) => {
  const { token } = useAuth();
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [meta, setMeta] = useState<UserListResponse["meta"] | null>(null);
  const [filters, setFilters] = useState<UserFilters>(options.initialFilters || {});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadUsers = useCallback(
    async (override: Partial<UserFilters> = {}) => {
      if (!token) return;
      setIsLoading(true);
      setError(null);
      try {
        const nextFilters = { ...filters, ...override };
        const response = await fetchUsers(token, nextFilters);
        setUsers(response.data);
        setMeta(response.meta);
        setFilters(nextFilters);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load users");
      } finally {
        setIsLoading(false);
      }
    },
    [token, filters],
  );

  const handleCreateUser = useCallback(
    async (payload: CreateUserPayload) => {
      if (!token) return;
      setError(null);
      setSuccess(null);
      try {
        await createUser(token, payload);
        setSuccess(`User ${payload.email} invited/created`);
        await loadUsers();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create user");
        throw err;
      }
    },
    [token, loadUsers],
  );

  const handleUpdateUser = useCallback(
    async (payload: UpdateUserPayload) => {
      if (!token) return;
      setError(null);
      setSuccess(null);
      try {
        await updateUser(token, payload);
        setSuccess("User updated");
        await loadUsers();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update user");
        throw err;
      }
    },
    [token, loadUsers],
  );

  const handleResetPassword = useCallback(
    async (userId: string, password: string) => {
      if (!token) return;
      setError(null);
      setSuccess(null);
      try {
        await resetPassword(token, userId, password);
        setSuccess("Password reset");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to reset password");
        throw err;
      }
    },
    [token],
  );

  return {
    users,
    meta,
    filters,
    isLoading,
    error,
    success,
    loadUsers,
    createUser: handleCreateUser,
    updateUser: handleUpdateUser,
    resetPassword: handleResetPassword,
    setFilters,
    setError,
    setSuccess,
  };
};
