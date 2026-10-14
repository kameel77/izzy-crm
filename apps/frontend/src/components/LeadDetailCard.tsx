import React, { useCallback, useEffect, useId, useMemo, useState } from "react";

import {
  LeadDetail,
  FinancingPayload,
  assignLead,
  createLeadNote,
  updateLeadVehicles,
  LeadNote,
  generateApplicationFormLink,
  CreateApplicationFormLinkResponse,
  anonymizeLead,
  updateLeadCustomer,
} from "../api/leads";
import { LEAD_STATUS_LABELS, LeadStatus } from "../constants/leadStatus";
import { DocumentForm } from "./DocumentForm";
import { FinancingForm } from "./FinancingForm";
import { StatusUpdateForm } from "./StatusUpdateForm";
import { useAuth } from "../hooks/useAuth";
import { useToasts } from "../providers/ToastProvider";
import { fetchUsers } from "../api/users";
import { ApiError, API_BASE_URL } from "../api/client";
import { Modal } from "./Modal";
import { Badge, Button, Card, Select, StatusBadge, TextField } from "./ui";
import { SendEmailModal } from "./SendEmailModal";
import { LeadInsuranceOnboarding } from "./LeadInsuranceOnboarding";
import { unlockApplicationForm as apiUnlockApplicationForm } from "../api/application-forms";
import { sanitizeHtml } from "../utils/sanitizeHtml";

type UnlockHistoryEntry = {
  unlockedBy?: string | null;
  unlockedAt?: string | null;
  reason?: string | null;
  // operator/admin enriched
  unlockedByUser?: {
    id?: string | null;
    email?: string | null;
    fullName?: string | null;
  } | null;
  // client attempt
  type?: string | null; // e.g., CLIENT_ATTEMPT
  timestamp?: string | null;
  client?: {
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
  } | null;
};


type VehicleFormState = {
  current: {
    make: string;
    model: string;
    year: string;
    mileage: string;
    ownershipStatus: string;
    vin: string;
  };
  desired: {
    vehicles: Array<{
      make: string;
      model: string;
      yearFrom: string;
      yearTo: string;
      budgetFrom: string;
      budgetTo: string;
      comment: string;
    }>;
    financingType: string;
    financingAmount: string;
    amountAvailable: string;
    notes: string;
  };
};

type ClientFormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  customerType: string;
  city: string;
  voivodeship: string;
  postalCode: string;
};

const resolveDocumentUrl = (path: string, authToken?: string | null) => {
  if (!path) return "#";
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const baseUrl = `${API_BASE_URL}${normalizedPath}`;
  if (authToken && normalizedPath.startsWith("/uploads/")) {
    const separator = baseUrl.includes("?") ? "&" : "?";
    return `${baseUrl}${separator}token=${encodeURIComponent(authToken)}`;
  }
  return baseUrl;
};

type FormStatusTone = "neutral" | "info" | "success" | "warning" | "danger";
const CUSTOMER_TYPES = ["osoba fizyczna", "JDG", "spółka"] as const;
const VOIVODESHIPS = [
  "dolnośląskie",
  "kujawsko-pomorskie",
  "lubelskie",
  "lubuskie",
  "łódzkie",
  "małopolskie",
  "mazowieckie",
  "opolskie",
  "podkarpackie",
  "podlaskie",
  "pomorskie",
  "śląskie",
  "świętokrzyskie",
  "warmińsko-mazurskie",
  "wielkopolskie",
  "zachodniopomorskie",
] as const;

const FORM_STATUS_META: Record<string, { label: string; tone: FormStatusTone }> = {
  draft: { label: "Roboczy", tone: "neutral" },
  in_progress: { label: "Wypełniany", tone: "info" },
  ready: { label: "Gotowy do wysyłki", tone: "success" },
  submitted: { label: "Przesłany", tone: "success" },
  locked: { label: "Zablokowany", tone: "danger" },
  unlocked: { label: "Odblokowany", tone: "warning" },
};

interface LeadDetailCardProps {
  lead: LeadDetail | null;
  onRefresh: () => void | Promise<void>;
  onStatusUpdate: (payload: { status: LeadStatus; notes?: string }) => Promise<void>;
  onSaveFinancing: (payload: FinancingPayload) => Promise<void>;
  onAddDocument: (payload: { type: string; file: File }) => Promise<void>;
}

