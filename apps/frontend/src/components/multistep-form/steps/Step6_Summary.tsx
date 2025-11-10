import React, { useState, useEffect, useImperativeHandle, forwardRef } from "react";
import { useParams } from "react-router-dom";
import { ConsentTemplateDto, fetchConsentTemplates } from "../../../api/consents";

export interface Step6Ref {
  triggerValidation: () => Promise<boolean>;
}

interface Step6Props {
  formData: Record<string, unknown>;
  onFormChange: (data: Record<string, unknown>) => void;
  submitAttempted: boolean;
}

const SummaryItem: React.FC<{ label: string; value: unknown }> = ({ label, value }) => (
  <div style={styles.summaryItem}>
    <span style={styles.summaryLabel}>{label}</span>
    <span style={styles.summaryValue}>{String(value ?? "—")}</span>
  </div>
);

export const Step6_Summary = forwardRef<Step6Ref, Step6Props>(({
  formData,
  onFormChange,
  submitAttempted,
}, ref) => {
  const { applicationFormId, leadId } = useParams<{ applicationFormId: string; leadId: string }>();
  const [templates, setTemplates] = useState<ConsentTemplateDto[]>([]);
  const [consentState, setConsentState] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useImperativeHandle(ref, () => ({
    triggerValidation: async () => {
      const requiredConsents = templates.filter((c) => c.isRequired);
      if (requiredConsents.length === 0) return true; 
      const allRequiredAccepted = requiredConsents.every((c) => consentState[c.id]);
      return allRequiredAccepted;
    },
  }));

  useEffect(() => {
    const loadTemplates = async () => {
      if (!applicationFormId || !leadId) {
        setError("Brak wymaganych parametrów do załadowania zgód.");
        setIsLoading(false);
        return;
      }
      try {
        const fetchedTemplates = await fetchConsentTemplates({
          applicationFormId,
          leadId,
          formType: "financing_application",
        });
        setTemplates(fetchedTemplates);
      } catch (err) {
        setError("Nie udało się załadować szablonów zgód.");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    loadTemplates();
  }, [applicationFormId, leadId]);

  useEffect(() => {
    if (templates.length > 0 && !isInitialized) {
      const initialConsentState: Record<string, boolean> = {};
      const savedConsents = formData.consents as Array<{ templateId: string; given: boolean }> | undefined;

      templates.forEach(template => {
        const saved = savedConsents?.find(c => c.templateId === template.id);
        initialConsentState[template.id] = saved ? saved.given : false;
      });

      setConsentState(initialConsentState);
      setIsInitialized(true);
    }
  }, [templates, formData, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    const consentsForForm = templates.map(t => ({
      templateId: t.id,
      version: t.version,
      given: consentState[t.id] || false,
    }));
    onFormChange({ consents: consentsForForm });
  }, [consentState, templates, onFormChange, isInitialized]);

  const handleConsentChange = (consentId: string, isChecked: boolean) => {
    setConsentState((prev) => ({ ...prev, [consentId]: isChecked }));
  };

  return (
    <div>
      <h2 style={{ marginTop: 0, marginBottom: "1.5rem" }}>Krok 6: Zgody i podsumowanie</h2>

      <fieldset style={styles.fieldset}>
        <legend style={styles.legend}>Podsumowanie danych</legend>
        <p>Proszę zweryfikować poprawność wprowadzonych danych przed wysłaniem wniosku.</p>

        {Object.entries(formData)
          .filter(([key]) => key !== 'consents')
          .map(([key, value]) => (
            <SummaryItem key={key} label={key} value={value} />
        ))}
      </fieldset>

      <fieldset style={styles.fieldset}>
        <legend style={styles.legend}>Zgody</legend>
        {isLoading && <p>Ładowanie zgód...</p>}
        {error && <p style={styles.error}>{error}</p>}
        {templates.map((consent) => {
          const hasError = submitAttempted && consent.isRequired && !consentState[consent.id];
          return (
            <div key={consent.id} style={styles.field}>
              <label style={hasError ? { ...styles.label, ...styles.errorLabel } : styles.label}>
                <input
                  type="checkbox"
                  checked={consentState[consent.id] || false}
                  onChange={(e) => handleConsentChange(consent.id, e.target.checked)}
                />
                {consent.content} {consent.isRequired && "*"}
              </label>
              {consent.helpText && <small>{consent.helpText}</small>}
            </div>
          );
        })}
      </fieldset>
    </div>
  );
});

const styles: Record<string, React.CSSProperties> = {
  fieldset: {
    border: "none",
    padding: 0,
    margin: "0 0 2rem 0",
  },
  legend: {
    fontWeight: 600,
    fontSize: "1.1rem",
    marginBottom: "1rem",
    padding: 0,
    width: "100%",
    borderBottom: "1px solid #e5e7eb",
  },
  summaryItem: {
    display: "flex",
    justifyContent: "space-between",
    padding: "0.5rem 0",
    borderBottom: "1px solid #f3f4f6",
  },
  summaryLabel: {
    color: "#475569",
    textTransform: "capitalize",
  },
  summaryValue: {
    fontWeight: 500,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
    marginBottom: "1rem",
  },
  label: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  errorLabel: {
    color: "#ef4444",
    fontWeight: "bold",
  },
  error: {
    color: "#ef4444",
    fontSize: "0.875rem",
    marginBottom: "1rem",
  },
};
