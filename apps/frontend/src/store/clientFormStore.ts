export type StoredConsent = {
  consentTemplateId: string;
  version: number;
  accepted: boolean;
  acceptedAt?: string;
};

export type ClientFormSnapshot = {
  applicationFormId: string;
  leadId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  consents: Record<string, StoredConsent>;
  accessCodeHash?: string | null;
  updatedAt: string;
};

const STORAGE_KEY = "client-form:consents";

const readStore = (): ClientFormSnapshot[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeStore = (snapshots: ClientFormSnapshot[]) => {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshots));
  } catch {
    // ignore
  }
};

export const clientFormStore = {
  load(formId: string, leadId: string): ClientFormSnapshot | null {
    return readStore().find((item) => item.applicationFormId === formId && item.leadId === leadId) ?? null;
  },
  save(snapshot: ClientFormSnapshot) {
    const store = readStore();
    const existingIndex = store.findIndex(
      (item) => item.applicationFormId === snapshot.applicationFormId && item.leadId === snapshot.leadId,
    );
    const updated = { ...snapshot, updatedAt: new Date().toISOString() };
    if (existingIndex >= 0) {
      store[existingIndex] = updated;
    } else {
      store.push(updated);
    }
    writeStore(store);
  },
  clear(formId: string, leadId: string) {
    const store = readStore().filter((item) => item.applicationFormId !== formId || item.leadId !== leadId);
    writeStore(store);
  },
};
