import React, { useState, useEffect, useImperativeHandle, forwardRef } from "react";
import { useParams } from "react-router-dom";
import { ConsentTemplateDto, fetchConsentTemplates } from "../../../api/consents";
import { Button, Checkbox } from "../../ui";
import { cx } from "../../ui/cx";

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
  <div className="app-client-summary__row">
    <span className="app-client-summary__label">{label}</span>
    <span className="app-client-summary__value">{String(value ?? "—")}</span>
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
      <h2 className="app-client-step-title">Krok 6: Zgody i podsumowanie</h2>

      <fieldset className="app-client-section">
        <legend className="app-client-section__title">Podsumowanie danych</legend>
        <p className="app-client-note">Proszę zweryfikować poprawność wprowadzonych danych przed wysłaniem wniosku.</p>

        {SUMMARY_SECTIONS.map((section) => {
          const sectionRows = section.keys
            .filter((key) => key in formData)
            .map((key) => (
              <SummaryItem key={key} label={FIELD_LABELS[key] ?? key} value={formData[key]} />
            ));

          if (sectionRows.length === 0) return null;

          return (
            <div key={section.title}>
              <h3 className="app-client-summary__title">{section.title}</h3>
              {sectionRows}
            </div>
          );
        })}
      </fieldset>

      <fieldset className="app-client-section">
        <legend className="app-client-section__title">Zgody</legend>
        {isLoading && <p className="app-muted">Ładowanie zgód...</p>}
        {error && <div className="app-alert app-alert--danger">{error}</div>}
        {templates.map((consent) => {
          const hasError = submitAttempted && consent.isRequired && !consentState[consent.id];
          return (
            <div key={consent.id} className={cx("app-client-consent", hasError && "app-client-consent--error")}>
              <div className="app-client-consent__head">
                <Checkbox
                  checked={consentState[consent.id] || false}
                  onChange={(e) => handleConsentChange(consent.id, e.target.checked)}
                  disabled={isReadOnly}
                  label={<>{consent.title || consent.content} {consent.isRequired && "*"}</>}
                  className={hasError ? "app-client-consent__check--error" : undefined}
                />
                <Button type="button" variant="ghost" size="sm" onClick={() => toggleConsentOpen(consent.id)}>
                  {consentOpen[consent.id] ? "Ukryj treść" : "Pokaż treść"}
                </Button>
              </div>
              {consent.helpText && <small className="app-client-consent__help">{consent.helpText}</small>}
              {consentOpen[consent.id] ? (
                <div className="app-client-consent__content">{consent.content || "Brak treści zgody."}</div>
              ) : null}
            </div>
          );
        })}
        {submittedAt ? (
          <div className="app-alert app-alert--success">Wniosek został wysłany: {new Date(submittedAt).toLocaleString()}</div>
        ) : null}
      </fieldset>
    </div>
  );
});

Step6_Summary.displayName = "Step6_Summary";
