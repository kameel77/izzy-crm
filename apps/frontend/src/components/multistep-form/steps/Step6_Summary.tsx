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
  submittedAt?: string | null;
  isReadOnly?: boolean;
}

const FIELD_LABELS: Record<string, string> = {
  pesel: "PESEL",
  firstName: "Imię",
  lastName: "Nazwisko",
  mobilePhone: "Telefon",
  email: "E-mail",
  birthDate: "Data urodzenia",
  gender: "Płeć",
  birthPlace: "Miejsce urodzenia",
  countryOfBirth: "Kraj urodzenia",
  citizenship: "Obywatelstwo",
  secondCitizenship: "Drugie obywatelstwo",
  nationality: "Narodowość",
  maidenName: "Nazwisko rodowe",
  maritalStatus: "Stan cywilny",
  mothersMaidenName: "Nazwisko panieńskie matki",
  childrenCount: "Liczba dzieci",
  isTaxResident: "Rezydent podatkowy",
  documentType: "Rodzaj dokumentu",
  documentNumber: "Numer dokumentu",
  issueDate: "Data wydania",
  expiryDate: "Data ważności",
  education: "Wykształcenie",
  registeredStreet: "Ulica zameldowania",
  registeredPostalCode: "Kod pocztowy zameldowania",
  registeredCity: "Miejscowość zameldowania",
  registeredPostOffice: "Poczta zameldowania",
  residentialCountry: "Kraj zamieszkania",
  residentialStreet: "Ulica zamieszkania",
  residentialPostalCode: "Kod pocztowy zamieszkania",
  residentialCity: "Miejscowość zamieszkania",
  residentialPostOffice: "Poczta zamieszkania",
  propertyType: "Typ lokalu",
  ownershipType: "Rodzaj własności",
  addressFrom: "Adres od",
  incomeSource: "Źródło dochodów",
  employmentSince: "Zatrudnienie od",
  profession: "Zawód",
  position: "Stanowisko",
  employmentSector: "Sektor zatrudnienia",
  totalWorkExperience: "Staż pracy",
  workplaceType: "Rodzaj zakładu pracy",
  employerName: "Nazwa pracodawcy",
  employerStreet: "Ulica pracodawcy",
  employerPostalCode: "Kod pocztowy pracodawcy",
  employerCity: "Miejscowość pracodawcy",
  employerPostOffice: "Poczta pracodawcy",
  employerPhone: "Telefon pracodawcy",
  employerNip: "NIP pracodawcy",
  employerRegon: "REGON pracodawcy",
  mainIncome: "Główne dochody",
  otherIncome: "Inne dochody",
  housingFees: "Opłaty za mieszkanie",
  otherLivingCosts: "Pozostałe koszty życia",
  loanInstallments: "Kwota rat kredytów",
  cardLimits: "Kwota limitów kart/kredytów",
  otherFinancialLiabilities: "Inne obciążenia finansowe",
};

const SUMMARY_SECTIONS: Array<{ title: string; keys: string[] }> = [
  {
    title: "Dane osobowe",
    keys: [
      "pesel", "firstName", "lastName", "mobilePhone", "email", "birthDate", "gender", "birthPlace", "countryOfBirth",
      "citizenship", "secondCitizenship", "nationality", "maidenName", "maritalStatus", "mothersMaidenName", "childrenCount", "isTaxResident",
    ],
  },
  {
    title: "Dokument",
    keys: ["documentType", "documentNumber", "issueDate", "expiryDate", "education"],
  },
  {
    title: "Adresy",
    keys: [
      "registeredStreet", "registeredPostalCode", "registeredCity", "registeredPostOffice", "isResidentialSameAsRegistered", "residentialCountry",
      "residentialStreet", "residentialPostalCode", "residentialCity", "residentialPostOffice", "propertyType", "ownershipType", "addressFrom",
    ],
  },
  {
    title: "Zatrudnienie",
    keys: [
      "incomeSource", "employmentSince", "profession", "position", "employmentSector", "totalWorkExperience", "workplaceType", "employerName",
      "employerStreet", "employerPostalCode", "employerCity", "employerPostOffice", "employerPhone", "employerNip", "employerRegon",
    ],
  },
  {
    title: "Budżet",
    keys: ["mainIncome", "otherIncome", "housingFees", "otherLivingCosts", "loanInstallments", "cardLimits", "otherFinancialLiabilities"],
  },
];

const SummaryItem = ({ label, value }: { label: string; value: unknown }) => (
  <div style={styles.summaryItem}>
    <span style={styles.summaryLabel}>{label}</span>
    <span style={styles.summaryValue}>{String(value ?? "—")}</span>
  </div>
);

