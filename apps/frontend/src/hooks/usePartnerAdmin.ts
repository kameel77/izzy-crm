import { useCallback, useMemo, useRef, useState } from "react";

import {
  CreatePartnerPayload,
  PartnerFilters,
  PartnerListResponse,
  PartnerSummary,
  UpdatePartnerPayload,
  createPartner,
  fetchPartners,
  updatePartner,
} from "../api/partners";
import { useAuth } from "./useAuth";

interface UsePartnerAdminOptions {
  initialFilters?: PartnerFilters;
}

export const usePartnerAdmin = (options: UsePartnerAdminOptions = {}) => {
  const { token } = useAuth();
  const [partners, setPartners] = useState<PartnerSummary[]>([]);
  const [meta, setMeta] = useState<PartnerListResponse["meta"] | null>(null);
  const initialFilters = useMemo(() => options.initialFilters || {}, [options.initialFilters]);
  const filtersRef = useRef<PartnerFilters>(initialFilters);
  const [filters, setFilters] = useState<PartnerFilters>(initialFilters);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadPartners = useCallback(
    async (override: Partial<PartnerFilters> = {}) => {
      if (!token) return;
      setIsLoading(true);
      setError(null);
      try {
        filtersRef.current = { ...filtersRef.current, ...override };
        const nextFilters = filtersRef.current;
        const response = await fetchPartners(token, nextFilters);
        setPartners(response.data);
        setMeta(response.meta);
        setFilters(nextFilters);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load partners");
      } finally {
        setIsLoading(false);
      }
    },
    [token],
  );

  const handleCreatePartner = useCallback(
    async (payload: CreatePartnerPayload) => {
      if (!token) return;
      setError(null);
      setSuccess(null);
      try {
        await createPartner(token, payload);
        setSuccess(`Partner ${payload.name} created`);
        await loadPartners();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create partner");
        throw err;
      }
    },
    [token, loadPartners],
  );

  const handleUpdatePartner = useCallback(
    async (payload: UpdatePartnerPayload) => {
      if (!token) return;
      setError(null);
      setSuccess(null);
      try {
        await updatePartner(token, payload);
        setSuccess("Partner updated");
        await loadPartners();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update partner");
        throw err;
      }
    },
    [token, loadPartners],
  );

  return {
    partners,
    meta,
    filters,
    isLoading,
    error,
    success,
    loadPartners,
    createPartner: handleCreatePartner,
    updatePartner: handleUpdatePartner,
    setError,
    setSuccess,
  };
};
