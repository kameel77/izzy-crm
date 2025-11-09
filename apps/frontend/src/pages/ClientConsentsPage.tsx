import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { ApiError } from "../api/client";
import {
  ConsentTemplateDto,
  fetchConsentTemplates,
  logUnlockAttempt,
  submitConsents,
} from "../api/consents";
import { Modal } from "../components/Modal";
import { useTelemetry } from "../hooks/useTelemetry";
import { clientFormStore } from "../store/clientFormStore";

const DEFAULT_FORM_TYPE = "financing_application";

const modalCopy: Record<number, { title: string; message: string }> = {
  401: {
    title: "Link wygasł",
    message:
      "Link do wniosku wygasł lub został cofnięty. Skontaktuj się z doradcą, aby uzyskać nowy dostęp.",
  },
  409: {
    title: "Wersja formularza nieaktualna",
    message: "Odśwież stronę – pojawiła się nowsza wersja zgód, którą musisz zaakceptować.",
  },
  422: {
    title: "Brakuje wymaganych zgód",
    message: "Zaznacz wszystkie zgody oznaczone jako wymagane, aby przejść dalej.",
  },
};

const hashAccessCode = async (code: string) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(code);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

type ConsentState = Record<
  string,
  {
    accepted: boolean;
    version: number;
    acceptedAt?: string;
  }
>;

