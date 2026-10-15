import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { ApiError } from "../api/client";
import { verifyApplicationFormAccess } from "../api/application-forms";
import {
  ConsentTemplateDto,
  fetchConsentTemplates,
  logUnlockAttempt,
  submitConsents,
} from "../api/consents";
import { Modal } from "../components/Modal";
import { Button, Checkbox, TextField } from "../components/ui";
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

  const persistedSnapshot = React.useMemo(() => {
    if (!applicationFormId || !leadId) return null;
    return clientFormStore.load(applicationFormId, leadId);
  }, [applicationFormId, leadId]);

  const [resolvedAccessCodeHash, setResolvedAccessCodeHash] = React.useState<string | null>(
    () => persistedSnapshot?.accessCodeHash ?? null,
  );

  const [pinInput, setPinInput] = React.useState("");
  const [pinError, setPinError] = React.useState<string | null>(null);
  const requiresAccessCode = Boolean(applicationFormId && leadId) && !resolvedAccessCodeHash;

  const handlePinSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const sanitized = pinInput.trim();
    if (!/^[0-9]{4}$/.test(sanitized)) {
      setPinError("Kod musi mieć 4 cyfry");
      return;
    }
    try {
      const response = await verifyApplicationFormAccess({
        applicationFormId,
        leadId,
        code: sanitized,
      });
      const verifiedHash = response.accessCodeHash ?? (await hashAccessCode(sanitized));
      logUnlockAttempt(applicationFormId, true);
      setResolvedAccessCodeHash(verifiedHash);
      setPinInput("");
      setPinError(null);
    } catch {
      setPinError("Nieprawidłowy kod dostępu");
      logUnlockAttempt(applicationFormId, false);
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
      if (!applicationFormId || !leadId) {
        setErrorModal({
          title: "Brak danych",
          message: "Link do formularza jest niekompletny.",
        });
        return;
      }

      setLoading(true);
      try {
        const data = await fetchConsentTemplates({
          formType: DEFAULT_FORM_TYPE,
          applicationFormId,
          leadId,
        });
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
    [applicationFormId, leadId, syncConsentsWithTemplates, track],
  );

  React.useEffect(() => {
    if (requiresAccessCode) return;
    loadTemplates();
  }, [loadTemplates, requiresAccessCode]);

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
      setSuccess("Zgody zostały zapisane. Przechodzę do formularza...");
      track("consents_submit_success", { applicationFormId, leadId });
      setTimeout(() => navigate(`/client-form/${applicationFormId}/${leadId}`), 1500);
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
    <div className="app-auth">
      <div className="app-adm-lock">
        {requiresAccessCode ? (
          <div className="app-adm-card">
            <h1 className="app-auth__title app-adm-card__title">Podaj kod dostępu</h1>
            <p className="app-adm-text app-adm-card__lead">
              Formularz został zabezpieczony kodem dostępu. Wprowadź kod z wiadomości, aby kontynuować.
            </p>
            <form onSubmit={handlePinSubmit} className="app-form">
              <TextField
                label="Kod (4 cyfry)"
                className="app-adm-pin"
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pinInput}
                onChange={(event) => setPinInput(event.target.value.replace(/[^0-9]/g, ""))}
                error={pinError ?? undefined}
              />
              <Button type="submit" variant="primary" size="lg" className="app-adm-full">
                Odblokuj
              </Button>
            </form>
          </div>
        ) : (
          <div className="app-adm-card">
            <h1 className="app-auth__title app-adm-card__title">Zgody RODO</h1>
            {isClientActive ? (
              <div className="app-alert app-alert--warning app-adm-card__banner" role="status">
                Klient jest aktualnie zalogowany w formularzu. Edycja zgód została tymczasowo zablokowana.
              </div>
            ) : null}
            {loading ? (
              <p className="app-muted">Ładuję zgody…</p>
            ) : (
              <form onSubmit={handleSubmit} className="app-form">
                {templates.map((tpl) => (
                  <div key={tpl.id} className="app-panel">
                    <Checkbox
                      checked={consentState[tpl.id]?.accepted ?? false}
                      onChange={(event) => toggleConsent(tpl, event.target.checked)}
                      required={tpl.isRequired}
                      disabled={isClientActive || requiresAccessCode}
                      label={
                        <>
                          <strong>{tpl.title}</strong>
                          {tpl.isRequired ? <span className="app-adm-required"> (wymagana)</span> : null}
                        </>
                      }
                    />
                    <p className="app-adm-content">{tpl.content}</p>
                    {tpl.helpText ? <p className="app-adm-help">{tpl.helpText}</p> : null}
                  </div>
                ))}
                {success ? <p className="app-alert app-alert--success">{success}</p> : null}
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="app-adm-full"
                  disabled={submitting || !allRequiredAccepted || isClientActive || requiresAccessCode}
                >
                  {submitting ? "Zapisuję…" : "Zapisz zgody"}
                </Button>
              </form>
            )}
          </div>
        )}
      </div>
      <Modal
        isOpen={Boolean(errorModal)}
        onClose={() => {
          setErrorModal(null);
          track("consents_modal_closed", { applicationFormId, leadId });
        }}
        title={errorModal?.title}
      >
        <p className="app-adm-text">{errorModal?.message}</p>
      </Modal>
    </div>
  );
};
