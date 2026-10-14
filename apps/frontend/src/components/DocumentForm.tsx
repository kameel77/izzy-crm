import React, { useId, useRef, useState } from "react";

import { ApiError } from "../api/client";
import { Button, TextField } from "./ui";

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
  const fileLabelId = useId();

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
    <form onSubmit={handleSubmit} className="app-form app-panel">
      <h3 className="app-section-title">Załącz nowy dokument</h3>
      <div className="app-lf-grid">
        <TextField
          label="Rodzaj dokumentu"
          value={type}
          onChange={(event) => setType(event.target.value)}
        />
        <div className="iz-field">
          <span className="iz-field__label" id={fileLabelId}>
            Plik
          </span>
          <input
            ref={fileInputRef}
            type="file"
            hidden
            aria-labelledby={fileLabelId}
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            required
          />
          <div className="app-lf-file">
            <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()}>
              Wybierz plik
            </Button>
            <span className="app-muted">{file ? file.name : "Nie wybrano pliku"}</span>
          </div>
        </div>
      </div>
      {error ? <div className="app-alert app-alert--danger">{error}</div> : null}
      {success ? <div className="app-alert app-alert--success">{success}</div> : null}
      <div className="app-form-actions app-form-actions--start">
        <Button type="submit" variant="secondary" disabled={isSubmitting}>
          {isSubmitting ? "Załączanie pliku..." : "Załącz plik"}
        </Button>
      </div>
    </form>
  );
};
