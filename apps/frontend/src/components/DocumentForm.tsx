import React, { useState } from "react";

import { ApiError } from "../api/client";

interface DocumentFormProps {
  onSubmit: (payload: { type: string; filePath: string; checksum?: string }) => Promise<void>;
}

export const DocumentForm: React.FC<DocumentFormProps> = ({ onSubmit }) => {
  const [type, setType] = useState("agreement");
  const [filePath, setFilePath] = useState("");
  const [checksum, setChecksum] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await onSubmit({
        type,
        filePath,
        checksum: checksum.trim() || undefined,
      });
      setFilePath("");
      setChecksum("");
      setSuccess("Document metadata saved");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save document");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <h3 style={styles.title}>Attach Document (metadata)</h3>
      <div style={styles.grid}>
        <label style={styles.label}>
          Type
          <input value={type} onChange={(event) => setType(event.target.value)} style={styles.input} />
        </label>
        <label style={styles.label}>
          File URL / Path
          <input
            value={filePath}
            onChange={(event) => setFilePath(event.target.value)}
            required
            placeholder="https://..."
            style={styles.input}
          />
        </label>
      </div>
      <label style={styles.label}>
        Checksum (optional)
        <input
          value={checksum}
          onChange={(event) => setChecksum(event.target.value)}
          style={styles.input}
        />
      </label>
      {error ? <div style={styles.error}>{error}</div> : null}
      {success ? <div style={styles.success}>{success}</div> : null}
      <button type="submit" style={styles.submit} disabled={isSubmitting}>
        {isSubmitting ? "Saving..." : "Save"}
      </button>
    </form>
  );
};

const styles: Record<string, React.CSSProperties> = {
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
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
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: "0.35rem",
  },
  input: {
    padding: "0.5rem 0.75rem",
    borderRadius: 8,
    border: "1px solid #d1d5db",
  },
  submit: {
    alignSelf: "flex-start",
    padding: "0.5rem 1rem",
    border: "none",
    borderRadius: 8,
    background: "#1d4ed8",
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
