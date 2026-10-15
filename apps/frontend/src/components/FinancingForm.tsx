import React, { useEffect, useState } from "react";

import { FinancingApplication, FinancingPayload } from "../api/leads";
import { ApiError } from "../api/client";
import { Button, TextField } from "./ui";

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
    <form onSubmit={handleSubmit} className="app-form app-panel">
      <h3 className="app-section-title">Financing application</h3>
      <div className="app-lf-grid">
        <TextField
          label="Bank"
          value={bank}
          onChange={(event) => setBank(event.target.value)}
          required
        />
        <TextField
          label="Loan amount"
          value={loanAmount}
          onChange={(event) => setLoanAmount(event.target.value)}
          placeholder="120000"
        />
        <TextField
          label="Down payment"
          value={downPayment}
          onChange={(event) => setDownPayment(event.target.value)}
        />
        <TextField
          label="Term (months)"
          value={termMonths}
          onChange={(event) => setTermMonths(event.target.value)}
          placeholder="48"
        />
        <TextField
          label="Income"
          value={income}
          onChange={(event) => setIncome(event.target.value)}
          placeholder="7500"
        />
        <TextField
          label="Expenses"
          value={expenses}
          onChange={(event) => setExpenses(event.target.value)}
          placeholder="3200"
        />
      </div>
      <TextField
        label="Decision"
        value={decision}
        onChange={(event) => setDecision(event.target.value)}
        placeholder="approved / rejected / pending"
      />
      {error ? <div className="app-alert app-alert--danger">{error}</div> : null}
      {success ? <div className="app-alert app-alert--success">{success}</div> : null}
      <div className="app-form-actions app-form-actions--start">
        <Button type="submit" variant="secondary" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save financing"}
        </Button>
      </div>
    </form>
  );
};