export const ClientConsentsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { track } = useTelemetry();

  const applicationFormId = searchParams.get("applicationFormId") ?? "";
  const leadId = searchParams.get("leadId") ?? "";
  const isClientActive = searchParams.get("clientActive") === "true";
  const queryHash = searchParams.get("hash") ?? null;

  const persistedSnapshot = React.useMemo(() => {
    if (!applicationFormId || !leadId) return null;
    return clientFormStore.load(applicationFormId, leadId);
  }, [applicationFormId, leadId]);

  const storedAccessCodeHash = persistedSnapshot?.accessCodeHash ?? null;
  const expectedHash = queryHash ?? storedAccessCodeHash ?? null;

  const [resolvedAccessCodeHash, setResolvedAccessCodeHash] = React.useState<string | null>(() => {
    if (expectedHash && persistedSnapshot?.accessCodeHash === expectedHash) {
      return expectedHash;
    }
    return null;
  });

  const [pinModalOpen, setPinModalOpen] = React.useState(
    Boolean(expectedHash && resolvedAccessCodeHash !== expectedHash),
  );
  const [pinInput, setPinInput] = React.useState("");
  const [pinError, setPinError] = React.useState<string | null>(null);
  const requiresAccessCode = Boolean(expectedHash) && resolvedAccessCodeHash !== expectedHash;

  const handlePinSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const sanitized = pinInput.trim();
    if (!/^[0-9]{4}$/.test(sanitized)) {
      setPinError("Kod musi mieć 4 cyfry");
      return;
    }
    try {
      const hash = await hashAccessCode(sanitized);
      if (!expectedHash || hash !== expectedHash) {
        setPinError("Nieprawidłowy kod dostępu");
        logUnlockAttempt(applicationFormId, false);
        return;
      }
      logUnlockAttempt(applicationFormId, true);
      setResolvedAccessCodeHash(hash);
      setPinInput("");
      setPinError(null);
      setPinModalOpen(false);
    } catch (error) {
      setPinError("Nie udało się przetworzyć kodu. Spróbuj ponownie");
    }
  };

  const [templates, setTemplates] = React.useState<ConsentTemplateDto[]>([]);
  const [consentState, setConsentState] = React.useState<ConsentState>(() => {
    if (!persistedSnapshot) return {};
    const next: ConsentState = {};
    Object.entries(persistedSnapshot.consents).forEach(([key, stored]) => {
      next[key] = {
        accepted: stored.accepted,
        version: stored.version,
        acceptedAt: stored.acceptedAt,
      };
    });
    return next;
  });
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [errorModal, setErrorModal] = React.useState<{ title: string; message: string } | null>(
    null,
  );
  const [success, setSuccess] = React.useState<string | null>(null);
  const [ipAddress, setIpAddress] = React.useState<string | null>(persistedSnapshot?.ipAddress ?? null);

  const userAgent = React.useMemo(
    () => persistedSnapshot?.userAgent ?? (typeof navigator !== "undefined" ? navigator.userAgent : ""),
    [persistedSnapshot],
  );

  const syncConsentsWithTemplates = React.useCallback(
    (data: ConsentTemplateDto[]) => {
      setConsentState((prev) => {
        const next: ConsentState = {};
        data.forEach((tpl) => {
          const stored = persistedSnapshot?.consents[tpl.id];
          if (stored && stored.version === tpl.version) {
            next[tpl.id] = {
              accepted: stored.accepted,
              version: stored.version,
              acceptedAt: stored.acceptedAt,
            };
            return;
          }
          if (prev[tpl.id] && prev[tpl.id].version === tpl.version) {
            next[tpl.id] = prev[tpl.id];
            return;
          }
          next[tpl.id] = {
            accepted: tpl.isRequired,
            version: tpl.version,
            acceptedAt: tpl.isRequired ? new Date().toISOString() : undefined,
          };
        });
        return next;
      });
    },
    [persistedSnapshot],
  );

  const loadTemplates = React.useCallback(
    async (retry = false) => {
      setLoading(true);
      try {
        const data = await fetchConsentTemplates(DEFAULT_FORM_TYPE);
        setTemplates(data);
        syncConsentsWithTemplates(data);
      } catch (error) {
        if (error instanceof ApiError && error.status === 409 && !retry) {
          await loadTemplates(true);
          return;
        }
        if (error instanceof ApiError && modalCopy[error.status]) {
          setErrorModal(modalCopy[error.status]);
          track("consents_modal_shown", { reason: error.status });
        } else {
          setErrorModal({
            title: "Nie udało się pobrać zgód",
            message: "Spróbuj ponownie później.",
          });
          track("consents_modal_shown", { reason: "unknown" });
        }
      } finally {
        setLoading(false);
      }
    },
    [syncConsentsWithTemplates],
  );

  React.useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  React.useEffect(() => {
    if (!expectedHash) {
      setPinModalOpen(false);
      return;
    }
    if (resolvedAccessCodeHash === expectedHash) {
      setPinModalOpen(false);
    } else {
      setPinModalOpen(true);
    }
  }, [expectedHash, resolvedAccessCodeHash]);

  React.useEffect(() => {
    if (!applicationFormId || !leadId || !templates.length) return;
    clientFormStore.save({
      applicationFormId,
      leadId,
      ipAddress,
      userAgent,
      consents: Object.fromEntries(
        templates.map((tpl) => [
          tpl.id,
          {
            consentTemplateId: tpl.id,
            version: consentState[tpl.id]?.version ?? tpl.version,
            accepted: Boolean(consentState[tpl.id]?.accepted),
            acceptedAt: consentState[tpl.id]?.acceptedAt,
          },
        ]),
      ),
      accessCodeHash: resolvedAccessCodeHash,
      updatedAt: new Date().toISOString(),
    });
  }, [applicationFormId, leadId, templates, consentState, ipAddress, userAgent, resolvedAccessCodeHash]);

  React.useEffect(() => {
    if (persistedSnapshot?.ipAddress) {
      return;
    }
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch("https://api.ipify.org?format=json", { signal: controller.signal });
        if (res.ok) {
          const payload = await res.json();
          setIpAddress(payload.ip ?? null);
        }
      } catch {
        setIpAddress(null);
      }
    })();
    return () => controller.abort();
  }, [persistedSnapshot]);

  const toggleConsent = (tpl: ConsentTemplateDto, value: boolean) => {
    setConsentState((prev) => ({
      ...prev,
      [tpl.id]: {
        accepted: value,
        version: tpl.version,
        acceptedAt: value ? new Date().toISOString() : undefined,
      },
    }));
  };

  const allRequiredAccepted = templates.every((tpl) => !tpl.isRequired || consentState[tpl.id]?.accepted);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!applicationFormId || !leadId || !resolvedAccessCodeHash) {
      setErrorModal({
        title: "Brak danych formularza",
        message: "Link jest niekompletny – wróć do wiadomości i otwórz formularz ponownie.",
      });
      return;
    }

    if (requiresAccessCode) {
      setPinModalOpen(true);
      return;
    }

    if (!allRequiredAccepted) {
      setErrorModal(modalCopy[422]);
      return;
    }

    setSubmitting(true);
    setSuccess(null);
    try {
      await submitConsents({
        applicationFormId,
        leadId,
        accessCodeHash: resolvedAccessCodeHash,
        ipAddress,
        userAgent,
        consents: templates.map((tpl) => ({
          consentTemplateId: tpl.id,
          version: tpl.version,
          consentGiven: Boolean(consentState[tpl.id]?.accepted),
          consentText: tpl.content,
          acceptedAt: consentState[tpl.id]?.acceptedAt,
        })),
      });
      setSuccess("Zgody zostały zapisane. Możesz wrócić do formularza.");
      track("consents_submit_success", { applicationFormId, leadId });
      setTimeout(() => navigate("/login"), 1500);
    } catch (error) {
      if (error instanceof ApiError) {
        if (modalCopy[error.status]) {
          setErrorModal(modalCopy[error.status]);
          track("consents_modal_shown", { reason: error.status });
          if (error.status === 409) {
            loadTemplates();
          }
        } else {
          setErrorModal({ title: "Błąd", message: error.message });
        }
        track("consents_submit_error", { applicationFormId, leadId, reason: error.status ?? "api" });
      } else {
        setErrorModal({ title: "Błąd", message: "Nie udało się zapisać zgód." });
        track("consents_submit_error", { applicationFormId, leadId, reason: "network" });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.shell}>
      <div style={styles.lockWrapper}>
        <div
          style={{
            ...styles.card,
            filter: requiresAccessCode ? "blur(6px)" : "none",
            pointerEvents: requiresAccessCode ? "none" : "auto",
          }}
        >
          <h1 style={styles.title}>Zgody RODO</h1>
          {isClientActive ? (
            <div style={styles.banner} role="status">
              Klient jest aktualnie zalogowany w formularzu. Edycja zgód została tymczasowo zablokowana.
            </div>
          ) : null}
          {loading ? (
            <p>Ładuję zgody…</p>
          ) : (
            <form onSubmit={handleSubmit} style={styles.form}>
              {templates.map((tpl) => (
                <div key={tpl.id} style={styles.template}>
                  <label style={styles.label}>
                    <input
                      type="checkbox"
                      checked={consentState[tpl.id]?.accepted ?? false}
                      onChange={(event) => toggleConsent(tpl, event.target.checked)}
                      required={tpl.isRequired}
                      disabled={isClientActive || requiresAccessCode}
                    />
                    <span>
                      <strong>{tpl.title}</strong>
                      {tpl.isRequired ? <span style={styles.required}> (wymagana)</span> : null}
                    </span>
                  </label>
                  <p style={styles.content}>{tpl.content}</p>
                  {tpl.helpText ? <p style={styles.help}>{tpl.helpText}</p> : null}
                </div>
              ))}
              {success ? <p style={styles.success}>{success}</p> : null}
              <button
                type="submit"
                style={{
                  ...styles.button,
                  opacity: isClientActive || requiresAccessCode ? 0.5 : 1,
                  cursor: isClientActive || requiresAccessCode ? "not-allowed" : styles.button.cursor,
                }}
                disabled={submitting || !allRequiredAccepted || isClientActive || requiresAccessCode}
              >
                {submitting ? "Zapisuję…" : "Zapisz zgody"}
              </button>
            </form>
          )}
        </div>
        {requiresAccessCode ? (
          <div style={styles.lockOverlay}>
            <p>Formularz został zabezpieczony kodem dostępu. Wprowadź kod z wiadomości, aby kontynuować.</p>
            <button type="button" style={styles.primaryButton} onClick={() => setPinModalOpen(true)}>
              Wprowadź kod
            </button>
          </div>
        ) : null}
      </div>
      <Modal
        isOpen={Boolean(errorModal)}
        onClose={() => {
          setErrorModal(null);
          track("consents_modal_closed", { applicationFormId, leadId });
        }}
        title={errorModal?.title}
      >
        <p>{errorModal?.message}</p>
      </Modal>
      <Modal isOpen={pinModalOpen} onClose={() => setPinModalOpen(false)} title="Podaj kod dostępu">
        <form onSubmit={handlePinSubmit} style={styles.modalForm}>
          <label style={styles.modalLabel}>
            Kod (4 cyfry)
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pinInput}
              onChange={(event) => setPinInput(event.target.value.replace(/[^0-9]/g, ""))}
              style={styles.modalInput}
            />
            {pinError ? <span style={styles.errorText}>{pinError}</span> : null}
          </label>
          <div style={styles.modalActions}>
            <button type="button" style={styles.secondaryButton} onClick={() => setPinModalOpen(false)}>
              Anuluj
            </button>
            <button type="submit" style={styles.primaryButton}>
              Odblokuj
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  shell: {
    minHeight: "100vh",
    padding: "2rem",
    background: "linear-gradient(135deg, #1d3557, #457b9d)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  lockWrapper: {
    position: "relative",
    width: "min(960px, 100%)",
  },
  card: {
    width: "min(960px, 100%)",
    background: "#fff",
    borderRadius: "1rem",
    padding: "2rem",
    boxShadow: "0 32px 60px rgba(15, 23, 42, 0.25)",
  },
  lockOverlay: {
    position: "absolute",
    inset: 0,
    display: "grid",
    placeItems: "center",
    background: "rgba(15, 23, 42, 0.7)",
    color: "#fff",
    borderRadius: "1rem",
    padding: "2rem",
    textAlign: "center",
    gap: "1rem",
  },
  title: {
    marginTop: 0,
    marginBottom: "1.5rem",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "1.2rem",
  },
  template: {
    border: "1px solid #e2e8f0",
    borderRadius: "0.8rem",
    padding: "1rem",
    background: "#f8fafc",
  },
  label: {
    display: "flex",
    gap: "0.9rem",
    alignItems: "center",
  },
  content: {
    marginTop: "0.6rem",
    lineHeight: 1.5,
    whiteSpace: "pre-wrap",
  },
  help: {
    marginTop: "0.3rem",
    color: "#475569",
  },
  required: {
    color: "#dc2626",
  },
  button: {
    marginTop: "1rem",
    padding: "0.9rem 1.2rem",
    borderRadius: "0.75rem",
    border: "none",
    background: "#0f172a",
    color: "#fff",
    fontSize: "1rem",
    cursor: "pointer",
  },
  success: {
    color: "#16a34a",
    fontWeight: 600,
  },
};
