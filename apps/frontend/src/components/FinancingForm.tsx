import React, { useEffect, useState } from "react";

import { FinancingApplication, FinancingPayload } from "../api/leads";
import { ApiError } from "../api/client";

interface FinancingFormProps {
  application?: FinancingApplication | null;
  onSave: (payload: FinancingPayload) => Promise<void>;
}

const parseNumberOrUndefined = (value: string) => {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
};

export const FinancingForm: React.FC<FinancingFormProps> = ({ application, onSave }) => {
  const [bank, setBank] = useState(application?.bank ?? "");
  const [loanAmount, setLoanAmount] = useState(application?.loanAmount ?? "");
  const [downPayment, setDownPayment] = useState(application?.downPayment ?? "");
  const [termMonths, setTermMonths] = useState(
    application?.termMonths ? String(application.termMonths) : "",
  );
  const [income, setIncome] = useState(application?.income ?? "");
  const [expenses, setExpenses] = useState(application?.expenses ?? "");
  const [decision, setDecision] = useState(application?.decision ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setBank(application?.bank ?? "");
    setLoanAmount(application?.loanAmount ?? "");
    setDownPayment(application?.downPayment ?? "");
    setTermMonths(application?.termMonths ? String(application.termMonths) : "");
    setIncome(application?.income ?? "");
    setExpenses(application?.expenses ?? "");
    setDecision(application?.decision ?? "");
    setSuccess(null);
    setError(null);
  }, [application]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await onSave({
        applicationId: application?.id,
        bank,
        loanAmount: parseNumberOrUndefined(loanAmount),
        downPayment: parseNumberOrUndefined(downPayment),
        termMonths: parseNumberOrUndefined(termMonths),
        income: parseNumberOrUndefined(income),
        expenses: parseNumberOrUndefined(expenses),
        decision: decision || undefined,
      });
      setSuccess("Financing details saved");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save financing info");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <h3 style={styles.title}>Financing Application</h3>
      <div style={styles.grid}>
        <label style={styles.label}>
          Bank
          <input
            style={styles.input}
            value={bank}
            onChange={(event) => setBank(event.target.value)}
            required
          />
        </label>
        <label style={styles.label}>
          Loan amount
          <input
            style={styles.input}
            value={loanAmount}
            onChange={(event) => setLoanAmount(event.target.value)}
            placeholder="120000"
          />
        </label>
        <label style={styles.label}>
          Down payment
          <input
            style={styles.input}
            value={downPayment}
            onChange={(event) => setDownPayment(event.target.value)}
          />
        </label>
        <label style={styles.label}>
          Term (months)
          <input
            style={styles.input}
            value={termMonths}
            onChange={(event) => setTermMonths(event.target.value)}
            placeholder="48"
          />
        </label>
        <label style={styles.label}>
          Income
          <input
            style={styles.input}
            value={income}
            onChange={(event) => setIncome(event.target.value)}
            placeholder="7500"
          />
        </label>
        <label style={styles.label}>
          Expenses
          <input
            style={styles.input}
            value={expenses}
            onChange={(event) => setExpenses(event.target.value)}
            placeholder="3200"
          />
        </label>
      </div>
      <label style={styles.label}>
        Decision
        <input
          style={styles.input}
          value={decision}
          onChange={(event) => setDecision(event.target.value)}
          placeholder="approved / rejected / pending"
        />
      </label>
      {error ? <div style={styles.error}>{error}</div> : null}
      {success ? <div style={styles.success}>{success}</div> : null}
      <button type="submit" style={styles.submit} disabled={isSubmitting}>
        {isSubmitting ? "Saving..." : "Save Financing"}
      </button>
    </form>
  );
};

const styles: Record<string, React.CSSProperties> = {
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "0.85rem",
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    padding: "1rem",
  },
  title: {
    margin: 0,
    fontSize: "1rem",
    fontWeight: 600,
  },
  grid: {
    display: "grid",
    gap: "0.75rem",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: "0.35rem",
    fontSize: "0.9rem",
  },
  input: {
    padding: "0.5rem 0.75rem",
    borderRadius: 8,
    border: "1px solid #d1d5db",
  },
  submit: {
    alignSelf: "flex-start",
    padding: "0.5rem 1rem",
    borderRadius: 8,
    border: "none",
    background: "#2563eb",
    color: "#fff",
    cursor: "pointer",
  },
  error: {
    background: "#fee2e2",
    color: "#b91c1c",
    padding: "0.5rem",
    borderRadius: 8,
  },
  success: {
    background: "#ecfdf5",
    color: "#047857",
    padding: "0.5rem",
    borderRadius: 8,
  },
};