export const Step6_Summary = forwardRef<Step6Ref, Step6Props>(({
  formData,
  onFormChange,
  submitAttempted,
  submittedAt,
  isReadOnly = false,
}, ref) => {
  const { applicationFormId, leadId } = useParams<{ applicationFormId: string; leadId: string }>();
  const [templates, setTemplates] = useState<ConsentTemplateDto[]>([]);
  const [consentState, setConsentState] = useState<Record<string, boolean>>({});
  const [consentOpen, setConsentOpen] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useImperativeHandle(ref, () => ({
    triggerValidation: async () => {
      const requiredConsents = templates.filter((c) => c.isRequired);
      if (requiredConsents.length === 0) return true;
      return requiredConsents.every((c) => consentState[c.id]);
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

      templates.forEach((template) => {
        const saved = savedConsents?.find((c) => c.templateId === template.id);
        initialConsentState[template.id] = saved ? saved.given : false;
      });

      setConsentState(initialConsentState);
      setIsInitialized(true);
    }
  }, [templates, formData, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    const consentsForForm = templates.map((t) => ({
      templateId: t.id,
      version: t.version,
      given: consentState[t.id] || false,
    }));
    onFormChange({ consents: consentsForForm });
  }, [consentState, templates, onFormChange, isInitialized]);

  const handleConsentChange = (consentId: string, isChecked: boolean) => {
    setConsentState((prev) => ({ ...prev, [consentId]: isChecked }));
  };

  const toggleConsentOpen = (consentId: string) => {
    setConsentOpen((prev) => ({ ...prev, [consentId]: !prev[consentId] }));
  };

  return (
    <div>
      <h2 style={{ marginTop: 0, marginBottom: "1.5rem" }}>Krok 6: Zgody i podsumowanie</h2>

      <fieldset style={styles.fieldset}>
        <legend style={styles.legend}>Podsumowanie danych</legend>
        <p>Proszę zweryfikować poprawność wprowadzonych danych przed wysłaniem wniosku.</p>

        {SUMMARY_SECTIONS.map((section) => {
          const sectionRows = section.keys
            .filter((key) => key in formData)
            .map((key) => (
              <SummaryItem key={key} label={FIELD_LABELS[key] ?? key} value={formData[key]} />
            ));

          if (sectionRows.length === 0) return null;

          return (
            <div key={section.title} style={styles.summarySection}>
              <h3 style={styles.summarySectionTitle}>{section.title}</h3>
              {sectionRows}
            </div>
          );
        })}
      </fieldset>

      <fieldset style={styles.fieldset}>
        <legend style={styles.legend}>Zgody</legend>
        {isLoading && <p>Ładowanie zgód...</p>}
        {error && <p style={styles.error}>{error}</p>}
        {templates.map((consent) => {
          const hasError = submitAttempted && consent.isRequired && !consentState[consent.id];
          return (
            <div key={consent.id} style={styles.consentItem}>
              <div style={styles.consentHeader}>
                <label style={hasError ? { ...styles.consentLabel, ...styles.errorLabel } : styles.consentLabel}>
                  <input
                    type="checkbox"
                    checked={consentState[consent.id] || false}
                    onChange={(e) => handleConsentChange(consent.id, e.target.checked)}
                    disabled={isReadOnly}
                  />
                  {consent.title || consent.content} {consent.isRequired && "*"}
                </label>
                <button
                  type="button"
                  style={styles.consentToggle}
                  onClick={() => toggleConsentOpen(consent.id)}
                >
                  {consentOpen[consent.id] ? "Ukryj treść" : "Pokaż treść"}
                </button>
              </div>
              {consent.helpText && <small style={styles.helpText}>{consent.helpText}</small>}
              {consentOpen[consent.id] ? (
                <div style={styles.consentContent}>{consent.content || "Brak treści zgody."}</div>
              ) : null}
            </div>
          );
        })}
        {submittedAt ? (
          <p style={styles.submittedNote}>Wniosek został wysłany: {new Date(submittedAt).toLocaleString()}</p>
        ) : null}
      </fieldset>
    </div>
  );
});

Step6_Summary.displayName = "Step6_Summary";

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
  summarySection: {
    marginBottom: "1rem",
  },
  summarySectionTitle: {
    marginBottom: "0.5rem",
  },
  summaryItem: {
    display: "flex",
    justifyContent: "space-between",
    padding: "0.5rem 0",
    borderBottom: "1px solid #f3f4f6",
  },
  summaryLabel: {
    color: "#475569",
  },
  summaryValue: {
    fontWeight: 500,
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
  submittedNote: {
    marginTop: "0.5rem",
    color: "#065f46",
    background: "#d1fae5",
    border: "1px solid #10b981",
    borderRadius: "6px",
    padding: "0.5rem 0.75rem",
    fontSize: "0.9rem",
  },
  consentItem: {
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    padding: "0.65rem 0.75rem",
    marginBottom: "0.75rem",
  },
  consentHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "0.5rem",
    alignItems: "center",
    flexWrap: "wrap",
  },
  consentLabel: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    fontSize: "0.95rem",
  },
  consentToggle: {
    background: "transparent",
    border: "1px solid #e5e7eb",
    borderRadius: 6,
    padding: "0.2rem 0.65rem",
    fontSize: "0.9rem",
    cursor: "pointer",
  },
  consentContent: {
    marginTop: "0.5rem",
    background: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: 6,
    padding: "0.65rem",
    whiteSpace: "pre-wrap",
    fontSize: "0.92rem",
  },
  helpText: {
    color: "#6b7280",
    fontSize: "0.85rem",
  },
};
