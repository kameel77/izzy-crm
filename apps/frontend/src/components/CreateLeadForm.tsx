import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../hooks/useAuth";
import { ConsentTemplateDto, fetchAuthenticatedConsentTemplates } from "../api/consents";
import { fetchPartners, PartnerSummary } from "../api/partners";

interface CreateLeadFormProps {
  onCreate: (payload: {
    partnerId?: string;
    customer: { firstName: string; lastName: string; email?: string; phone?: string };
    currentVehicle?: {
      make?: string;
      model?: string;
      year?: number;
      mileage?: number;
    };
    desiredVehicle?: { make?: string; model?: string; year?: number; budget?: number };
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
  const [downPayment, setDownPayment] = useState("");
  const [currentMake, setCurrentMake] = useState("");
  const [currentModel, setCurrentModel] = useState("");
  const [currentYear, setCurrentYear] = useState("");
  const [currentMileage, setCurrentMileage] = useState("");
  const [desiredMake, setDesiredMake] = useState("");
  const [desiredModel, setDesiredModel] = useState("");
  const [desiredYear, setDesiredYear] = useState("");
  const [desiredNotes, setDesiredNotes] = useState("");
  const [desiredBudget, setDesiredBudget] = useState("");
  const [partnerId, setPartnerId] = useState(defaultPartnerId ?? "");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [consentTemplates, setConsentTemplates] = useState<ConsentTemplateDto[]>([]);
  const [consentState, setConsentState] = useState<Record<string, boolean>>({});
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
        const initialState: Record<string, boolean> = {};
        templates.forEach(t => {
          if (t.isRequired) {
            initialState[t.id] = true;
          }
        });
        setConsentState(initialState);
      } catch (error) {
        setErrors(prev => ({ ...prev, consents: "Failed to load consent templates." }));
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
          setPartnersError("Failed to load partners.");
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

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (email && !emailRegex.test(email)) {
      newErrors.email = "Invalid email format (e.g., user@example.com).";
    }
    if (phone && !phoneRegex.test(phone.replace(/[\s-]+/g, ""))) {
      newErrors.phone = "Invalid phone number format (e.g., +48 123 456 789).";
    }
    const allRequiredConsentsGiven = consentTemplates
      .filter(t => t.isRequired)
      .every(t => consentState[t.id]);
    if (!allRequiredConsentsGiven) {
      newErrors.consents = "All required consents must be accepted.";
    }
    const parsedDownPayment = Number(downPayment);
    if (!Number.isFinite(parsedDownPayment) || parsedDownPayment < 0) {
      newErrors.downPayment = "Amount available must be zero or a positive number.";
    }
    if (desiredBudget) {
      const parsedBudget = Number(desiredBudget);
      if (!Number.isFinite(parsedBudget) || parsedBudget < 0) {
        newErrors.desiredBudget = "Budget must be zero or a positive number.";
      }
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
      const parsedBudget = desiredBudget === "" ? undefined : Number(desiredBudget);
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
        },
        financing: {
          downPayment: Number(downPayment),
        },
        consents: consentTemplates.map(t => ({
          templateId: t.id,
          version: t.version,
          given: consentState[t.id] || false,
        })),
      };

      if (currentMake || currentModel || currentYear || currentMileage) {
        payload.currentVehicle = {
          make: currentMake || undefined,
          model: currentModel || undefined,
          year: currentYear ? Number(currentYear) : undefined,
          mileage: currentMileage ? Number(currentMileage) : undefined,
        };
      }

      if (desiredMake || desiredModel || desiredYear || desiredNotes || parsedBudget !== undefined) {
        payload.desiredVehicle = {
          make: desiredMake || undefined,
          model: desiredModel || undefined,
          year: desiredYear ? Number(desiredYear) : undefined,
          budget: parsedBudget,
          preferences: desiredNotes ? { notes: desiredNotes } : undefined,
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
      setDesiredMake("");
      setDesiredModel("");
      setDesiredYear("");
      setDesiredNotes("");
      setDesiredBudget("");
      setCustomerType("");
      setCity("");
      setVoivodeship("");
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : "Failed to create lead" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <h3 style={styles.title}>Quick Lead Capture</h3>
      <div style={styles.row}>
        <label style={styles.label}>
          First name
          <input
            style={styles.input}
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            required
          />
        </label>
        <label style={styles.label}>
          Last name
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
                <option value="">Select partner</option>
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
              placeholder="Partner name"
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
          Phone
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
          Amount Available (PLN)
          <input
            style={styles.input}
            value={downPayment}
            type="number"
            min="0"
            step="0.01"
            onChange={(event) => setDownPayment(event.target.value)}
            required
          />
          {errors.downPayment && <span style={styles.fieldError}>{errors.downPayment}</span>}
        </label>
      </div>
      <div style={styles.row}>
        <label style={styles.label}>
          Current Vehicle Make
          <input
            style={styles.input}
            value={currentMake}
            onChange={(event) => setCurrentMake(event.target.value)}
            placeholder="e.g. Toyota"
          />
        </label>
        <label style={styles.label}>
          Current Vehicle Model
          <input
            style={styles.input}
            value={currentModel}
            onChange={(event) => setCurrentModel(event.target.value)}
            placeholder="e.g. Corolla"
          />
        </label>
      </div>
      <div style={styles.row}>
        <label style={styles.label}>
          Current Vehicle Year
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
          Current Vehicle Mileage (km)
          <input
            style={styles.input}
            value={currentMileage}
            type="number"
            min="0"
            step="1"
            onChange={(event) => setCurrentMileage(event.target.value)}
          />
        </label>
      </div>
      <div style={styles.row}>
        <label style={styles.label}>
          Desired Vehicle Make
          <input
            style={styles.input}
            value={desiredMake}
            onChange={(event) => setDesiredMake(event.target.value)}
            placeholder="e.g. Skoda"
          />
        </label>
        <label style={styles.label}>
          Desired Vehicle Model
          <input
            style={styles.input}
            value={desiredModel}
            onChange={(event) => setDesiredModel(event.target.value)}
            placeholder="e.g. Octavia"
          />
        </label>
      </div>
      <div style={styles.row}>
        <label style={styles.label}>
          Desired Vehicle Year
          <input
            style={styles.input}
            value={desiredYear}
            type="number"
            min="1900"
            max={new Date().getFullYear() + 1}
            onChange={(event) => setDesiredYear(event.target.value)}
          />
        </label>
        <label style={styles.label}>
          Desired Vehicle Notes
          <input
            style={styles.input}
            value={desiredNotes}
            onChange={(event) => setDesiredNotes(event.target.value)}
            placeholder="np. rodzinne kombi"
          />
        </label>
        <label style={styles.label}>
          Budżet (PLN)
          <input
            style={styles.input}
            value={desiredBudget}
            type="number"
            min="0"
            step="0.01"
            onChange={(event) => setDesiredBudget(event.target.value)}
            onBlur={validate}
          />
          {errors.desiredBudget && <span style={styles.fieldError}>{errors.desiredBudget}</span>}
        </label>
      </div>
      <fieldset style={styles.fieldset}>
        <legend style={styles.legend}>Consents</legend>
        {consentsLoading ? (
          <p>Loading consents...</p>
        ) : (
          consentTemplates.map(consent => (
            <div key={consent.id}>
              <label>
                <input
                  type="checkbox"
                  checked={consentState[consent.id] || false}
                  onChange={e => handleConsentChange(consent.id, e.target.checked)}
                />
                {consent.title} {consent.isRequired && "*"}
              </label>
            </div>
          ))
        )}
        {errors.consents && <div style={styles.error}>{errors.consents}</div>}
      </fieldset>

      {errors.form ? <div style={styles.error}>{errors.form}</div> : null}
      <button type="submit" style={styles.submit} disabled={loading || consentsLoading}>
        {loading ? "Creating..." : "Create Lead"}
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
    border: "1px solid #d1d5db",
    borderRadius: 8,
    padding: "1rem",
  },
  legend: {
    fontWeight: "bold",
    padding: "0 0.5rem",
  },
};
