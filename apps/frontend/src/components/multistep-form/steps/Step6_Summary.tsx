import React, { useState, useEffect } from "react";

// Mock data based on PRD
const mockConsentTemplates = [
  { id: "c1", text: "Zgoda na przetwarzanie danych po wygaśnięciu umowy", isRequired: true },
  { id: "c2", text: "Zgoda na marketing produktów grupy kapitałowej", isRequired: false },
  { id: "c3", text: "Zgoda na marketing elektroniczny (email i SMS)", isRequired: true },
  { id: "c4", text: "Zgoda na marketing telefoniczny", isRequired: false },
];

interface Step6Props {
  formData: any;
  onValidityChange: (isValid: boolean) => void;
  submitAttempted: boolean;
}

const SummaryItem: React.FC<{ label: string; value: any }> = ({ label, value }) => (
  <div style={styles.summaryItem}>
    <span style={styles.summaryLabel}>{label}</span>
    <span style={styles.summaryValue}>{String(value ?? "—")}</span>
  </div>
);

export const Step6_Summary: React.FC<Step6Props> = ({ formData, onValidityChange, submitAttempted }) => {
  const [consentState, setConsentState] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const requiredConsents = mockConsentTemplates.filter(c => c.isRequired);
    const allRequiredAccepted = requiredConsents.every(c => consentState[c.id]);
    onValidityChange(allRequiredAccepted);
  }, [consentState, onValidityChange]);

  const handleConsentChange = (consentId: string, isChecked: boolean) => {
    setConsentState(prev => ({ ...prev, [consentId]: isChecked }));
  };

  return (
    <div>
      <h2 style={{ marginTop: 0, marginBottom: "1.5rem" }}>Krok 6: Zgody i podsumowanie</h2>
      
      <fieldset style={styles.fieldset}>
        <legend style={styles.legend}>Podsumowanie danych</legend>
        <p>Proszę zweryfikować poprawność wprowadzonych danych przed wysłaniem wniosku.</p>
        
        {Object.entries(formData).map(([key, value]) => (
          <SummaryItem key={key} label={key} value={value} />
        ))}
      </fieldset>

      <fieldset style={styles.fieldset}>
        <legend style={styles.legend}>Zgody</legend>
        {submitAttempted && !onValidityChange && (
            <p style={styles.error}>Proszę zaakceptować wszystkie wymagane zgody.</p>
        )}
        {mockConsentTemplates.map(consent => {
          const hasError = submitAttempted && consent.isRequired && !consentState[consent.id];
          return (
            <div key={consent.id} style={styles.field}>
              <label style={hasError ? { ...styles.label, ...styles.errorLabel } : styles.label}>
                <input 
                  type="checkbox" 
                  checked={consentState[consent.id] || false}
                  onChange={(e) => handleConsentChange(consent.id, e.target.checked)}
                />
                {consent.text} {consent.isRequired && '*'}
              </label>
            </div>
          );
        })}
      </fieldset>
    </div>
  );
};

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
    width: '100%',
    borderBottom: '1px solid #e5e7eb',
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
    marginBottom: '1rem',
  },
  label: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  errorLabel: {
    color: "#ef4444",
    fontWeight: "bold",
  },
  error: {
    color: "#ef4444",
    fontSize: "0.875rem",
    marginBottom: '1rem',
  },
};
