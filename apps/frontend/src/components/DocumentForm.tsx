import React, { useRef, useState } from "react";

import { ApiError } from "../api/client";

interface DocumentFormProps {
  onSubmit: (payload: { type: string; file: File }) => Promise<void>;
}

export const DocumentForm: React.FC<DocumentFormProps> = ({ onSubmit }) => {
  const [type, setType] = useState("agreement");
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) {
      setError("Please select a file to upload");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await onSubmit({
        type,
        file,
      });
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setSuccess("Document uploaded");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to upload document");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <h3 style={styles.title}>Załącz nowy dokument</h3>
      <div style={styles.grid}>
        <label style={styles.label}>
          Rodzaj dokumentu
          <input value={type} onChange={(event) => setType(event.target.value)} style={styles.input} />
        </label>
        <div style={styles.label}>
          Plik
          <input
            ref={fileInputRef}
            type="file"
            style={{ display: 'none' }}
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            required
          />
          <div style={styles.fileInputContainer}>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={styles.fileButton}
            >
              Wybierz plik
            </button>
            <span style={styles.fileName}>
              {file ? file.name : "Nie wybrano pliku"}
            </span>
          </div>
        </div>
      </div>
      {error ? <div style={styles.error}>{error}</div> : null}
      {success ? <div style={styles.success}>{success}</div> : null}
      <button type="submit" style={styles.submit} disabled={isSubmitting}>
        {isSubmitting ? "Załączanie pliku..." : "Załącz plik"}
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
  fileInputContainer: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
  },
  fileButton: {
    background: "transparent",
    color: "#2563eb",
    border: "1px solid rgba(37, 99, 235, 0.3)",
    borderRadius: 8,
    padding: "0.45rem 0.9rem",
    cursor: "pointer",
    fontWeight: 500,
  },
  fileName: {
    fontSize: "0.875rem",
    color: "#64748b",
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
