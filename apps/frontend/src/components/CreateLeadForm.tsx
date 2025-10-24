import React, { useState } from "react";

interface CreateLeadFormProps {
  onCreate: (payload: {
    partnerId?: string;
    customer: { firstName: string; lastName: string; email?: string; phone?: string };
    desiredVehicle?: { make?: string; model?: string; year?: number; budget?: number };
  }) => Promise<void>;
  defaultPartnerId?: string | null;
}

export const CreateLeadForm: React.FC<CreateLeadFormProps> = ({
  onCreate,
  defaultPartnerId,
}) => {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [partnerId, setPartnerId] = useState(defaultPartnerId ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await onCreate({
        partnerId: partnerId || undefined,
        customer: {
          firstName,
          lastName,
          email: email || undefined,
        },
      });
      setFirstName("");
      setLastName("");
      setEmail("");
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
        {!defaultPartnerId ? (
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
      {error ? <div style={styles.error}>{error}</div> : null}
      <button type="submit" style={styles.submit} disabled={loading}>
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
};
