import React, { useState, useEffect } from "react";
import { ConsentTemplateDto, fetchAuthenticatedConsentTemplates } from "../api/consents";

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
  hidePartnerField?: boolean;
}

export const CreateLeadForm: React.FC<CreateLeadFormProps> = ({
  onCreate,
  defaultPartnerId,
  hidePartnerField = false,
}) => {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [downPayment, setDownPayment] = useState("");
  const [currentMake, setCurrentMake] = useState("");
  const [currentModel, setCurrentModel] = useState("");
  const [currentYear, setCurrentYear] = useState("");
  const [currentMileage, setCurrentMileage] = useState("");
  const [desiredMake, setDesiredMake] = useState("");
  const [desiredModel, setDesiredModel] = useState("");
  const [desiredYear, setDesiredYear] = useState("");
  const [desiredNotes, setDesiredNotes] = useState("");
  const [partnerId, setPartnerId] = useState(defaultPartnerId ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [consentTemplates, setConsentTemplates] = useState<ConsentTemplateDto[]>([]);
  const [consentState, setConsentState] = useState<Record<string, boolean>>({});
  const [consentsLoading, setConsentsLoading] = useState(true);

  useEffect(() => {
    const loadConsents = async () => {
      try {
        const templates = await fetchAuthenticatedConsentTemplates({ formType: "lead_creation" });
        setConsentTemplates(templates);
        const initialState: Record<string, boolean> = {};
        templates.forEach(t => {
          if (t.isRequired) {
            initialState[t.id] = true;
          }
        });
        setConsentState(initialState);
      } catch (error) {
        setError("Failed to load consent templates.");
      } finally {
        setConsentsLoading(false);
      }
    };
    loadConsents();
  }, []);

  const handleConsentChange = (consentId: string, isChecked: boolean) => {
    setConsentState(prev => ({ ...prev, [consentId]: isChecked }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const allRequiredConsentsGiven = consentTemplates
      .filter(t => t.isRequired)
      .every(t => consentState[t.id]);

    if (!allRequiredConsentsGiven) {
      setError("All required consents must be accepted.");
      return;
    }

    const parsedDownPayment = Number(downPayment);
    if (!Number.isFinite(parsedDownPayment) || parsedDownPayment < 0) {
      setError("Amount available for down payment must be zero or a positive number.");
      return;
    }

    const parsedYear = currentYear ? Number(currentYear) : undefined;
    const parsedMileage = currentMileage ? Number(currentMileage) : undefined;
    const parsedDesiredYear = desiredYear ? Number(desiredYear) : undefined;

    if (parsedYear !== undefined && !Number.isFinite(parsedYear)) {
      setError("Vehicle year must be a valid number.");
      return;
    }

    if (parsedMileage !== undefined && !Number.isFinite(parsedMileage)) {
      setError("Vehicle mileage must be a valid number.");
      return;
    }

    if (parsedDesiredYear !== undefined && !Number.isFinite(parsedDesiredYear)) {
      setError("Desired vehicle year must be a valid number.");
      return;
    }

    setLoading(true);
    try {
      const payload: Parameters<typeof onCreate>[0] = {
        partnerId: partnerId || undefined,
        customer: {
          firstName,
          lastName,
          email: email || undefined,
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

      if (currentMake || currentModel || parsedYear !== undefined || parsedMileage !== undefined) {
        payload.currentVehicle = {
          make: currentMake || undefined,
          model: currentModel || undefined,
          year: parsedYear,
          mileage: parsedMileage,
        };
      }

      const trimmedNotes = desiredNotes.trim();

      if (
        desiredMake ||
        desiredModel ||
        parsedDesiredYear !== undefined ||
        trimmedNotes.length > 0
      ) {
        payload.desiredVehicle = {
          make: desiredMake || undefined,
          model: desiredModel || undefined,
          year: parsedDesiredYear,
        };
      }

      await onCreate({
        ...payload,
      });
      setFirstName("");
      setLastName("");
      setEmail("");
      setDownPayment("");
      setCurrentMake("");
      setCurrentModel("");
      setCurrentYear("");
      setCurrentMileage("");
      setDesiredMake("");
      setDesiredModel("");
      setDesiredYear("");
      setDesiredNotes("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create lead");
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
      </div>
      <div style={styles.row}>
        <label style={styles.label}>
          Email
          <input
            style={styles.input}
            value={email}
            type="email"
            onChange={(event) => setEmail(event.target.value)}
          />
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
        </label>
        {!hidePartnerField && !defaultPartnerId ? (
          <label style={styles.label}>
            Partner ID
            <input
              style={styles.input}
              value={partnerId}
              onChange={(event) => setPartnerId(event.target.value)}
              placeholder="seed-partner"
            />
          </label>
        ) : null}
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
      </fieldset>

      {error ? <div style={styles.error}>{error}</div> : null}
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
