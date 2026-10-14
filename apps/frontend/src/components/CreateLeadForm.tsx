import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../hooks/useAuth";
import { ConsentTemplateDto, fetchAuthenticatedConsentTemplates } from "../api/consents";
import { fetchPartners, PartnerSummary } from "../api/partners";
import { Button, Checkbox, Select, TextField } from "./ui";

interface CreateLeadFormProps {
  onCreate: (payload: {
    partnerId?: string;
    customer: { firstName: string; lastName: string; email?: string; phone?: string; customerType?: string; city?: string; voivodeship?: string; postalCode?: string };
    currentVehicle?: {
      make?: string;
      model?: string;
      year?: number;
      mileage?: number;
      vin?: string;
    };
    desiredVehicle?: {
      make?: string;
      model?: string;
      year?: number;
      budget?: number;
      preferences?: {
        notes?: string;
        vehicles?: Array<{
          make?: string;
          model?: string;
          yearFrom?: number;
          yearTo?: number;
          budgetFrom?: number;
          budgetTo?: number;
          comment?: string;
        }>;
      };
    };
    financing: { downPayment: number };
    consents: Array<{
      templateId: string;
      version: number;
      given: boolean;
    }>;
  }) => Promise<void>;
  defaultPartnerId?: string | null;
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRegex = /^(?:\+?48)?(?:[ -]?)?(?:\d[ -]?){9}$/;
const customerTypes = ["osoba fizyczna", "JDG", "spółka"] as const;
const voivodeships = [
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

export const CreateLeadForm: React.FC<CreateLeadFormProps> = ({
  onCreate,
  defaultPartnerId,
}) => {
  const { user, token } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [customerType, setCustomerType] = useState("");
  const [city, setCity] = useState("");
  const [voivodeship, setVoivodeship] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [downPayment, setDownPayment] = useState("");
  const [currentMake, setCurrentMake] = useState("");
  const [currentModel, setCurrentModel] = useState("");
  const [currentYear, setCurrentYear] = useState("");
  const [currentMileage, setCurrentMileage] = useState("");
  const [currentVin, setCurrentVin] = useState("");
  const [isVehicleDataExpanded, setIsVehicleDataExpanded] = useState(false);

  const handlePostalCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const digitsOnly = value.replace(/\D/g, "").slice(0, 5);
    
    let formatted = digitsOnly;
    if (digitsOnly.length > 2) {
      formatted = `${digitsOnly.slice(0, 2)}-${digitsOnly.slice(2)}`;
    } else if (digitsOnly.length === 2 && postalCode.length < 3) {
      formatted = `${digitsOnly}-`;
    } else if (digitsOnly.length === 2 && value.endsWith('-')) {
      formatted = `${digitsOnly}-`;
    }
    
    setPostalCode(formatted);
  };

  const handleVinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    setCurrentVin(val);
  };
  const [desiredVehicles, setDesiredVehicles] = useState([{
    make: "", model: "", yearFrom: "", yearTo: "", budgetFrom: "", budgetTo: "", comment: ""
  }]);

  const handleDesiredVehicleChange = (index: number, field: string, value: string) => {
    const updated = [...desiredVehicles];
    updated[index] = { ...updated[index], [field as keyof typeof updated[0]]: value };
    setDesiredVehicles(updated);
  };

  const addDesiredVehicle = () => {
    setDesiredVehicles([
      ...desiredVehicles,
      { make: "", model: "", yearFrom: "", yearTo: "", budgetFrom: "", budgetTo: "", comment: "" }
    ]);
  };