export const LeadDetailCard: React.FC<LeadDetailCardProps> = ({
  lead,
  onRefresh,
  onStatusUpdate,
  onSaveFinancing,
  onAddDocument,
}) => {
  const noteId = useId();
  const desiredNotesId = useId();
  const { token, user } = useAuth();
  const { addToast } = useToasts();
  const isAdmin = user?.role === "ADMIN";
  const canEditVehicles =
    user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "OPERATOR";
  const canEditClient = user?.role === "ADMIN" || user?.role === "OPERATOR";
  const [operatorOptions, setOperatorOptions] = useState<Array<{ id: string; email: string; fullName?: string | null }>>([]);
  const [isLoadingOperators, setIsLoadingOperators] = useState(false);
  const [isUpdatingAssignment, setIsUpdatingAssignment] = useState(false);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [notes, setNotes] = useState<LeadNote[]>(lead?.notes ?? []);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [noteLink, setNoteLink] = useState("");
  const [noteErrors, setNoteErrors] = useState<{ content?: string; link?: string }>({});
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [areNotesExpanded, setAreNotesExpanded] = useState(false);
  const [areActivitiesExpanded, setAreActivitiesExpanded] = useState(false);
  const buildVehicleFormState = useCallback((): VehicleFormState => {
    const latestFinancingApp = lead?.financingApps?.[0];
    const preferences = lead?.vehicleDesired?.preferences as {
      notes?: string;
      financingType?: string;
      financingAmount?: string;
      vehicles?: Array<{
        make?: string;
        model?: string;
        yearFrom?: string;
        yearTo?: string;
        budgetFrom?: string;
        budgetTo?: string;
        comment?: string;
      }>;
    } | null | undefined;

    let vehicles: VehicleFormState['desired']['vehicles'] = [{ make: "", model: "", yearFrom: "", yearTo: "", budgetFrom: "", budgetTo: "", comment: "" }];

    if (preferences?.vehicles && preferences.vehicles.length > 0) {
      vehicles = preferences.vehicles.map(v => ({
        make: v.make || "",
        model: v.model || "",
        yearFrom: v.yearFrom || (lead?.vehicleDesired?.year ? String(lead.vehicleDesired.year) : ""),
        yearTo: v.yearTo || "",
        budgetFrom: v.budgetFrom || (lead?.vehicleDesired?.budget ? String(lead.vehicleDesired.budget) : ""),
        budgetTo: v.budgetTo || "",
        comment: v.comment || "",
      }));
    } else if (lead?.vehicleDesired?.make || lead?.vehicleDesired?.model || lead?.vehicleDesired?.year || lead?.vehicleDesired?.budget) {
      vehicles = [{
        make: lead.vehicleDesired.make || "",
        model: lead.vehicleDesired.model || "",
        yearFrom: lead.vehicleDesired.year ? String(lead.vehicleDesired.year) : "",
        yearTo: "",
        budgetFrom: lead.vehicleDesired.budget ? String(lead.vehicleDesired.budget) : "",
        budgetTo: "",
        comment: "",
      }];
    }

    const desiredNotes = typeof preferences?.notes === "string" ? String(preferences.notes).trim() : "";
    const financingType = typeof preferences?.financingType === "string" ? preferences.financingType : "";
    const financingAmount = typeof preferences?.financingAmount === "string" ? preferences.financingAmount : "";

    return {
      current: {
        make: lead?.vehicleCurrent?.make ?? "",
        model: lead?.vehicleCurrent?.model ?? "",
        year: lead?.vehicleCurrent?.year?.toString() ?? "",
        mileage: lead?.vehicleCurrent?.mileage?.toString() ?? "",
        ownershipStatus: lead?.vehicleCurrent?.ownershipStatus ?? "",
        vin: lead?.vehicleCurrent?.vin ?? "",
      },
      desired: {
        vehicles,
        financingType,
        financingAmount,
        amountAvailable: latestFinancingApp?.downPayment
          ? String(latestFinancingApp.downPayment)
          : "",
        notes: desiredNotes,
      },
    };
  }, [lead]);
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [vehicleForm, setVehicleForm] = useState<VehicleFormState>(buildVehicleFormState);
  const [vehicleErrors, setVehicleErrors] = useState<Record<string, string>>({});
  const [isSavingVehicles, setIsSavingVehicles] = useState(false);

  // New helpers for array handling
  const handleEditDesiredVehicleChange = (index: number, field: keyof VehicleFormState['desired']['vehicles'][0], value: string) => {
    setVehicleForm((prev) => {
      const newVehicles = [...prev.desired.vehicles];
      newVehicles[index] = { ...newVehicles[index], [field]: value };
      return {
        ...prev,
        desired: {
          ...prev.desired,
          vehicles: newVehicles,
        },
      };
    });
  };

  const addEditDesiredVehicle = () => {
    setVehicleForm((prev) => ({
      ...prev,
      desired: {
        ...prev.desired,
        vehicles: [...prev.desired.vehicles, { make: "", model: "", yearFrom: "", yearTo: "", budgetFrom: "", budgetTo: "", comment: "" }],
      },
    }));
  };

  const removeEditDesiredVehicle = (index: number) => {
    setVehicleForm((prev) => ({
      ...prev,
      desired: {
        ...prev.desired,
        vehicles: prev.desired.vehicles.filter((_, i) => i !== index),
      },
    }));
  };


  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false);
  const [isConfirmUnlockOpen, setIsConfirmUnlockOpen] = useState(false);
  const [unlockReason, setUnlockReason] = useState("");
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [isGenerateFormModalOpen, setIsGenerateFormModalOpen] = useState(false);
  const [accessCodeInput, setAccessCodeInput] = useState("");
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [generateLinkError, setGenerateLinkError] = useState<string | null>(null);
  const [isGeneratingFormLink, setIsGeneratingFormLink] = useState(false);
  const [generatedLinkResult, setGeneratedLinkResult] = useState<CreateApplicationFormLinkResponse | null>(null);
  const [isConsentContentModalOpen, setIsConsentContentModalOpen] = useState(false);
  const [selectedConsentContent, setSelectedConsentContent] = useState("");
  const [isAnonymizeModalOpen, setIsAnonymizeModalOpen] = useState(false);
  const [anonymizeConfirmation, setAnonymizeConfirmation] = useState("");
  const [isAnonymizing, setIsAnonymizing] = useState(false);
  const [isSendEmailModalOpen, setIsSendEmailModalOpen] = useState(false);
  const [replyContext, setReplyContext] = useState<EmailReplyContext | null>(null);
  const [expandedEmailNoteIds, setExpandedEmailNoteIds] = useState<Record<string, boolean>>({});
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [clientForm, setClientForm] = useState<ClientFormState>(() => {
    const address =
      (lead?.customerProfile?.address as
        | { city?: string | null; voivodeship?: string | null; customerType?: string | null; postalCode?: string | null }
        | null
        | undefined) || {};
    return {
      firstName: lead?.customerProfile?.firstName ?? "",
      lastName: lead?.customerProfile?.lastName ?? "",
      email: lead?.customerProfile?.email ?? "",
      phone: lead?.customerProfile?.phone ?? "",
      customerType: address.customerType ?? "",
      city: address.city ?? "",
      voivodeship: address.voivodeship ?? "",
      postalCode: address.postalCode ?? "",
    };
  });
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const [isSavingClient, setIsSavingClient] = useState(false);

  const applicationForm = lead?.applicationForm;

  const unlockHistory = useMemo<UnlockHistoryEntry[]>(() => {
    const raw = applicationForm?.unlockHistory;
    if (!raw) return [];
    if (Array.isArray(raw)) {
      return raw as UnlockHistoryEntry[];
    }
    if (typeof raw === "object") {
      return [raw as UnlockHistoryEntry];
    }
    return [];
  }, [applicationForm?.unlockHistory]);

  const canGenerateFormLink =
    user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "OPERATOR";

  const defaultAccessCode = useMemo(() => {
    const phone = lead?.customerProfile?.phone;
    if (!phone) return "";
    const digits = phone.replace(/[^0-9]/g, "");
    return digits.slice(-4);
  }, [lead?.customerProfile?.phone]);

  const offerBudgetValue = useMemo(() => {
    const rawBudget = lead?.vehicleDesired?.budget;
    if (typeof rawBudget === "number") {
      return Number.isFinite(rawBudget) ? rawBudget : null;
    }
    if (typeof rawBudget === "string") {
      const parsed = Number(rawBudget);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }, [lead?.vehicleDesired?.budget]);

  const offerAmountAvailableValue = useMemo(() => {
    const rawAmount = lead?.financingApps?.[0]?.downPayment;
    if (typeof rawAmount === "number") {
      return Number.isFinite(rawAmount) ? rawAmount : null;
    }
    if (typeof rawAmount === "string") {
      const parsed = Number(rawAmount);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }, [lead?.financingApps]);

  const customerAddress = useMemo(
    () =>
      (lead?.customerProfile?.address as
        | { city?: string | null; voivodeship?: string | null; customerType?: string | null; postalCode?: string | null }
        | null
        | undefined) || {},
    [lead?.customerProfile?.address],
  );

  const buildClientFormState = useCallback((): ClientFormState => {
    return {
      firstName: lead?.customerProfile?.firstName ?? "",
      lastName: lead?.customerProfile?.lastName ?? "",
      email: lead?.customerProfile?.email ?? "",
      phone: lead?.customerProfile?.phone ?? "",
      customerType: customerAddress.customerType ?? "",
      city: customerAddress.city ?? "",
      voivodeship: customerAddress.voivodeship ?? "",
      postalCode: customerAddress.postalCode ?? "",
    };
  }, [customerAddress.city, customerAddress.customerType, customerAddress.postalCode, customerAddress.voivodeship, lead?.customerProfile?.email, lead?.customerProfile?.firstName, lead?.customerProfile?.lastName, lead?.customerProfile?.phone]);

  const lastContactValue = useMemo(() => {
    const timestamps: number[] = [];
    if (lead?.lastContactAt) timestamps.push(new Date(lead.lastContactAt).getTime());
    if (applicationForm?.lastClientActivity)
      timestamps.push(new Date(applicationForm.lastClientActivity).getTime());
    if (!timestamps.length) return "—";
    const latest = new Date(Math.max(...timestamps));
    return latest.toLocaleString();
  }, [applicationForm?.lastClientActivity, lead?.lastContactAt]);

  const formStatusMeta = useMemo(() => {
    if (!applicationForm?.status) return null;
    const key = applicationForm.status.toLowerCase();
    return FORM_STATUS_META[key] || { label: applicationForm.status, tone: "neutral" };
  }, [applicationForm?.status]);
  const canUnlock =
    (user?.role === "ADMIN" || user?.role === "SUPERVISOR") &&
    (applicationForm?.status === "SUBMITTED" ||
      applicationForm?.status === "LOCKED" ||
      applicationForm?.status === "READY");

  useEffect(() => {
    setNotes(lead?.notes ?? []);
    setAreNotesExpanded(false);
    setAreActivitiesExpanded(false);
    setExpandedEmailNoteIds({});
  }, [lead]);

  useEffect(() => {
    setClientForm(buildClientFormState());
    setClientErrors({});
  }, [buildClientFormState]);

  useEffect(() => {
    setVehicleForm(buildVehicleFormState());
    setVehicleErrors({});
  }, [buildVehicleFormState]);

  useEffect(() => {
    if (!isAdmin || !token) {
      return;
    }

    let cancelled = false;

    const loadOperators = async () => {
      setIsLoadingOperators(true);
      try {
        const response = await fetchUsers(token, { role: "OPERATOR", perPage: 200 });
        if (!cancelled) {
          setOperatorOptions(
            response.data.map((user) => ({ id: user.id, email: user.email, fullName: user.fullName }))
          );
        }
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Failed to load operators";
        if (!cancelled) {
          setAssignmentError(message);
        }
        addToast(message, "error");
      } finally {
        if (!cancelled) {
          setIsLoadingOperators(false);
        }
      }
    };

    loadOperators();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, token]);

  const handleAssignmentChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    if (!token || !lead) return;
    const nextValue = event.target.value;
    const userId = nextValue || null;

    setIsUpdatingAssignment(true);
    setAssignmentError(null);
    try {
      await assignLead(token, lead.id, userId);
      addToast(userId ? "Lead assigned" : "Lead marked as unassigned", "success");
      await Promise.resolve(onRefresh());
      window.dispatchEvent(new CustomEvent("lead-assignment-updated", { detail: { leadId: lead.id } }));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to update assignment";
      setAssignmentError(message);
      addToast(message, "error");
    } finally {
      setIsUpdatingAssignment(false);
    }
  };

  const handleOpenClientModal = () => {
    setClientForm(buildClientFormState());
    setClientErrors({});
    setIsClientModalOpen(true);
  };

  const handleCloseClientModal = () => {
    setIsClientModalOpen(false);
    setClientErrors({});
  };

  const handleClientFieldChange = (field: keyof ClientFormState, value: string) => {
    if (field === "postalCode") {
      const digitsOnly = value.replace(/\D/g, "").slice(0, 5);
      let formatted = digitsOnly;
      if (digitsOnly.length > 2) {
        formatted = `${digitsOnly.slice(0, 2)}-${digitsOnly.slice(2)}`;
      } else if (digitsOnly.length === 2 && clientForm.postalCode.length < 3) {
        formatted = `${digitsOnly}-`;
      } else if (digitsOnly.length === 2 && value.endsWith('-')) {
        formatted = `${digitsOnly}-`;
      }
      setClientForm((prev) => ({ ...prev, [field]: formatted }));
      return;
    }
    setClientForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSaveClient = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token || !lead || !canEditClient) return;
    const errors: Record<string, string> = {};
    if (!clientForm.firstName.trim()) errors.firstName = "Imię jest wymagane";
    if (!clientForm.lastName.trim()) errors.lastName = "Nazwisko jest wymagane";
    if (clientForm.email && !/^\S+@\S+\.\S+$/.test(clientForm.email.trim())) {
      errors.email = "Nieprawidłowy email";
    }
    if (clientForm.postalCode && !/^\d{2}-\d{3}$/.test(clientForm.postalCode.trim())) {
      errors.postalCode = "Nieprawidłowy kod pocztowy (wymagany format 00-000)";
    }
    if (Object.keys(errors).length) {
      setClientErrors(errors);
      return;
    }

    setIsSavingClient(true);
    setClientErrors({});
    try {
      await updateLeadCustomer(token, lead.id, {
        firstName: clientForm.firstName.trim(),
        lastName: clientForm.lastName.trim(),
        email: clientForm.email.trim() || null,
        phone: clientForm.phone.trim() || null,
        customerType: clientForm.customerType || null,
        city: clientForm.city || null,
        voivodeship: clientForm.voivodeship || null,
        postalCode: clientForm.postalCode || null,
      });
      addToast("Zaktualizowano dane klienta", "success");
      setIsClientModalOpen(false);
      await Promise.resolve(onRefresh());
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Nie udało się zapisać danych klienta";
      addToast(message, "error");
    } finally {
      setIsSavingClient(false);
    }
  };

  const handleVehicleModalOpen = () => {
    setVehicleForm(buildVehicleFormState());
    setVehicleErrors({});
    setIsVehicleModalOpen(true);
  };

  const handleCloseVehicleModal = () => {
    setIsVehicleModalOpen(false);
    setVehicleErrors({});
  };

  const handleVehicleFieldChange = (
    section: "current" | "desired",
    field: string,
    value: string,
  ) => {
    if (section === "current" && field === "vin") {
      value = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 17);
    }
    setVehicleForm((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));
  };

  const handleOpenGenerateFormModal = () => {
    setAccessCodeInput(defaultAccessCode || "");
    setExpiresInDays(7);
    setGeneratedLinkResult(null);
    setGenerateLinkError(null);
    setIsGenerateFormModalOpen(true);
  };

  const handleGenerateFormLink = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token || !lead) return;
    const sanitized = accessCodeInput.trim();
    if (!/^[0-9]{4}$/.test(sanitized)) {
      setGenerateLinkError("Kod musi mieć dokładnie 4 cyfry");
      return;
    }

    setIsGeneratingFormLink(true);
    setGenerateLinkError(null);
    try {
      const result = await generateApplicationFormLink(token, lead.id, sanitized);
      setGeneratedLinkResult(result);
      addToast("Link do formularza został wygenerowany", "success");
      await Promise.resolve(onRefresh());
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Nie udało się wygenerować linku";
      setGenerateLinkError(message);
      addToast(message, "error");
    } finally {
      setIsGeneratingFormLink(false);
    }
  };

  const handleCopyFormLink = async () => {
    if (!generatedLinkResult) return;
    try {
      if (!navigator?.clipboard) {
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(generatedLinkResult.link);
      addToast("Skopiowano link do schowka", "success");
    } catch {
      addToast("Nie udało się skopiować linku", "error");
    }
  };

  const buildVehiclePayload = () => {
    const errors: Record<string, string> = {};
    const trimOrUndefined = (value: string) => {
      const trimmed = value.trim();
      return trimmed.length ? trimmed : undefined;
    };
    const parseNumberField = (
      value: string,
      path: string,
      options?: { allowFloat?: boolean; min?: number; max?: number },
    ) => {
      const trimmed = value.trim();
      if (!trimmed) return undefined;
      const parsed = options?.allowFloat ? Number(trimmed) : parseInt(trimmed, 10);
      if (Number.isNaN(parsed)) {
        errors[path] = "Invalid number";
        return undefined;
      }
      if (typeof options?.min === "number" && parsed < options.min) {
        errors[path] = `Must be ≥ ${options.min}`;
        return undefined;
      }
      if (typeof options?.max === "number" && parsed > options.max) {
        errors[path] = `Must be ≤ ${options.max}`;
        return undefined;
      }
      return parsed;
    };

    const current = {
      make: trimOrUndefined(vehicleForm.current.make),
      model: trimOrUndefined(vehicleForm.current.model),
      year: parseNumberField(vehicleForm.current.year, "current.year", {
        min: 1900,
        max: new Date().getFullYear() + 1,
      }),
      mileage: parseNumberField(vehicleForm.current.mileage, "current.mileage", {
        min: 0,
      }),
      ownershipStatus: trimOrUndefined(vehicleForm.current.ownershipStatus),
      vin: trimOrUndefined(vehicleForm.current.vin),
    };

    if (current.vin && !/^[a-zA-Z0-9]{17}$/i.test(current.vin)) {
      errors["current.vin"] = "Numer VIN musi składać się z dokładnie 17 znaków alfanumerycznych.";
    }


    const amountAvailableRaw = vehicleForm.desired.amountAvailable.trim();
    let amountAvailable: number | null | undefined;
    if (amountAvailableRaw.length === 0) {
      amountAvailable = null;
    } else {
      amountAvailable = parseNumberField(amountAvailableRaw, "desired.amountAvailable", {
        allowFloat: true,
        min: 0,
      });
    }

    const notesValue = vehicleForm.desired.notes.trim();

    // Take the first vehicle as primary for the base table row, put the rest (and first) in preferences
    const firstVehicle = vehicleForm.desired.vehicles[0] || {};

    // Convert year and budget to number for the primary vehicle
    const primaryYear = parseNumberField(firstVehicle.yearFrom || firstVehicle.yearTo || "", "desired.year", { min: 1900, max: new Date().getFullYear() + 1 });
    const primaryBudget = parseNumberField(firstVehicle.budgetTo || firstVehicle.budgetFrom || "", "desired.budget", { allowFloat: true, min: 0 });

    const desired: {
      make?: string;
      model?: string;
      year?: number;
      budget?: number | null;
      preferences?: Record<string, unknown>;
    } = {
      make: trimOrUndefined(firstVehicle.make || ""),
      model: trimOrUndefined(firstVehicle.model || ""),
      year: primaryYear,
      budget: primaryBudget,
      preferences: {
        notes: notesValue || undefined,
        financingType: trimOrUndefined(vehicleForm.desired.financingType),
        financingAmount: trimOrUndefined(vehicleForm.desired.financingAmount),
        vehicles: vehicleForm.desired.vehicles.map(v => ({
          make: trimOrUndefined(v.make),
          model: trimOrUndefined(v.model),
          yearFrom: trimOrUndefined(v.yearFrom),
          yearTo: trimOrUndefined(v.yearTo),
          budgetFrom: trimOrUndefined(v.budgetFrom),
          budgetTo: trimOrUndefined(v.budgetTo),
          comment: trimOrUndefined(v.comment)
        })).filter(v => v.make || v.model || v.yearFrom || v.yearTo || v.budgetFrom || v.budgetTo || v.comment)
      }
    };

    if (Object.keys(errors).length) {
      setVehicleErrors(errors);
      return null;
    }

    setVehicleErrors({});

    const hasCurrentValues = Object.values(current).some(
      (value) => typeof value !== "undefined",
    );
    const hasDesiredValues =
      Boolean(
        desired.make ||
        desired.model ||
        typeof desired.year !== "undefined" ||
        desired.budget !== undefined ||
        (amountAvailableRaw.length > 0 && typeof amountAvailable !== "undefined") ||
        (desired.preferences?.vehicles && Array.isArray(desired.preferences.vehicles) && desired.preferences.vehicles.length > 0),
      ) ||
      desired.budget === null ||
      amountAvailable === null ||
      typeof desired.preferences?.notes !== "undefined";

    const payload: Parameters<typeof updateLeadVehicles>[2] = {};
    payload.current = hasCurrentValues ? current : null;
    payload.desired = hasDesiredValues ? desired : null;
    if (typeof amountAvailable !== "undefined") {
      payload.amountAvailable = amountAvailable;
    }

    return payload;
  };

  const handleSaveVehicles = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token || !lead) return;
    const payload = buildVehiclePayload();
    if (!payload) {
      return;
    }

    setIsSavingVehicles(true);
    try {
      await updateLeadVehicles(token, lead.id, payload);
      addToast("Vehicle details updated", "success");
      setIsVehicleModalOpen(false);
      const refreshResult = onRefresh();
      if (refreshResult instanceof Promise) {
        await refreshResult;
      }
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to update vehicle details";
      addToast(message, "error");
    } finally {
      setIsSavingVehicles(false);
    }
  };

  const mergedOperatorOptions = useMemo(() => {
    if (!isAdmin) return [];
    const list = [...operatorOptions];
    if (lead?.assignedUser && !list.some((item) => item.id === lead.assignedUser?.id)) {
      list.push({
        id: lead.assignedUser.id,
        email: lead.assignedUser.email,
        fullName: lead.assignedUser.fullName,
      });
    }
    return list;
  }, [isAdmin, operatorOptions, lead?.assignedUser]);

  const assignedUserId = lead?.assignedUser?.id ?? "";
  const assignedEmail = lead?.assignedUser?.email || (isAdmin ? "Do przypisania" : "Unassigned");

  const resetNoteForm = () => {
    setNoteContent("");
    setNoteLink("");
    setNoteErrors({});
  };

  const handleCloseNoteModal = () => {
    setIsNoteModalOpen(false);
    resetNoteForm();
  };

  const validateNoteForm = () => {
    const trimmedContent = noteContent.trim();
    const trimmedLink = noteLink.trim();
    const errors: { content?: string; link?: string } = {};

    if (!trimmedContent) {
      errors.content = "Note cannot be empty.";
    } else if (trimmedContent.length > 2000) {
      errors.content = "Note must be at most 2000 characters.";
    }

    if (trimmedLink) {
      try {
        const parsed = new URL(trimmedLink);
        if (!parsed.protocol.startsWith("http")) {
          errors.link = "Link must start with http or https.";
        }
      } catch (error) {
        errors.link = "Provide a valid URL.";
      }
    }

    setNoteErrors(errors);

    return {
      isValid: Object.keys(errors).length === 0,
      content: trimmedContent,
      link: trimmedLink ? trimmedLink : undefined,
    };
  };

  const handleSubmitNote = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !lead) return;

    const validation = validateNoteForm();
    if (!validation.isValid) {
      return;
    }

    setIsSavingNote(true);
    try {
      const createdNote = await createLeadNote(token, lead.id, {
        content: validation.content,
        link: validation.link,
      });
      setNotes((prev) => [createdNote, ...prev]);
      addToast("Note added", "success");
      handleCloseNoteModal();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to add note";
      addToast(message, "error");
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleAnonymize = async () => {
    if (!token || !lead || anonymizeConfirmation !== "ANONIMIZUJ") {
      addToast("Confirmation text does not match.", "error");
      return;
    }

    setIsAnonymizing(true);
    try {
      await anonymizeLead(token, lead.id);
      addToast("Lead has been anonymized.", "success");
      setIsAnonymizeModalOpen(false);
      setAnonymizeConfirmation("");
      await Promise.resolve(onRefresh());
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to anonymize lead.";
      addToast(message, "error");
    } finally {
      setIsAnonymizing(false);
    }
  };

  if (!lead) {
    return (
      <Card className="app-lead-placeholder">
        <p>Select a lead to view details.</p>
      </Card>
    );
  }

  const formatCurrentVehicle = () => {
    const vehicle = lead.vehicleCurrent;
    if (!vehicle) return "—";
    const baseParts = [vehicle.make, vehicle.model].filter(Boolean);
    const base = baseParts.length ? baseParts.join(" ").trim() : "—";
    const meta: string[] = [];
    if (vehicle.year) {
      meta.push(`Rocznik: ${vehicle.year}`);
    }
    if (typeof vehicle.mileage === "number" && Number.isFinite(vehicle.mileage)) {
      const mileageValue = new Intl.NumberFormat("pl-PL").format(vehicle.mileage);
      meta.push(`Przebieg: ${mileageValue} km`);
    }
    return meta.length ? `${base}${base === "—" ? "" : ", "}${meta.join(", ")}` : base;
  };

  const formatFinancing = (): string => {
    const vehicle = lead.vehicleDesired;
    if (!vehicle) return "—";

    const preferences = vehicle.preferences as {
      financingType?: string;
      financingAmount?: string;
    } | null | undefined;

    const type = preferences?.financingType;
    const amount = preferences?.financingAmount;

    if (!type) return "—";

    if ((type === "Kredyt" || type === "Leasing") && amount) {
      const parsedAmount = Number(amount);
      if (Number.isFinite(parsedAmount) && parsedAmount >= 0) {
        const formattedAmount = new Intl.NumberFormat("pl-PL", {
          style: "currency",
          currency: "PLN",
          minimumFractionDigits: 0,
        }).format(parsedAmount);
        return `${type} (${formattedAmount})`;
      }
      return `${type} (${amount} PLN)`;
    }

    return type;
  };

  const formatDesiredVehicle = (): React.ReactNode => {
    const vehicle = lead.vehicleDesired;
    if (!vehicle) return "—";

    const preferences = vehicle.preferences as {
      notes?: string;
      vehicles?: Array<{
        make?: string;
        model?: string;
        yearFrom?: string;
        yearTo?: string;
        budgetFrom?: string;
        budgetTo?: string;
        comment?: string;
      }>;
    } | null | undefined;

    const vehiclesToDisplay = preferences?.vehicles?.length
      ? preferences.vehicles
      : [{ make: vehicle.make, model: vehicle.model, year: vehicle.year }];

    const downPaymentRaw = lead.financingApps?.[0]?.downPayment;
    let odszkodowanieStr = "";
    if (downPaymentRaw !== null && typeof downPaymentRaw !== "undefined" && downPaymentRaw !== "") {
      const parsed = Number(downPaymentRaw);
      const formatted =
        Number.isFinite(parsed) && parsed >= 0
          ? new Intl.NumberFormat("pl-PL", {
            style: "currency",
            currency: "PLN",
            minimumFractionDigits: 0,
          }).format(parsed)
          : `${downPaymentRaw} PLN`;
      odszkodowanieStr = `Wysokość odszkodowania: ${formatted}`;
    }

    const notes = typeof preferences?.notes === "string" ? String(preferences.notes).trim() : "";

    return (
      <div className="app-lead-vehicles">
        {vehiclesToDisplay.map((v, i) => {
          const baseParts = [v.make, v.model].filter(Boolean);
          const base = baseParts.length ? baseParts.join(" ").trim() : "Dowolny pojazd";
          const meta: string[] = [];

          if ('yearFrom' in v || 'yearTo' in v) {
            if (v.yearFrom || v.yearTo) {
              meta.push(`Rocznik: ${v.yearFrom || "od"} - ${v.yearTo || "do"}`);
            }
          } else if ('year' in v && v.year) {
            meta.push(`Rocznik: ${v.year}`);
          }

          if (('budgetFrom' in v || 'budgetTo' in v) && (v.budgetFrom || v.budgetTo)) {
            meta.push(`Budżet: ${v.budgetFrom || "0"} - ${v.budgetTo || ""} PLN`);
          }

          if ('comment' in v && v.comment) {
            meta.push(`Uwagi: ${v.comment}`);
          }

          const summary = meta.length ? `${base}, ${meta.join(", ")}` : base;
          return <div key={i}>{summary}</div>;
        })}
        {odszkodowanieStr && (
          <div className="app-lead-compensation">{odszkodowanieStr}</div>
        )}
        {notes && (
          <div className="app-lead-extra">Dodatkowe informacje: {notes}</div>
        )}
      </div>
    );
  };

  const formatPhoneNumber = (value?: string | null) => {
    if (!value) return null;
    return value.trim();
  };

  const isEmailNote = (note: LeadNote) =>
    note.type === "EMAIL_SENT" || note.type === "EMAIL_RECEIVED";

  const getEmailDirection = (note: LeadNote): "INCOMING" | "OUTGOING" =>
    note.metadata?.direction ?? (note.type === "EMAIL_RECEIVED" ? "INCOMING" : "OUTGOING");

  const getEmailParticipantLabel = (note: LeadNote) => {
    const direction = getEmailDirection(note);
    if (direction === "INCOMING") {
      return note.metadata?.senderEmail || note.metadata?.from || note.author?.fullName || "Unknown";
    }
    return note.metadata?.from || note.author?.email || lead.customerProfile?.email || "Operator";
  };

  const stripHtml = (value: string) => value.replace(/<[^>]+>/g, "");
  const truncateText = (value: string, max = 400) =>
    value.length <= max ? value : `${value.slice(0, max)}…`;

  const truncateFileName = (name: string, maxLength: number = 40) => {
    if (name.length <= maxLength) return name;
    return `${name.slice(0, maxLength)}...`;
  };

  const renderEmailBody = (note: LeadNote, expanded: boolean) => {
    const html = note.metadata?.html;
    if (html) {
      if (!expanded) {
        return (
          <div className="app-lead-prewrap">
            {truncateText(stripHtml(html))}
          </div>
        );
      }
      return <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }} />;
    }
    const content = note.content || "";
    return (
      <div className="app-lead-prewrap">
        {expanded ? content : truncateText(content)}
      </div>
    );
  };

  const shouldAllowEmailToggle = (note: LeadNote) => {
    if (note.metadata?.html) {
      return stripHtml(note.metadata.html).length > 300;
    }
    return (note.content?.length ?? 0) > 300;
  };

  const buildReplyContext = (note: LeadNote): EmailReplyContext => {
    const baseSubject = note.metadata?.subject || "Information from Izzy CRM";
    const normalizedSubject = baseSubject.toLowerCase().startsWith("re:")
      ? baseSubject
      : `Re: ${baseSubject}`;
    const sourceHtml = note.metadata?.html || `<p>${note.content.replace(/\n/g, "<br>")}</p>`;
    // Email HTML: CSS variables are not supported in mail clients, so rgb() equivalents of the original hex colors are used.
    const quotedHtml = `<blockquote style="border-left:2px solid rgb(229, 231, 235);padding-left:12px;color:rgb(75, 85, 99);">${sourceHtml}</blockquote>`;
    const quotedText = note.content
      ? note.content
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n")
      : "";

    return {
      noteId: note.id,
      subject: normalizedSubject,
      quotedHtml,
      quotedText,
    };
  };

  const toggleEmailBody = (noteId: string) => {
    setExpandedEmailNoteIds((prev) => ({
      ...prev,
      [noteId]: !prev[noteId],
    }));
  };

  const handleReplyToNote = (note: LeadNote) => {
    setReplyContext(buildReplyContext(note));
    setIsSendEmailModalOpen(true);
  };

  const handleComposeEmail = () => {
    setReplyContext(null);
    setIsSendEmailModalOpen(true);
  };

  const displayedNotes = areNotesExpanded ? notes : notes.slice(0, 3);
  const canToggleNotes = notes.length > 3;
  const auditLogs = lead.auditLogs || [];
  const displayedAuditLogs = areActivitiesExpanded ? auditLogs : auditLogs.slice(0, 3);
  const canToggleAuditLogs = auditLogs.length > 3;

  const formattedPhone = formatPhoneNumber(lead.customerProfile?.phone);

  return (
    <section className="app-lead">
      <Card className="app-lead-head">
        <div className="app-lead-head__top">
          <div className="app-lead-head__titles">
            <div className="app-lead-head__title-row">
              <h2 className="app-page-title">
                {lead.customerProfile
                  ? `${lead.customerProfile.firstName} ${lead.customerProfile.lastName}`
                  : "Lead detail"}
              </h2>
              {lead.customerProfile?.email ? (
                <Button variant="secondary" size="sm" icon="mail" onClick={handleComposeEmail}>
                  Wyślij wiadomość
                </Button>
              ) : null}
              <StatusBadge status={lead.status} />
            </div>
            <div className="app-lead-head__contacts">
              {lead.customerProfile?.email ? (
                <span className="app-muted">
                  Email:{" "}
                  <a href={`mailto:${lead.customerProfile.email}`} className="app-link">
                    {lead.customerProfile.email}
                  </a>
                </span>
              ) : null}
              {formattedPhone ? (
                <span className="app-muted">
                  Telefon:{" "}
                  <a href={`tel:${lead.customerProfile?.phone ?? ""}`} className="app-link">
                    {formattedPhone}
                  </a>
                </span>
              ) : null}
            </div>
          </div>
          <Button variant="secondary" size="sm" icon="refresh" onClick={onRefresh}>
            Odśwież
          </Button>
        </div>
        <dl className="app-kv app-lead-head__kv">
          <InfoItem label="Status" value={<StatusBadge status={lead.status} />} />
          <InfoItem
            label="Przypisany do"
            value={
              isAdmin ? (
                <Select
                  aria-label="Przypisany do"
                  className={assignedUserId ? "app-lead-assign" : "app-lead-assign app-lead-assign--empty"}
                  value={assignedUserId}
                  onChange={handleAssignmentChange}
                  disabled={isLoadingOperators || isUpdatingAssignment}
                  error={assignmentError ?? undefined}
                  options={[
                    { value: "", label: "Do przypisania" },
                    ...mergedOperatorOptions.map((operator) => ({
                      value: operator.id,
                      label: `${operator.email}${operator.fullName ? ` (${operator.fullName})` : ""}`,
                    })),
                  ]}
                />
              ) : (
                assignedEmail
              )
            }
          />
          <InfoItem label="Last contact" value={lastContactValue} />
        </dl>
      </Card>

      <Card
        title="Informacje o kliencie"
        actions={
          canEditClient ? (
            <Button variant="secondary" size="sm" onClick={handleOpenClientModal}>
              Edytuj
            </Button>
          ) : undefined
        }
      >
        <dl className="app-kv">
          <InfoItem label="Rodzaj klienta" value={customerAddress.customerType || "—"} />
          <InfoItem label="Miasto" value={customerAddress.city || "—"} />
          <InfoItem label="Województwo" value={customerAddress.voivodeship || "—"} />
        </dl>
      </Card>

      <LeadInsuranceOnboarding leadId={lead.id} />

      <Card
        title="Informacje o pojeździe"
        actions={
          canEditVehicles ? (
            <Button variant="secondary" size="sm" onClick={handleVehicleModalOpen}>
              Edytuj
            </Button>
          ) : undefined
        }
      >
        <dl className="app-kv app-lead-kv--stack">
          <InfoItem label="Aktualny pojazd" value={formatCurrentVehicle()} />
          <InfoItem label="Żądany pojazd" value={formatDesiredVehicle()} />
          <InfoItem label="Forma finansowania" value={formatFinancing()} />
        </dl>
      </Card>

      <Card
        title={
          <span className="app-lead-title-group">
            Formularz klienta
            {formStatusMeta ? <Badge tone={formStatusMeta.tone}>{formStatusMeta.label}</Badge> : null}
          </span>
        }
        actions={
          canGenerateFormLink ? (
            <Button variant="primary" size="sm" onClick={handleOpenGenerateFormModal}>
              Wyślij formularz
            </Button>
          ) : undefined
        }
      >
        {applicationForm ? (
          <div className="app-lead-stack">
            {applicationForm.isClientActive ? (
              <div className="app-alert app-alert--warning" role="status">
                Klient jest obecnie aktywny w formularzu online. Edycja danych została zablokowana do czasu
                zakończenia sesji.
              </div>
            ) : null}
            <dl className="app-kv">
              <InfoItem
                label="Status"
                value={formStatusMeta ? formStatusMeta.label : "Nieznany"}
              />
              <InfoItem
                label="Klient aktywny"
                value={applicationForm.isClientActive ? "Tak" : "Nie"}
              />
              <InfoItem
                label="Ostatnia aktywność klienta"
                value={
                  applicationForm.lastClientActivity
                    ? new Date(applicationForm.lastClientActivity).toLocaleString()
                    : "—"
                }
              />
              <InfoItem
                label="Ważność linku"
                value={
                  applicationForm.linkExpiresAt
                    ? new Date(applicationForm.linkExpiresAt).toLocaleString()
                    : "—"
                }
              />
            </dl>
            <div className="app-lead-form-row">
              <span className="app-muted">
                {applicationForm.submittedAt
                  ? `Ostatni submit: ${new Date(applicationForm.submittedAt).toLocaleString()}`
                  : "Formularz nie został jeszcze przesłany"}
              </span>
              {canUnlock ? (
                <Button variant="secondary" size="sm" onClick={() => setIsConfirmUnlockOpen(true)}>
                  Odblokuj wniosek
                </Button>
              ) : null}
              {unlockHistory.length ? (
                <Button variant="ghost" size="sm" onClick={() => setIsUnlockModalOpen(true)}>
                  Historia odblokowań ({unlockHistory.length})
                </Button>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="app-muted app-lead-text">Brak powiązanego formularza online.</p>
        )}
      </Card>

      {lead.applicationForm?.formData ? (
        <Card title="Postęp formularza klienta">
          <pre className="app-lead-pre">
            {JSON.stringify(lead.applicationForm.formData, null, 2)}
          </pre>
        </Card>
      ) : null}

      <Card
        title={
          <span className="app-lead-title-group">
            Notatki
            <span className="app-muted">({notes.length})</span>
          </span>
        }
        actions={
          <Button variant="secondary" size="sm" onClick={() => setIsNoteModalOpen(true)}>
            Nowa notatka
          </Button>
        }
      >
        <div className="app-lead-stack">
          <ul className="app-lead-list">
            {displayedNotes.length ? (
              displayedNotes.map((note) => {
                const emailNote = isEmailNote(note);
                const direction = emailNote ? getEmailDirection(note) : null;
                const isExpanded = Boolean(expandedEmailNoteIds[note.id]);
                const allowToggle = emailNote ? shouldAllowEmailToggle(note) : false;

                return (
                  <li key={note.id} className="app-lead-item">
                    <div className="app-lead-meta">
                      <div className="app-lead-meta__left">
                        {emailNote ? (
                          <>
                            <span
                              className={`app-lead-email-icon app-lead-email-icon--${direction === "INCOMING" ? "in" : "out"}`}
                              title={direction === "INCOMING" ? "Incoming email" : "Outgoing email"}
                            >
                              {direction === "INCOMING" ? "📥" : "📤"}
                            </span>
                            <Badge tone={direction === "INCOMING" ? "info" : "accent"}>
                              {direction === "INCOMING" ? "Incoming" : "Outgoing"}
                            </Badge>
                            <span className="app-lead-email-addr">{getEmailParticipantLabel(note)}</span>
                          </>
                        ) : (
                          <span>{note.author?.fullName || note.author?.email || "Unknown"}</span>
                        )}
                      </div>
                      <div className="app-lead-meta__right">
                        <span>{new Date(note.createdAt).toLocaleString()}</span>
                        {!emailNote && note.link ? (
                          <a
                            href={note.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="app-link"
                          >
                            Link
                          </a>
                        ) : null}
                      </div>
                    </div>
                    <div className="app-lead-note__content">
                      {emailNote ? (
                        <>
                          {note.metadata?.subject ? (
                            <div className="app-lead-email-subject">{note.metadata.subject}</div>
                          ) : null}
                          {renderEmailBody(note, isExpanded)}
                          {note.type === "EMAIL_SENT" &&
                            note.metadata?.links &&
                            Array.isArray(note.metadata.links) &&
                            note.metadata.links.length > 0 ? (
                            <div className="app-lead-email-links">
                              <div className="app-lead-email-links__title">Linki:</div>
                              <ul className="app-lead-email-links__list">
                                {note.metadata.links.map((link, i) => {
                                  let title = link;
                                  try {
                                    const url = new URL(link);
                                    const match = url.pathname.match(/[/]samochod[/]([^/]+)[/]([^/]+)/);
                                    if (match) {
                                      const make = match[1];
                                      const model = match[2].replace(/-/g, " ");
                                      title = `${make} ${model}`;
                                    }
                                  } catch {
                                    // ignore malformed URLs
                                  }
                                  return (
                                    <li key={i}>
                                      <a
                                        href={link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="app-link"
                                      >
                                        {title}
                                      </a>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          ) : null}
                          <div className="app-lead-email-actions">
                            <Button variant="ghost" size="sm" onClick={() => handleReplyToNote(note)}>
                              Odpowiedz
                            </Button>
                            {allowToggle ? (
                              <Button variant="ghost" size="sm" onClick={() => toggleEmailBody(note.id)}>
                                {isExpanded ? "Zwiń" : "Rozwiń"}
                              </Button>
                            ) : null}
                          </div>
                        </>
                      ) : (
                        <div className="app-lead-prewrap">{note.content}</div>
                      )}
                    </div>
                  </li>
                );
              })
            ) : (
              <li className="app-muted app-lead-empty">Żadnych notatek jeszcze nie dodano.</li>
            )}
          </ul>
          {canToggleNotes ? (
            <Button
              variant="ghost"
              size="sm"
              className="app-lead-toggle"
              onClick={() => setAreNotesExpanded((prev) => !prev)}
            >
              {areNotesExpanded ? "Pokaż mniej" : "Pokaż wszystkie notatki"}
            </Button>
          ) : null}
        </div>
      </Card>

      <StatusUpdateForm lead={lead} onSubmit={onStatusUpdate} />

      <FinancingForm
        application={lead.financingApps[0] ?? null}
        onSave={async (payload) => {
          await onSaveFinancing(payload);
          onRefresh();
        }}
      />

      <Card title="Dokumenty">
        <div className="app-lead-stack">
          <ul className="app-lead-list">
            {lead.documents.length ? (
              lead.documents.map((doc) => (
                <li key={doc.id} className="app-lead-item app-lead-item--row">
                  <div>
                    <strong>{doc.type}</strong>
                    <div className="app-muted">
                      <a
                        href={resolveDocumentUrl(doc.filePath, token)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="app-link"
                        title={doc.originalName || doc.filePath}
                      >
                        {truncateFileName(doc.originalName || doc.filePath)}
                      </a>
                    </div>
                    <div className="app-muted">
                      {doc.mimeType ? `${doc.mimeType} · ` : ""}
                      {doc.sizeBytes ? `${Math.round(doc.sizeBytes / 1024)} KB` : ""}
                    </div>
                    {doc.checksum ? (
                      <div className="app-muted">Checksum: {doc.checksum}</div>
                    ) : null}
                  </div>
                  <small>{new Date(doc.uploadedAt).toLocaleString()}</small>
                </li>
              ))
            ) : (
              <li className="app-muted">Brak dokumentów.</li>
            )}
          </ul>
          <DocumentForm
            onSubmit={async (payload) => {
              await onAddDocument(payload);
              const refreshResult = onRefresh();
              if (refreshResult instanceof Promise) {
                await refreshResult;
              }
            }}
          />
        </div>
      </Card>

      <Card
        title={
          <span className="app-lead-title-group">
            Ostatnia aktywność
            <span className="app-muted">({auditLogs.length})</span>
          </span>
        }
      >
        <div className="app-lead-stack">
          <ul className="app-lead-list">
            {displayedAuditLogs.length ? (
              displayedAuditLogs.map((log) => (
                <li key={log.id} className="app-lead-item app-lead-item--subtle">
                  <div>
                    <strong>{formatAuditAction(log.action, log.field)}</strong>
                    <div className="app-muted app-lead-audit-meta">
                      {log.user?.fullName || "System"} · {new Date(log.createdAt).toLocaleString()}
                    </div>
                    {renderAuditDetails(log)}
                  </div>
                </li>
              ))
            ) : (
              <li className="app-muted">Brak aktywności.</li>
            )}
          </ul>
          {canToggleAuditLogs ? (
            <Button
              variant="ghost"
              size="sm"
              className="app-lead-toggle"
              onClick={() => setAreActivitiesExpanded((prev) => !prev)}
            >
              {areActivitiesExpanded ? "Pokaż mniej" : "Pokaż całą aktywność"}
            </Button>
          ) : null}
        </div>
      </Card>

      <Card title="Consent timeline">
        <ul className="app-lead-list">
          {lead.consentRecords.length ? (
            lead.consentRecords.map((record) => (
              <li key={record.id} className="app-lead-item">
                <div className="app-lead-meta">
                  <span>{record.consentTemplate.title} (v{record.version})</span>
                  <span>· {new Date(record.recordedAt).toLocaleString()}</span>
                  {record.consentGiven ? (
                    <Badge tone="success">Given</Badge>
                  ) : (
                    <Badge tone="danger">Not given</Badge>
                  )}
                  {record.recordedBy ? (
                    <span className="app-muted">
                      by {record.recordedBy.fullName}
                      {record.recordedBy.fullName && record.recordedBy.email ? ` (${record.recordedBy.email})` : record.recordedBy.email ? ` ${record.recordedBy.email}` : ""}
                    </span>
                  ) : null}
                  {record.partner ? (
                    <span className="app-muted">via {record.partner.name}</span>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedConsentContent(record.consentTemplate.content);
                      setIsConsentContentModalOpen(true);
                    }}
                  >
                    View content
                  </Button>
                </div>
                <div
                  className="app-lead-consent-text"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(record.consentText) }}
                />
              </li>
            ))
          ) : (
            <li className="app-muted">No consent records found.</li>
          )}
        </ul>
      </Card>

      <Card>
        <dl className="app-kv">
          <InfoItem label="Partner" value={lead.partner?.name || lead.partnerId || "—"} />
          <InfoItem label="Utworzono" value={new Date(lead.leadCreatedAt).toLocaleString()} />
        </dl>
      </Card>

      {isAdmin && (
        <Card title="Admin actions">
          <div className="app-form-actions app-form-actions--start">
            <Button variant="danger" size="sm" onClick={() => setIsAnonymizeModalOpen(true)}>
              Anominizuj klienta
            </Button>
          </div>
        </Card>
      )}

      <Modal
        isOpen={isConsentContentModalOpen}
        onClose={() => setIsConsentContentModalOpen(false)}
        title="Consent content"
      >
        <div className="app-panel app-lead-consent-modal">
          <div
            className="app-lead-consent-html"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(selectedConsentContent) }}
          />
        </div>
      </Modal>

      <Modal isOpen={isClientModalOpen} onClose={handleCloseClientModal} title="Informacje o kliencie">
        <form onSubmit={handleSaveClient} className="app-form">
          <div className="app-form-grid">
            <TextField
              label="Imię"
              type="text"
              value={clientForm.firstName}
              onChange={(event) => handleClientFieldChange("firstName", event.target.value)}
              required
              error={clientErrors.firstName}
            />
            <TextField
              label="Nazwisko"
              type="text"
              value={clientForm.lastName}
              onChange={(event) => handleClientFieldChange("lastName", event.target.value)}
              required
              error={clientErrors.lastName}
            />
            <TextField
              label="Email"
              type="email"
              value={clientForm.email}
              onChange={(event) => handleClientFieldChange("email", event.target.value)}
              error={clientErrors.email}
            />
            <TextField
              label="Telefon"
              type="text"
              value={clientForm.phone}
              onChange={(event) => handleClientFieldChange("phone", event.target.value)}
            />
            <Select
              label="Rodzaj klienta"
              value={clientForm.customerType}
              onChange={(event) => handleClientFieldChange("customerType", event.target.value)}
              options={[{ value: "", label: "Wybierz" }, ...CUSTOMER_TYPES]}
            />
            <TextField
              label="Miasto"
              type="text"
              value={clientForm.city}
              onChange={(event) => handleClientFieldChange("city", event.target.value)}
            />
            <TextField
              label="Kod pocztowy"
              type="text"
              value={clientForm.postalCode}
              onChange={(event) => handleClientFieldChange("postalCode", event.target.value)}
              placeholder="00-000"
              maxLength={6}
              error={clientErrors.postalCode}
            />
            <Select
              label="Województwo"
              value={clientForm.voivodeship}
              onChange={(event) => handleClientFieldChange("voivodeship", event.target.value)}
              options={[{ value: "", label: "Wybierz" }, ...VOIVODESHIPS]}
            />
          </div>
          <div className="app-form-actions">
            <Button variant="secondary" onClick={handleCloseClientModal}>
              Anuluj
            </Button>
            <Button type="submit" variant="primary" disabled={isSavingClient}>
              {isSavingClient ? "Zapisywanie..." : "Zapisz"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isNoteModalOpen} onClose={handleCloseNoteModal} title="Add note">
        <form onSubmit={handleSubmitNote} className="app-form">
          <div className={`iz-field${noteErrors.content ? " iz-field--error" : ""}`}>
            <label className="iz-field__label" htmlFor={noteId}>
              Note
            </label>
            <textarea
              id={noteId}
              className={`app-textarea${noteErrors.content ? " app-lead-textarea--error" : ""}`}
              required
              value={noteContent}
              onChange={(event) => setNoteContent(event.target.value)}
              maxLength={2000}
              aria-invalid={noteErrors.content ? true : undefined}
              aria-describedby={noteErrors.content ? `${noteId}-hint` : undefined}
            />
            {noteErrors.content ? (
              <div className="iz-field__hint" id={`${noteId}-hint`}>
                {noteErrors.content}
              </div>
            ) : null}
          </div>
          <TextField
            label="Link (optional)"
            type="url"
            value={noteLink}
            onChange={(event) => setNoteLink(event.target.value)}
            placeholder="https://example.com"
            error={noteErrors.link}
          />
          <div className="app-form-actions">
            <Button variant="secondary" onClick={handleCloseNoteModal}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isSavingNote}>
              {isSavingNote ? "Saving..." : "Save note"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isVehicleModalOpen}
        onClose={handleCloseVehicleModal}
        title="Edit vehicle details"
      >
        <form onSubmit={handleSaveVehicles} className="app-form">
          <div className="app-form">
            <h4 className="app-section-title">Current vehicle</h4>
            <div className="app-form-grid app-form-grid--3">
              <TextField
                label="Make"
                type="text"
                value={vehicleForm.current.make}
                onChange={(event) =>
                  handleVehicleFieldChange("current", "make", event.target.value)
                }
              />
              <TextField
                label="Model"
                type="text"
                value={vehicleForm.current.model}
                onChange={(event) =>
                  handleVehicleFieldChange("current", "model", event.target.value)
                }
              />
              <TextField
                label="Year"
                type="number"
                value={vehicleForm.current.year}
                onChange={(event) =>
                  handleVehicleFieldChange("current", "year", event.target.value)
                }
                min={1900}
                max={new Date().getFullYear() + 1}
                error={vehicleErrors["current.year"]}
              />
              <TextField
                label="Mileage (km)"
                type="number"
                value={vehicleForm.current.mileage}
                onChange={(event) =>
                  handleVehicleFieldChange("current", "mileage", event.target.value)
                }
                min={0}
                error={vehicleErrors["current.mileage"]}
              />
              <TextField
                label="Ownership status"
                type="text"
                value={vehicleForm.current.ownershipStatus}
                onChange={(event) =>
                  handleVehicleFieldChange(
                    "current",
                    "ownershipStatus",
                    event.target.value,
                  )
                }
              />
              <TextField
                label="Nr VIN pojazdu"
                type="text"
                value={vehicleForm.current.vin}
                onChange={(event) =>
                  handleVehicleFieldChange("current", "vin", event.target.value)
                }
                placeholder="17 znaków alfanumerycznych"
                maxLength={17}
                error={vehicleErrors["current.vin"]}
              />
            </div>
          </div>

          <div className="app-form">
            <div className="app-lead-form-row">
              <h4 className="app-section-title">Żądane pojazdy</h4>
              <Button variant="secondary" size="sm" icon="plus" onClick={addEditDesiredVehicle}>
                Dodaj pojazd
              </Button>
            </div>

            {vehicleForm.desired.vehicles.map((v, i) => (
              <div key={i} className="app-panel app-form-grid app-form-grid--3">
                {vehicleForm.desired.vehicles.length > 1 && (
                  <div className="app-form-grid__full app-lead-vehicle__bar">
                    <Button variant="ghost" size="sm" onClick={() => removeEditDesiredVehicle(i)}>
                      Usuń
                    </Button>
                  </div>
                )}
                <TextField
                  label="Marka"
                  type="text"
                  value={v.make}
                  onChange={(event) =>
                    handleEditDesiredVehicleChange(i, "make", event.target.value)
                  }
                />
                <TextField
                  label="Model"
                  type="text"
                  value={v.model}
                  onChange={(event) =>
                    handleEditDesiredVehicleChange(i, "model", event.target.value)
                  }
                />
                <TextField
                  label="Rok od"
                  type="number"
                  value={v.yearFrom}
                  onChange={(event) =>
                    handleEditDesiredVehicleChange(i, "yearFrom", event.target.value)
                  }
                  min={1900}
                  max={new Date().getFullYear() + 1}
                />
                <TextField
                  label="Rok do"
                  type="number"
                  value={v.yearTo}
                  onChange={(event) =>
                    handleEditDesiredVehicleChange(i, "yearTo", event.target.value)
                  }
                  min={1900}
                  max={new Date().getFullYear() + 1}
                />
                <TextField
                  label="Budżet od (PLN)"
                  type="number"
                  value={v.budgetFrom}
                  onChange={(event) =>
                    handleEditDesiredVehicleChange(i, "budgetFrom", event.target.value)
                  }
                  min={0}
                  step="0.01"
                />
                <TextField
                  label="Budżet do (PLN)"
                  type="number"
                  value={v.budgetTo}
                  onChange={(event) =>
                    handleEditDesiredVehicleChange(i, "budgetTo", event.target.value)
                  }
                  min={0}
                  step="0.01"
                />
                <TextField
                  className="app-form-grid__full"
                  label="Uwagi (pojazd)"
                  type="text"
                  value={v.comment}
                  onChange={(event) =>
                    handleEditDesiredVehicleChange(i, "comment", event.target.value)
                  }
                />
              </div>
            ))}

            <div className="app-form-grid app-form-grid--3">
              <Select
                label="Rodzaj finansowania"
                value={vehicleForm.desired.financingType}
                onChange={(event) =>
                  handleVehicleFieldChange("desired", "financingType", event.target.value)
                }
                options={[
                  { value: "", label: "Wybierz..." },
                  "Gotówka",
                  "Kredyt",
                  "Leasing",
                ]}
              />
              {(vehicleForm.desired.financingType === "Kredyt" || vehicleForm.desired.financingType === "Leasing") && (
                <TextField
                  label="Kwota finansowania (PLN)"
                  type="number"
                  value={vehicleForm.desired.financingAmount}
                  onChange={(event) =>
                    handleVehicleFieldChange("desired", "financingAmount", event.target.value)
                  }
                  min={0}
                  step="0.01"
                />
              )}
              <TextField
                label="Wysokość odszkodowania (PLN)"
                type="number"
                value={vehicleForm.desired.amountAvailable}
                onChange={(event) =>
                  handleVehicleFieldChange("desired", "amountAvailable", event.target.value)
                }
                min={0}
                step="0.01"
                hint="Zastąp puste by usunąć kwotę."
                error={vehicleErrors["desired.amountAvailable"]}
              />
            </div>
            <div className="iz-field">
              <label className="iz-field__label" htmlFor={desiredNotesId}>
                Ogólne uwagi konwersacji
              </label>
              <textarea
                id={desiredNotesId}
                className="app-textarea"
                value={vehicleForm.desired.notes}
                onChange={(event) =>
                  handleVehicleFieldChange("desired", "notes", event.target.value)
                }
                maxLength={500}
              />
            </div>
          </div>

          <div className="app-form-actions">
            <Button variant="secondary" onClick={handleCloseVehicleModal}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isSavingVehicles}>
              {isSavingVehicles ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isUnlockModalOpen}
        onClose={() => setIsUnlockModalOpen(false)}
        title="Historia odblokowań"
      >
        {unlockHistory.length ? (
          <ul className="app-lead-list">
            {unlockHistory.map((entry, index) => (
              <li key={`${entry.unlockedAt}-${index}`} className="app-lead-item app-lead-item--subtle">
                {entry.type === "CLIENT_ATTEMPT" ? (
                  <>
                    <div className="app-kv__label">Aktywność klienta</div>
                    <div className="app-kv__value app-lead-unlock__value">
                      <strong>
                        {[
                          [entry.client?.firstName, entry.client?.lastName].filter(Boolean).join(" "),
                          entry.client?.email ? `(${entry.client?.email})` : null,
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      </strong>
                      <span>
                        {entry.timestamp
                          ? new Date(entry.timestamp).toLocaleString()
                          : "brak daty otwarcia"}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="app-kv__label">Odblokowane</div>
                    <div className="app-kv__value app-lead-unlock__value">
                      <strong>
                        {entry.unlockedByUser?.fullName || entry.unlockedByUser?.email
                          ? [
                            entry.unlockedByUser?.fullName,
                            entry.unlockedByUser?.email ? `(${entry.unlockedByUser?.email})` : null,
                          ]
                            .filter(Boolean)
                            .join(" ")
                          : entry.unlockedBy || "Nieznany użytkownik"}
                      </strong>
                      <span>
                        {entry.unlockedAt
                          ? new Date(entry.unlockedAt).toLocaleString()
                          : "brak daty"}
                      </span>
                      {entry.reason ? (
                        <span className="app-muted">Powód: {entry.reason}</span>
                      ) : null}
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="app-muted app-lead-text">Brak historii odblokowań.</p>
        )}
      </Modal>

      <Modal
        isOpen={isConfirmUnlockOpen}
        onClose={() => {
          if (!isUnlocking) setIsConfirmUnlockOpen(false);
        }}
        title="Odblokuj wniosek"
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!lead?.applicationForm?.id) return;
            setIsUnlocking(true);
            try {
              await apiUnlockApplicationForm(lead.applicationForm.id, unlockReason.trim() || undefined);
              addToast("Formularz odblokowany i link wysłany do klienta.", "success");
              setIsConfirmUnlockOpen(false);
              setUnlockReason("");
              const r = onRefresh();
              if (r instanceof Promise) await r;
            } catch (err) {
              const message = err instanceof ApiError ? err.message : "Nie udało się odblokować wniosku";
              addToast(message, "error");
            } finally {
              setIsUnlocking(false);
            }
          }}
          className="app-form"
        >
          <TextField
            label="Powód (opcjonalnie)"
            type="text"
            value={unlockReason}
            onChange={(e) => setUnlockReason(e.target.value)}
            maxLength={500}
            placeholder="Np. korekta danych w sekcji zatrudnienie"
          />
          <div className="app-form-actions">
            <Button
              variant="secondary"
              onClick={() => setIsConfirmUnlockOpen(false)}
              disabled={isUnlocking}
            >
              Anuluj
            </Button>
            <Button type="submit" variant="primary" disabled={isUnlocking}>
              {isUnlocking ? "Odblokowuję…" : "Odblokuj i wyślij link"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isGenerateFormModalOpen}
        onClose={() => setIsGenerateFormModalOpen(false)}
        title="Wyślij formularz klientowi"
      >
        {generatedLinkResult ? (
          <div className="app-form app-lead-generated">
            <p>Link do formularza:</p>
            <div className="app-panel app-lead-link">
              <span>{generatedLinkResult.link}</span>
              <Button variant="secondary" size="sm" onClick={handleCopyFormLink}>
                Kopiuj
              </Button>
            </div>
            <p>
              Kod dostępu: <strong>{accessCodeInput}</strong>
            </p>
            <p>Ważny do: {new Date(generatedLinkResult.expiresAt).toLocaleString()}</p>
            <div className="app-form-actions">
              <Button variant="primary" onClick={() => setIsGenerateFormModalOpen(false)}>
                Zamknij
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleGenerateFormLink} className="app-form">
            <TextField
              label="Kod dostępu (4 cyfry)"
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={accessCodeInput}
              onChange={(event) => setAccessCodeInput(event.target.value.replace(/[^0-9]/g, ""))}
              placeholder="np. 1234"
              hint="Podpowiedź: ostatnie 4 cyfry telefonu klienta."
            />
            <TextField
              label="Ważność linku (dni)"
              type="number"
              min={1}
              max={30}
              value={expiresInDays}
              onChange={(event) => setExpiresInDays(Number(event.target.value))}
            />
            {generateLinkError ? (
              <div className="app-alert app-alert--danger" role="alert">
                {generateLinkError}
              </div>
            ) : null}
            <div className="app-form-actions">
              <Button variant="secondary" onClick={() => setIsGenerateFormModalOpen(false)}>
                Anuluj
              </Button>
              <Button type="submit" variant="primary" disabled={isGeneratingFormLink}>
                {isGeneratingFormLink ? "Wysyłam…" : "Wyślij link"}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        isOpen={isAnonymizeModalOpen}
        onClose={() => setIsAnonymizeModalOpen(false)}
        title="Anonymize lead"
      >
        <div className="app-form">
          <div className="app-alert app-alert--danger">
            <span>
              <strong>Warning:</strong> This action is irreversible. All personal data will be permanently anonymized.
            </span>
          </div>
          <TextField
            label={'Aby potwierdzić, wpisz "ANONIMIZUJ" poniżej:'}
            type="text"
            value={anonymizeConfirmation}
            onChange={(e) => setAnonymizeConfirmation(e.target.value)}
          />
          <div className="app-form-actions">
            <Button variant="secondary" onClick={() => setIsAnonymizeModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleAnonymize}
              disabled={anonymizeConfirmation !== "ANONIMIZUJ" || isAnonymizing}
            >
              {isAnonymizing ? "Anonymizing..." : "Anonymize"}
            </Button>
          </div>
        </div>
      </Modal>


      <SendEmailModal
        isOpen={isSendEmailModalOpen}
        onClose={() => {
          setIsSendEmailModalOpen(false);
          setReplyContext(null);
        }}
        leadId={lead.id}
        onSuccess={() => onRefresh()}
        replyContext={replyContext}
        offerBudget={offerBudgetValue}
        offerAmountAvailable={offerAmountAvailableValue}
      />
    </section >
  );
};

const InfoItem: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div>
    <dt>{label}</dt>
    <dd>{value}</dd>
  </div>
);

const formatAuditAction = (action: string, field?: string | null) => {
  switch (action) {
    case "status_change":
      return "Lead status updated";
    case "financing_update":
      return "Financing data saved";
    case "document_added":
      return "Document attached";
    default:
      return field ? `${action} (${field})` : action;
  }
};

const renderAuditDetails = (log: LeadDetail["auditLogs"][number]) => {
  if (log.action === "status_change" && typeof log.newValue === "string") {
    const note =
      log.metadata && typeof log.metadata === "object" && "notes" in log.metadata
        ? (log.metadata as { notes?: string }).notes
        : null;

    return (
      <div className="app-lead-audit-details">
        <div>Status: {LEAD_STATUS_LABELS[log.newValue as LeadStatus] || log.newValue}</div>
        {note ? <div>Notatka: {note}</div> : null}
      </div>
    );
  }

  if (log.action === "document_added" && log.metadata) {
    const doc = log.metadata as { type?: string; filePath?: string };
    return (
      <div className="app-lead-audit-details">
        {doc.type ? <div>Type: {doc.type}</div> : null}
        {doc.filePath ? (
          <div>
            Path:{" "}
            <a href={resolveDocumentUrl(doc.filePath)} target="_blank" rel="noopener noreferrer" className="app-link">
              {doc.filePath}
            </a>
          </div>
        ) : null}
      </div>
    );
  }

  if (log.action === "document_added" && log.newValue) {
    const doc = log.newValue as {
      filePath?: string;
      originalName?: string;
      mimeType?: string;
      size?: number;
    };
    return (
      <div className="app-lead-audit-details">
        {doc.originalName ? <div>Original name: {doc.originalName}</div> : null}
        {doc.mimeType ? <div>Type: {doc.mimeType}</div> : null}
        {doc.size ? <div>Size: {Math.round(doc.size / 1024)} KB</div> : null}
        {doc.filePath ? (
          <div>
            Link:{" "}
            <a href={resolveDocumentUrl(doc.filePath)} target="_blank" rel="noopener noreferrer" className="app-link">
              {doc.filePath}
            </a>
          </div>
        ) : null}
      </div>
    );
  }

  if (log.action === "financing_update" && log.newValue) {
    const payload = log.newValue as Record<string, unknown>;
    return (
      <div className="app-lead-audit-details">
        {Object.entries(payload)
          .filter(([, value]) => value !== null && value !== undefined && value !== "")
          .slice(0, 4)
          .map(([key, value]) => (
            <div key={key}>
              {key}: {String(value)}
            </div>
          ))}
      </div>
    );
  }

  if (log.metadata) {
    return (
      <div className="app-lead-audit-details">{JSON.stringify(log.metadata)}</div>
    );
  }

  return null;
};

type EmailReplyContext = {
  noteId: string;
  subject: string;
  quotedHtml: string;
  quotedText: string;
};
