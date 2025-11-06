import React, { useEffect, useMemo, useState } from "react";

import { Modal } from "./Modal";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
];

interface LeadNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: { content: string; attachments: File[] }) => Promise<void>;
}

interface AttachmentError {
  name: string;
  message: string;
}

export const LeadNoteModal: React.FC<LeadNoteModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [content, setContent] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [attachmentErrors, setAttachmentErrors] = useState<AttachmentError[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setContent("");
      setAttachments([]);
      setAttachmentErrors([]);
      setIsSubmitting(false);
      setFormError(null);
    }
  }, [isOpen]);

  const attachmentSummaries = useMemo(
    () =>
      attachments.map((file) => ({
        name: file.name,
        size: file.size,
        type: file.type,
      })),
    [attachments],
  );

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const validateFile = (file: File): AttachmentError | null => {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return {
        name: file.name,
        message: `File exceeds ${(MAX_FILE_SIZE_BYTES / (1024 * 1024)).toFixed(0)} MB limit`,
      };
    }

    if (ALLOWED_TYPES.length && !ALLOWED_TYPES.includes(file.type)) {
      return {
        name: file.name,
        message: "Unsupported file type",
      };
    }

    return null;
  };

  const handleFilesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = Array.from(event.target.files ?? []);
    if (!fileList.length) {
      setAttachmentErrors([]);
      return;
    }

    const nextErrors: AttachmentError[] = [];
    const validFiles: File[] = [];

    for (const file of fileList) {
      const error = validateFile(file);
      if (error) {
        nextErrors.push(error);
      } else {
        validFiles.push(file);
      }
    }

    setAttachmentErrors(nextErrors);
    if (validFiles.length) {
      setAttachments((prev) => [...prev, ...validFiles]);
    }
  };

  const handleRemoveAttachment = (name: string) => {
    setAttachments((prev) => prev.filter((file) => file.name !== name));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedContent = content.trim();

    if (!trimmedContent) {
      setFormError("Treść notatki jest wymagana");
      return;
    }

    if (attachmentErrors.length) {
      setFormError("Usuń nieprawidłowe załączniki przed zapisaniem");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      await onSubmit({ content: trimmedContent, attachments });
      onClose();
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Nie udało się zapisać notatki",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Dodaj notatkę" width="min(640px, 92%)">
      <form onSubmit={handleSubmit} style={styles.form}>
        <label style={styles.label}>
          Treść notatki
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            style={styles.textarea}
            rows={6}
            required
          />
        </label>

        <label style={styles.label}>
          Załączniki (opcjonalnie)
          <input
            type="file"
            multiple
            onChange={handleFilesChange}
            style={styles.fileInput}
            accept={ALLOWED_TYPES.join(",")}
          />
        </label>

        {attachmentSummaries.length ? (
          <div style={styles.attachmentsBox}>
            {attachmentSummaries.map((file) => (
              <div key={file.name} style={styles.attachmentRow}>
                <div>
                  <div style={styles.attachmentName}>{file.name}</div>
                  <div style={styles.attachmentMeta}>
                    {file.type || "Nieznany typ"} · {formatBytes(file.size)}
                  </div>
                </div>
                <button
                  type="button"
                  style={styles.removeButton}
                  onClick={() => handleRemoveAttachment(file.name)}
                >
                  Usuń
                </button>
              </div>
            ))}
          </div>
        ) : null}

        {attachmentErrors.length ? (
          <div style={styles.errorBox}>
            <strong>Niektóre pliki pominięto:</strong>
            <ul style={styles.errorList}>
              {attachmentErrors.map((error) => (
                <li key={`${error.name}-${error.message}`}>{`${error.name}: ${error.message}`}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {formError ? <div style={styles.formError}>{formError}</div> : null}

        <div style={styles.actions}>
          <button type="button" onClick={onClose} style={styles.secondaryButton} disabled={isSubmitting}>
            Anuluj
          </button>
          <button type="submit" style={styles.primaryButton} disabled={isSubmitting}>
            {isSubmitting ? "Zapisywanie..." : "Zapisz notatkę"}
          </button>
        </div>
      </form>
    </Modal>
  );
};

const styles: Record<string, React.CSSProperties> = {
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "1.25rem",
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
    fontWeight: 600,
    color: "#0f172a",
  },
  textarea: {
    minHeight: 160,
    borderRadius: 12,
    padding: "0.75rem 1rem",
    border: "1px solid #cbd5f5",
    fontFamily: "inherit",
    fontSize: "1rem",
    resize: "vertical",
  },
  fileInput: {
    padding: "0.5rem 0",
  },
  attachmentsBox: {
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: "0.75rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
    background: "#f8fafc",
  },
  attachmentRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "1rem",
  },
  attachmentName: {
    fontWeight: 600,
  },
  attachmentMeta: {
    fontSize: "0.85rem",
    color: "#475569",
  },
  removeButton: {
    border: "none",
    background: "#fee2e2",
    color: "#b91c1c",
    padding: "0.35rem 0.75rem",
    borderRadius: 999,
    cursor: "pointer",
    fontWeight: 600,
  },
  errorBox: {
    borderRadius: 12,
    border: "1px solid #fecaca",
    background: "#fef2f2",
    padding: "0.75rem 1rem",
    color: "#991b1b",
  },
  errorList: {
    margin: "0.5rem 0 0",
    paddingLeft: "1.25rem",
  },
  formError: {
    borderRadius: 12,
    border: "1px solid #f87171",
    background: "#fee2e2",
    padding: "0.75rem 1rem",
    color: "#991b1b",
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "0.75rem",
  },
  secondaryButton: {
    border: "1px solid #cbd5f5",
    background: "transparent",
    color: "#1d4ed8",
    padding: "0.65rem 1.2rem",
    borderRadius: 12,
    fontWeight: 600,
    cursor: "pointer",
  },
  primaryButton: {
    border: "none",
    background: "#2563eb",
    color: "#ffffff",
    padding: "0.65rem 1.35rem",
    borderRadius: 12,
    fontWeight: 600,
    cursor: "pointer",
  },
};