  const removeDesiredVehicle = (index: number) => {
    if (desiredVehicles.length > 1) {
      setDesiredVehicles(desiredVehicles.filter((_, i) => i !== index));
    }
  };
  const [partnerId, setPartnerId] = useState(defaultPartnerId ?? "");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [consentTemplates, setConsentTemplates] = useState<ConsentTemplateDto[]>([]);
  const [consentState, setConsentState] = useState<Record<string, boolean>>({});
  const [consentOpen, setConsentOpen] = useState<Record<string, boolean>>({});
  const [consentsLoading, setConsentsLoading] = useState(true);
  const [partners, setPartners] = useState<PartnerSummary[]>([]);
  const [partnersLoading, setPartnersLoading] = useState(false);
  const [partnersError, setPartnersError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.partnerId) {
      setPartnerId(user.partnerId);
    } else if (defaultPartnerId) {
      setPartnerId(defaultPartnerId);
    }
  }, [user, defaultPartnerId]);

  useEffect(() => {
    const phoneDigits = phone.replace(/\D/g, "").slice(-9);
    if (phoneDigits.length > 0) {
      const formatted = `+48 ${phoneDigits.slice(0, 3)} ${phoneDigits.slice(3, 6)} ${phoneDigits.slice(6, 9)}`;
      if (formatted !== phone) {
        setPhone(formatted);
      }
    }
  }, [phone]);

  useEffect(() => {
    const loadConsents = async () => {
      try {
        const leadCreationTemplates = await fetchAuthenticatedConsentTemplates({ formType: "lead_creation" });
        let templates = leadCreationTemplates;

        if (!templates.length) {
          const financingTemplates = await fetchAuthenticatedConsentTemplates({ formType: "financing_application" });
          templates = financingTemplates.filter((template) => template.consentType === "PARTNER_DECLARATION");
        }

        templates = templates.sort((a, b) => a.title.localeCompare(b.title));

        setConsentTemplates(templates);
        setConsentState({});
      } catch (error) {
        setErrors(prev => ({ ...prev, consents: "Nie udało się wczytać wzorów zgód." }));
      } finally {
        setConsentsLoading(false);
      }
    };
    loadConsents();
  }, []);

  useEffect(() => {
    if (!token) return;
    const shouldLoadPartners = user?.role === "ADMIN";
    if (!shouldLoadPartners) return;

    let cancelled = false;
    const loadPartners = async () => {
      setPartnersLoading(true);
      setPartnersError(null);
      try {
        const response = await fetchPartners(token, { page: 1, perPage: 100 });
        if (!cancelled) {
          const sorted = [...response.data].sort((a, b) => a.name.localeCompare(b.name));
          setPartners(sorted);
        }
      } catch (error) {
        if (!cancelled) {
          setPartnersError("Nie udało się wczytać partnerów.");
        }
      } finally {
        if (!cancelled) {
          setPartnersLoading(false);
        }
      }
    };

    loadPartners();

    return () => {
      cancelled = true;
    };
  }, [token, user?.role]);

  const resolvedPartnerName = useMemo(() => {
    if (user?.partner?.name) return user.partner.name;
    const matched = partners.find((partner) => partner.id === partnerId);
    return matched?.name ?? partnerId ?? "";
  }, [user?.partner?.name, partners, partnerId]);

  const handleConsentChange = (consentId: string, isChecked: boolean) => {
    setConsentState(prev => ({ ...prev, [consentId]: isChecked }));
  };

  const toggleConsentOpen = (consentId: string) => {
    setConsentOpen(prev => ({ ...prev, [consentId]: !prev[consentId] }));
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (email && !emailRegex.test(email)) {
      newErrors.email = "Nieprawidłowy email (np. user@example.com).";
    }
    if (phone && !phoneRegex.test(phone.replace(/[\s-]+/g, ""))) {
      newErrors.phone = "Nieprawidłowy numer telefonu (np. +48 123 456 789).";
    }
    if (postalCode && !/^\d{2}-\d{3}$/.test(postalCode)) {
      newErrors.postalCode = "Nieprawidłowy kod pocztowy (wymagany format 00-000).";
    }
    if (currentVin && !/^[a-zA-Z0-9]{17}$/i.test(currentVin)) {
      newErrors.vin = "Numer VIN musi składać się z dokładnie 17 znaków alfanumerycznych.";
    }
    const allRequiredConsentsGiven = consentTemplates
      .filter(t => t.isRequired)
      .every(t => consentState[t.id]);
    if (!allRequiredConsentsGiven) {
      newErrors.consents = "Wymagane zgody muszą być zaznaczone.";
    }
    const parsedDownPayment = Number(downPayment);
    if (downPayment !== "" && (!Number.isFinite(parsedDownPayment) || parsedDownPayment < 0)) {
      newErrors.downPayment = "Dostępna kwota musi być liczbą nieujemną.";
    }
    let budgetError = false;
    desiredVehicles.forEach((v) => {
      if (v.budgetFrom && (Number.isNaN(Number(v.budgetFrom)) || Number(v.budgetFrom) < 0)) budgetError = true;
      if (v.budgetTo && (Number.isNaN(Number(v.budgetTo)) || Number(v.budgetTo) < 0)) budgetError = true;
    });
    if (budgetError) {
      newErrors.desiredBudget = "Budżety dla poszukiwanych pojazdów muszą być nieujemne.";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validate()) {
      return;
    }

    setLoading(true);
    try {
      const sanitizedPhone = phone.replace(/[\s-]+/g, "") || undefined;
      const parsedDownPayment = downPayment === "" ? 0 : Number(downPayment);
      const payload: Parameters<typeof onCreate>[0] = {
        partnerId: partnerId || undefined,
        customer: {
          firstName,
          lastName,
          email: email || undefined,
          phone: sanitizedPhone,
          customerType: customerType || undefined,
          city: city || undefined,
          voivodeship: voivodeship || undefined,
          postalCode: postalCode || undefined,
        },
        financing: {
          downPayment: parsedDownPayment,
        },
        consents: consentTemplates.map(t => ({
          templateId: t.id,
          version: t.version,
          given: consentState[t.id] || false,
        })),
      };

      if (currentMake || currentModel || currentYear || currentMileage || currentVin) {
        payload.currentVehicle = {
          make: currentMake || undefined,
          model: currentModel || undefined,
          year: currentYear ? Number(currentYear) : undefined,
          mileage: currentMileage ? Number(currentMileage) : undefined,
          vin: currentVin || undefined,
        };
      }

      const validDesiredVehicles = desiredVehicles.filter(
        (v) => v.make || v.model || v.yearFrom || v.yearTo || v.budgetFrom || v.budgetTo || v.comment
      );

      if (validDesiredVehicles.length > 0) {
        const firstVehicle = validDesiredVehicles[0];
        payload.desiredVehicle = {
          make: firstVehicle.make || undefined,
          model: firstVehicle.model || undefined,
          year: firstVehicle.yearFrom ? Number(firstVehicle.yearFrom) : undefined,
          budget: firstVehicle.budgetTo ? Number(firstVehicle.budgetTo) : undefined,
          preferences: {
            notes: firstVehicle.comment || undefined,
            vehicles: validDesiredVehicles.map(v => ({
              make: v.make || undefined,
              model: v.model || undefined,
              yearFrom: v.yearFrom ? Number(v.yearFrom) : undefined,
              yearTo: v.yearTo ? Number(v.yearTo) : undefined,
              budgetFrom: v.budgetFrom ? Number(v.budgetFrom) : undefined,
              budgetTo: v.budgetTo ? Number(v.budgetTo) : undefined,
              comment: v.comment || undefined,
            }))
          }
        };
      }

      await onCreate({
        ...payload,
      });
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");
      setDownPayment("");
      setCurrentMake("");
      setCurrentModel("");
      setCurrentYear("");
      setCurrentMileage("");
      setDesiredVehicles([{ make: "", model: "", yearFrom: "", yearTo: "", budgetFrom: "", budgetTo: "", comment: "" }]);
      setIsVehicleDataExpanded(false);
      setCustomerType("");
      setCity("");
      setVoivodeship("");
      setPostalCode("");
      setCurrentVin("");
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : "Nie udało się utworzyć leada" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="app-form">
      <fieldset className="app-lf-fieldset">
        <legend className="app-lf-legend">Wprowadź dane klienta</legend>
        <div className="app-lf-row">
          <TextField
            label="Imię"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            required
          />
          <TextField
            label="Nazwisko"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            required
          />
          {user?.role === "ADMIN" ? (
            <Select
              label="Partner"
              value={partnerId}
              onChange={(event) => setPartnerId(event.target.value)}
              disabled={partnersLoading}
              options={[
                { value: "", label: "Wybierz partnera" },
                ...partners.map((partner) => ({ value: partner.id, label: partner.name })),
              ]}
              error={partnersError ?? undefined}
            />
          ) : (
            <TextField
              label="Partner"
              className="app-lf-readonly"
              value={resolvedPartnerName}
              readOnly
              placeholder="Nazwa partnera"
            />
          )}
        </div>
        <div className="app-lf-row">
          <TextField
            label="Email"
            value={email}
            type="email"
            onChange={(event) => setEmail(event.target.value)}
            onBlur={validate}
            error={errors.email}
          />
          <TextField
            label="Telefon"
            value={phone}
            type="tel"
            onChange={(event) => setPhone(event.target.value)}
            onBlur={validate}
            error={errors.phone}
          />
          <Select
            label="Rodzaj klienta"
            value={customerType}
            onChange={(event) => setCustomerType(event.target.value)}
            options={[{ value: "", label: "Wybierz" }, ...customerTypes.map((type) => ({ value: type, label: type }))]}
          />
        </div>
        <div className="app-lf-row">
          <TextField
            label="Miasto"
            value={city}
            onChange={(event) => setCity(event.target.value)}
            placeholder="np. Warszawa"
          />
          <TextField
            label="Kod pocztowy"
            value={postalCode}
            onChange={handlePostalCodeChange}
            placeholder="np. 00-000"
            maxLength={6}
            error={errors.postalCode}
          />
          <Select
            label="Województwo"
            value={voivodeship}
            onChange={(event) => setVoivodeship(event.target.value)}
            options={[{ value: "", label: "Wybierz" }, ...voivodeships.map((item) => ({ value: item, label: item }))]}
          />
          <TextField
            label="Dostępna kwota (PLN)"
            value={downPayment}
            type="number"
            min="0"
            step="0.01"
            onChange={(event) => setDownPayment(event.target.value)}
            error={errors.downPayment}
          />
        </div>
      </fieldset>

      <fieldset className="app-lf-fieldset">
        <legend
          className="app-lf-legend app-lf-legend--toggle"
          onClick={() => setIsVehicleDataExpanded(!isVehicleDataExpanded)}
        >
          Informacje o pojeździe
          <span className="app-lf-legend__caret">{isVehicleDataExpanded ? "▼" : "▶"}</span>
        </legend>

        {isVehicleDataExpanded && (
          <div className="app-lf-vehicle-data">
            <div className="app-lf-row">
              <TextField
                label="Marka (obecny pojazd)"
                value={currentMake}
                onChange={(event) => setCurrentMake(event.target.value)}
                placeholder="np. Toyota"
              />
              <TextField
                label="Model (obecny pojazd)"
                value={currentModel}
                onChange={(event) => setCurrentModel(event.target.value)}
                placeholder="np. Corolla"
              />
            </div>
            <div className="app-lf-row">
              <TextField
                label="Rok produkcji (obecny pojazd)"
                value={currentYear}
                type="number"
                min="1900"
                max={new Date().getFullYear() + 1}
                onChange={(event) => setCurrentYear(event.target.value)}
              />
              <TextField
                label="Przebieg [km] (obecny pojazd)"
                value={currentMileage}
                type="number"
                min="0"
                step="1"
                onChange={(event) => setCurrentMileage(event.target.value)}
              />
              <TextField
                label="Nr VIN pojazdu"
                value={currentVin}
                onChange={handleVinChange}
                placeholder="17 znaków alfanumerycznych"
                maxLength={17}
                error={errors.vin}
              />
            </div>

            <div className="app-lf-desired">
              <div className="app-lf-desired__head">
                <h4 className="app-section-title">Poszukiwane pojazdy</h4>
                <Button type="button" variant="secondary" size="sm" icon="plus" onClick={addDesiredVehicle}>
                  Dodaj pojazd
                </Button>
              </div>

              {desiredVehicles.length > 1 && (
                <div className="app-panel app-lf-added">
                  <h5 className="app-lf-added__title">Dodane pojazdy:</h5>
                  <ul className="app-lf-added__list">
                    {desiredVehicles.slice(0, -1).map((v, i) => (
                      <li key={i}>
                        <strong>{v.make || "Dowolna"} {v.model || ""}</strong>
                        {(v.yearFrom || v.yearTo) && ` • Rocznik: ${v.yearFrom || "od"} - ${v.yearTo || "do"}`}
                        {(v.budgetFrom || v.budgetTo) && ` • Budżet: ${v.budgetFrom || "0"} - ${v.budgetTo || ""} PLN`}
                        {v.comment && ` • Uwagi: ${v.comment}`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <datalist id="year-options">
                {Array.from({ length: 17 }, (_, i) => 2010 + i).map(year => (
                  <option key={year} value={year} />
                ))}
              </datalist>

              {desiredVehicles.map((vehicle, index) => (
                <div
                  key={index}
                  className={
                    index === desiredVehicles.length - 1
                      ? "app-panel app-lf-vehicle"
                      : "app-panel app-lf-vehicle app-lf-vehicle--hidden"
                  }
                >
                  <div className="app-lf-row">
                    <TextField
                      label="Marka"
                      value={vehicle.make}
                      onChange={(e) => handleDesiredVehicleChange(index, "make", e.target.value)}
                      placeholder="np. Skoda"
                    />
                    <TextField
                      label="Model"
                      value={vehicle.model}
                      onChange={(e) => handleDesiredVehicleChange(index, "model", e.target.value)}
                      placeholder="np. Octavia"
                    />
                  </div>
                  <div className="app-lf-row">
                    <TextField
                      label="Rok od"
                      className="app-lf-field--sm"
                      value={vehicle.yearFrom}
                      type="number"
                      min="1900"
                      max={new Date().getFullYear() + 1}
                      list="year-options"
                      onChange={(e) => handleDesiredVehicleChange(index, "yearFrom", e.target.value)}
                    />
                    <TextField
                      label="Rok do"
                      className="app-lf-field--sm"
                      value={vehicle.yearTo}
                      type="number"
                      min="1900"
                      max={new Date().getFullYear() + 1}
                      list="year-options"
                      onChange={(e) => handleDesiredVehicleChange(index, "yearTo", e.target.value)}
                    />
                    <TextField
                      label="Budżet od (PLN)"
                      className="app-lf-field--md"
                      value={vehicle.budgetFrom}
                      type="number"
                      min="0"
                      step="0.01"
                      onChange={(e) => handleDesiredVehicleChange(index, "budgetFrom", e.target.value)}
                    />
                    <TextField
                      label="Budżet do (PLN)"
                      className="app-lf-field--md"
                      value={vehicle.budgetTo}
                      type="number"
                      min="0"
                      step="0.01"
                      onChange={(e) => handleDesiredVehicleChange(index, "budgetTo", e.target.value)}
                    />
                  </div>
                  <div className="app-lf-row">
                    <TextField
                      label="Uwagi"
                      value={vehicle.comment}
                      onChange={(e) => handleDesiredVehicleChange(index, "comment", e.target.value)}
                      placeholder="np. rodzinne kombi"
                    />
                  </div>
                  {desiredVehicles.length > 1 && (
                    <div className="app-form-actions">
                      <Button type="button" variant="danger" size="sm" onClick={() => removeDesiredVehicle(index)}>
                        Usuń {vehicle.make || vehicle.model ? `${vehicle.make} ${vehicle.model}` : "ten pojazd"}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
              {errors.desiredBudget && <div className="app-alert app-alert--danger">{errors.desiredBudget}</div>}
            </div>
          </div>
        )}
      </fieldset>
      <fieldset className="app-lf-fieldset">
        <legend className="app-lf-legend">Zgody</legend>
        {consentsLoading ? (
          <p className="app-muted">Ładowanie zgód...</p>
        ) : (
          consentTemplates.map(consent => (
            <div key={consent.id} className="app-lf-consent">
              <div className="app-lf-consent__head">
                <Checkbox
                  checked={consentState[consent.id] || false}
                  onChange={e => handleConsentChange(consent.id, e.target.checked)}
                  label={<>{consent.title} {consent.isRequired && "*"}</>}
                />
                <Button type="button" variant="ghost" size="sm" onClick={() => toggleConsentOpen(consent.id)}>
                  {consentOpen[consent.id] ? "Ukryj treść" : "Pokaż treść"}
                </Button>
              </div>
              {consentOpen[consent.id] ? (
                <div className="app-lf-consent__content">{consent.content || "Brak treści zgody."}</div>
              ) : null}
            </div>
          ))
        )}
        {errors.consents && <div className="app-alert app-alert--danger">{errors.consents}</div>}
      </fieldset>

      {errors.form ? <div className="app-alert app-alert--danger">{errors.form}</div> : null}
      <div className="app-form-actions app-form-actions--start">
        <Button type="submit" variant="primary" disabled={loading || consentsLoading}>
          {loading ? "Tworzenie..." : "Utwórz lead"}
        </Button>
      </div>
    </form>
  );
};
