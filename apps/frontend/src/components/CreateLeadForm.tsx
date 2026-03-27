import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../hooks/useAuth";
import { ConsentTemplateDto, fetchAuthenticatedConsentTemplates } from "../api/consents";
import { fetchPartners, PartnerSummary } from "../api/partners";

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
    <form onSubmit={handleSubmit} style={styles.form}>
      <fieldset style={{ ...styles.fieldset, paddingBottom: "1.5rem" }}>
        <legend style={styles.legend}>Wprowadź dane klienta</legend>
        <div style={styles.row}>
          <label style={styles.label}>
            Imię
            <input
              style={styles.input}
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              required
            />
          </label>
          <label style={styles.label}>
            Nazwisko
            <input
              style={styles.input}
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              required
            />
          </label>
          <label style={styles.label}>
            Partner
            {user?.role === "ADMIN" ? (
              <>
                <select
                  style={styles.input}
                  value={partnerId}
                  onChange={(event) => setPartnerId(event.target.value)}
                  disabled={partnersLoading}
                >
                  <option value="">Wybierz partnera</option>
                  {partners.map((partner) => (
                    <option key={partner.id} value={partner.id}>
                      {partner.name}
                    </option>
                  ))}
                </select>
                {partnersError ? <span style={styles.fieldError}>{partnersError}</span> : null}
              </>
            ) : (
              <input
                style={{ ...styles.input, background: "#f3f4f6" }}
                value={resolvedPartnerName}
                readOnly
                placeholder="Nazwa partnera"
              />
            )}
          </label>
        </div>
        <div style={styles.row}>
          <label style={styles.label}>
            Email
            <input
              style={styles.input}
              value={email}
              type="email"
              onChange={(event) => setEmail(event.target.value)}
              onBlur={validate}
            />
            {errors.email && <span style={styles.fieldError}>{errors.email}</span>}
          </label>
          <label style={styles.label}>
            Telefon
            <input
              style={styles.input}
              value={phone}
              type="tel"
              onChange={(event) => setPhone(event.target.value)}
              onBlur={validate}
            />
            {errors.phone && <span style={styles.fieldError}>{errors.phone}</span>}
          </label>
          <label style={styles.label}>
            Rodzaj klienta
            <select
              style={styles.input}
              value={customerType}
              onChange={(event) => setCustomerType(event.target.value)}
            >
              <option value="">Wybierz</option>
              {customerTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div style={styles.row}>
          <label style={styles.label}>
            Miasto
            <input
              style={styles.input}
              value={city}
              onChange={(event) => setCity(event.target.value)}
              placeholder="np. Warszawa"
            />
          </label>
          <label style={styles.label}>
            Kod pocztowy
            <input
              style={styles.input}
              value={postalCode}
              onChange={handlePostalCodeChange}
              placeholder="np. 00-000"
              maxLength={6}
            />
            {errors.postalCode && <span style={styles.fieldError}>{errors.postalCode}</span>}
          </label>
          <label style={styles.label}>
            Województwo
            <select
              style={styles.input}
              value={voivodeship}
              onChange={(event) => setVoivodeship(event.target.value)}
            >
              <option value="">Wybierz</option>
              {voivodeships.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label style={styles.label}>
            Dostępna kwota (PLN)
            <input
              style={styles.input}
              value={downPayment}
              type="number"
              min="0"
              step="0.01"
              onChange={(event) => setDownPayment(event.target.value)}
            />
            {errors.downPayment && <span style={styles.fieldError}>{errors.downPayment}</span>}
          </label>
        </div>
      </fieldset>

      <fieldset style={styles.fieldset}>
        <legend
          style={{ ...styles.legend, cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5rem" }}
          onClick={() => setIsVehicleDataExpanded(!isVehicleDataExpanded)}
        >
          Informacje o pojeździe
          <span style={{ fontSize: "0.8em" }}>{isVehicleDataExpanded ? "▼" : "▶"}</span>
        </legend>

        {isVehicleDataExpanded && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "1rem", marginBottom: "0.5rem" }}>
            <div style={styles.row}>
              <label style={styles.label}>
                Marka (obecny pojazd)
                <input
                  style={styles.input}
                  value={currentMake}
                  onChange={(event) => setCurrentMake(event.target.value)}
                  placeholder="np. Toyota"
                />
              </label>
              <label style={styles.label}>
                Model (obecny pojazd)
                <input
                  style={styles.input}
                  value={currentModel}
                  onChange={(event) => setCurrentModel(event.target.value)}
                  placeholder="np. Corolla"
                />
              </label>
            </div>
            <div style={styles.row}>
              <label style={styles.label}>
                Rok produkcji (obecny pojazd)
                <input
                  style={styles.input}
                  value={currentYear}
                  type="number"
                  min="1900"
                  max={new Date().getFullYear() + 1}
                  onChange={(event) => setCurrentYear(event.target.value)}
                />
              </label>
              <label style={styles.label}>
                Przebieg [km] (obecny pojazd)
                <input
                  style={styles.input}
                  value={currentMileage}
                  type="number"
                  min="0"
                  step="1"
                  onChange={(event) => setCurrentMileage(event.target.value)}
                />
              </label>
              <label style={styles.label}>
                Nr VIN pojazdu
                <input
                  style={styles.input}
                  value={currentVin}
                  onChange={handleVinChange}
                  placeholder="17 znaków alfanumerycznych"
                  maxLength={17}
                />
                {errors.vin && <span style={styles.fieldError}>{errors.vin}</span>}
              </label>
            </div>

            <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px dashed #e5e7eb" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <h4 style={{ margin: 0, fontSize: "1rem", color: "#374151" }}>Poszukiwane pojazdy</h4>
                <button
                  type="button"
                  onClick={addDesiredVehicle}
                  style={{ padding: "0.4rem 0.8rem", borderRadius: 6, background: "#f3f4f6", border: "1px solid #d1d5db", cursor: "pointer", fontSize: "0.85rem" }}
                >
                  + Dodaj pojazd
                </button>
              </div>

              {desiredVehicles.length > 1 && (
                <div style={{ marginBottom: "1.5rem", padding: "1rem", background: "#f3f4f6", borderRadius: 8 }}>
                  <h5 style={{ margin: "0 0 0.5rem 0", fontSize: "0.9rem", color: "#4b5563" }}>Dodane pojazdy:</h5>
                  <ul style={{ margin: 0, paddingLeft: "1.5rem", fontSize: "0.85rem", color: "#374151" }}>
                    {desiredVehicles.slice(0, -1).map((v, i) => (
                      <li key={i} style={{ marginBottom: "0.25rem" }}>
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
                <div key={index} style={{ background: "#f9fafb", padding: "1rem", borderRadius: 8, marginBottom: "1rem", border: "1px solid #e5e7eb", position: "relative", display: index === desiredVehicles.length - 1 ? "block" : "none" }}>
                  <div style={{ ...styles.row, marginBottom: "1rem" }}>
                    <label style={styles.label}>
                      Marka
                      <input
                        style={styles.input}
                        value={vehicle.make}
                        onChange={(e) => handleDesiredVehicleChange(index, "make", e.target.value)}
                        placeholder="np. Skoda"
                      />
                    </label>
                    <label style={styles.label}>
                      Model
                      <input
                        style={styles.input}
                        value={vehicle.model}
                        onChange={(e) => handleDesiredVehicleChange(index, "model", e.target.value)}
                        placeholder="np. Octavia"
                      />
                    </label>
                  </div>
                  <div style={{ ...styles.row, marginBottom: "1rem" }}>
                    <label style={{ ...styles.label, minWidth: 100 }}>
                      Rok od
                      <input
                        style={styles.input}
                        value={vehicle.yearFrom}
                        type="number"
                        min="1900"
                        max={new Date().getFullYear() + 1}
                        list="year-options"
                        onChange={(e) => handleDesiredVehicleChange(index, "yearFrom", e.target.value)}
                      />
                    </label>
                    <label style={{ ...styles.label, minWidth: 100 }}>
                      Rok do
                      <input
                        style={styles.input}
                        value={vehicle.yearTo}
                        type="number"
                        min="1900"
                        max={new Date().getFullYear() + 1}
                        list="year-options"
                        onChange={(e) => handleDesiredVehicleChange(index, "yearTo", e.target.value)}
                      />
                    </label>
                    <label style={{ ...styles.label, minWidth: 120 }}>
                      Budżet od (PLN)
                      <input
                        style={styles.input}
                        value={vehicle.budgetFrom}
                        type="number"
                        min="0"
                        step="0.01"
                        onChange={(e) => handleDesiredVehicleChange(index, "budgetFrom", e.target.value)}
                      />
                    </label>
                    <label style={{ ...styles.label, minWidth: 120 }}>
                      Budżet do (PLN)
                      <input
                        style={styles.input}
                        value={vehicle.budgetTo}
                        type="number"
                        min="0"
                        step="0.01"
                        onChange={(e) => handleDesiredVehicleChange(index, "budgetTo", e.target.value)}
                      />
                    </label>
                  </div>
                  <div style={styles.row}>
                    <label style={styles.label}>
                      Uwagi
                      <input
                        style={styles.input}
                        value={vehicle.comment}
                        onChange={(e) => handleDesiredVehicleChange(index, "comment", e.target.value)}
                        placeholder="np. rodzinne kombi"
                      />
                    </label>
                  </div>
                  {desiredVehicles.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeDesiredVehicle(index)}
                      style={{ position: "absolute", bottom: "1rem", right: "1rem", background: "#fee2e2", color: "#b91c1c", border: "none", borderRadius: 4, padding: "0.4rem 0.8rem", cursor: "pointer", fontSize: "0.85rem" }}
                    >
                      Usuń {vehicle.make || vehicle.model ? `${vehicle.make} ${vehicle.model}` : "ten pojazd"}
                    </button>
                  )}
                </div>
              ))}
              {errors.desiredBudget && <span style={styles.fieldError}>{errors.desiredBudget}</span>}
            </div>
          </div>
        )}
      </fieldset>
      <fieldset style={styles.fieldset}>
        <legend style={styles.legend}>Zgody</legend>
        {consentsLoading ? (
          <p>Ładowanie zgód...</p>
        ) : (
          consentTemplates.map(consent => (
            <div key={consent.id} style={styles.consentItem}>
              <div style={styles.consentHeader}>
                <label style={styles.consentLabel}>
                  <input
                    type="checkbox"
                    checked={consentState[consent.id] || false}
                    onChange={e => handleConsentChange(consent.id, e.target.checked)}
                  />
                  {consent.title} {consent.isRequired && "*"}
                </label>
                <button
                  type="button"
                  style={styles.consentToggle}
                  onClick={() => toggleConsentOpen(consent.id)}
                >
                  {consentOpen[consent.id] ? "Ukryj treść" : "Pokaż treść"}
                </button>
              </div>
              {consentOpen[consent.id] ? (
                <div style={styles.consentContent}>{consent.content || "Brak treści zgody."}</div>
              ) : null}
            </div>
          ))
        )}
        {errors.consents && <div style={styles.error}>{errors.consents}</div>}
      </fieldset>

      {errors.form ? <div style={styles.error}>{errors.form}</div> : null}
      <button type="submit" style={styles.submit} disabled={loading || consentsLoading}>
        {loading ? "Tworzenie..." : "Utwórz lead"}
      </button>
    </form>
  );
};

