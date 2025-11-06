import React, { useEffect, useState } from "react";

import { LeadNoteTag } from "../api/leadNotes";
import { Modal } from "./Modal";

interface LeadNoteModalProps {
  isOpen: boolean;
  title: string;
  isSaving: boolean;
  onClose: () => void;
  onSave: (payload: { content: string; tagIds: string[] }) => Promise<void> | void;
  defaultContent?: string;
  defaultTagIds?: string[];
  availableTags: LeadNoteTag[];
}

export const LeadNoteModal: React.FC<LeadNoteModalProps> = ({
  isOpen,
  title,
  isSaving,
  onClose,
  onSave,
  defaultContent = "",
  defaultTagIds = [],
  availableTags,
}) => {
  const [content, setContent] = useState(defaultContent);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(defaultTagIds);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setContent(defaultContent);
    setSelectedTagIds(defaultTagIds);
    setError(null);
  }, [isOpen, defaultContent, defaultTagIds]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) {
      setError("Treść notatki jest wymagana");
      return;
    }
    setError(null);
    await Promise.resolve(onSave({ content: trimmed, tagIds: selectedTagIds }));
  };

  const handleTagChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const options = Array.from(event.target.selectedOptions);
    setSelectedTagIds(options.map((option) => option.value));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} width="min(520px, 96%)">
      <form onSubmit={handleSubmit} style={styles.form}>
        <label style={styles.label}>
          Treść notatki
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            style={styles.textarea}
            rows={6}
            disabled={isSaving}
            placeholder="Dodaj szczegóły rozmowy lub kolejne kroki..."
          />
        </label>
        <label style={styles.label}>
          Tagi
          <select
            multiple
            value={selectedTagIds}
            onChange={handleTagChange}
            style={styles.select}
            disabled={isSaving || availableTags.length === 0}
          >
            {availableTags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </select>
          <span style={styles.hint}>Przytrzymaj Ctrl (Windows) lub Command (macOS), aby zaznaczyć wiele pozycji.</span>
        </label>
        {error ? <div style={styles.error}>{error}</div> : null}
        <div style={styles.actions}>
          <button type="button" onClick={onClose} style={styles.cancelButton} disabled={isSaving}>
            Anuluj
          </button>
          <button type="submit" style={styles.saveButton} disabled={isSaving}>
            {isSaving ? "Zapisywanie..." : "Zapisz"}
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
    gap: "1rem",
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
    fontWeight: 600,
    color: "#1e293b",
  },
  textarea: {
    borderRadius: 12,
    border: "1px solid #cbd5f5",
    padding: "0.75rem",
    fontFamily: "inherit",
    minHeight: "6rem",
    resize: "vertical",
  },
  select: {
    borderRadius: 12,
    border: "1px solid #cbd5f5",
    padding: "0.5rem",
    fontFamily: "inherit",
    minHeight: "5rem",
  },
  hint: {
    color: "#64748b",
    fontSize: "0.85rem",
    fontWeight: 400,
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "0.75rem",
    marginTop: "0.5rem",
  },
  cancelButton: {
    background: "#f1f5f9",
    border: "1px solid #cbd5f5",
    borderRadius: 10,
    padding: "0.6rem 1.2rem",
    cursor: "pointer",
    fontWeight: 600,
    color: "#1e293b",
  },
  saveButton: {
    background: "#2563eb",
    border: "1px solid #1d4ed8",
    color: "#ffffff",
    borderRadius: 10,
    padding: "0.6rem 1.4rem",
    cursor: "pointer",
    fontWeight: 600,
  },
  error: {
    background: "rgba(248, 113, 113, 0.12)",
    color: "#b91c1c",
    borderRadius: 8,
    border: "1px solid rgba(248, 113, 113, 0.35)",
    padding: "0.75rem",
  },
};