const styles: Record<string, React.CSSProperties> = {
  form: {
    background: "#fff",
    borderRadius: 12,
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
    padding: "1.5rem",
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  title: {
    margin: 0,
    fontSize: "1.1rem",
  },
  row: {
    display: "flex",
    gap: "1rem",
    flexWrap: "wrap",
  },
  label: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
    minWidth: 180,
  },
  input: {
    padding: "0.5rem 0.75rem",
    borderRadius: 8,
    border: "1px solid #d1d5db",
  },
  submit: {
    alignSelf: "flex-start",
    padding: "0.6rem 1.2rem",
    borderRadius: 8,
    border: "none",
    background: "#16a34a",
    color: "#fff",
    cursor: "pointer",
  },
  error: {
    background: "#fee2e2",
    color: "#b91c1c",
    padding: "0.5rem",
    borderRadius: 8,
  },
  fieldError: {
    color: "#b91c1c",
    fontSize: "0.8rem",
  },
  fieldset: {
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    padding: "0.75rem 0.75rem 0.5rem",
  },
  legend: {
    fontWeight: 600,
    padding: "0 0.5rem",
    fontSize: "0.95rem",
  },
  consentItem: {
    borderTop: "1px solid #e5e7eb",
    padding: "0.35rem 0",
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
};
