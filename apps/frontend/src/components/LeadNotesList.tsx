import React from "react";

import { LeadNote, LeadNoteTag } from "../api/leadNotes";

interface LeadNotesListProps {
  notes: LeadNote[];
  availableTags: LeadNoteTag[];
  selectedTagIds: string[];
  onSelectedTagIdsChange: (tagIds: string[]) => void;
  onCreate: () => void;
  onEdit: (note: LeadNote) => void;
  onDelete: (note: LeadNote) => void;
  isLoading: boolean;
  canManage: boolean;
  error?: string | null;
}

export const LeadNotesList: React.FC<LeadNotesListProps> = ({
  notes,
  availableTags,
  selectedTagIds,
  onSelectedTagIdsChange,
  onCreate,
  onEdit,
  onDelete,
  isLoading,
  canManage,
  error,
}) => {
  const handleFilterChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const options = Array.from(event.target.selectedOptions);
    onSelectedTagIdsChange(options.map((option) => option.value));
  };

  return (
    <section style={styles.container}>
      <header style={styles.header}>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>
            Filtruj po tagach
            <select
              multiple
              value={selectedTagIds}
              onChange={handleFilterChange}
              style={styles.filterSelect}
            >
              {availableTags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>
          </label>
          <span style={styles.filterHint}>
            Wybierz jeden lub kilka tagów, aby zawęzić listę notatek.
          </span>
        </div>
        {canManage ? (
          <button type="button" style={styles.createButton} onClick={onCreate}>
            Dodaj notatkę
          </button>
        ) : null}
      </header>

      {error ? <div style={styles.error}>{error}</div> : null}

      <div style={styles.notesWrapper}>
        {isLoading ? (
          <div style={styles.loading}>Ładowanie notatek...</div>
        ) : notes.length === 0 ? (
          <div style={styles.empty}>Brak notatek spełniających kryteria.</div>
        ) : (
          notes.map((note) => (
            <article key={note.id} style={styles.noteCard}>
              <div style={styles.noteHeader}>
                <div>
                  <div style={styles.noteMeta}>
                    {note.author ? note.author.fullName || note.author.email : "Brak autora"}
                    <span style={styles.metaSeparator}>•</span>
                    {new Date(note.createdAt).toLocaleString()}
                    {note.updatedAt !== note.createdAt ? (
                      <span style={styles.updatedAt}>
                        (aktualizacja: {new Date(note.updatedAt).toLocaleString()})
                      </span>
                    ) : null}
                  </div>
                  {note.tags.length ? (
                    <div style={styles.tagList}>
                      {note.tags.map((tag) => (
                        <span key={tag.id} style={styles.tagChip}>
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                {canManage ? (
                  <div style={styles.noteActions}>
                    <button type="button" style={styles.secondaryButton} onClick={() => onEdit(note)}>
                      Edytuj
                    </button>
                    <button type="button" style={styles.dangerButton} onClick={() => onDelete(note)}>
                      Usuń
                    </button>
                  </div>
                ) : null}
              </div>
              <p style={styles.noteContent}>{note.content}</p>
            </article>
          ))
        )}
      </div>
    </section>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: "1rem",
    flexWrap: "wrap",
    alignItems: "flex-start",
  },
  filterGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
    flex: "1 1 280px",
  },
  filterLabel: {
    display: "flex",
    flexDirection: "column",
    gap: "0.4rem",
    fontWeight: 600,
    color: "#1e293b",
  },
  filterSelect: {
    borderRadius: 12,
    border: "1px solid #cbd5f5",
    padding: "0.5rem",
    minHeight: "5rem",
    fontFamily: "inherit",
  },
  filterHint: {
    fontSize: "0.85rem",
    color: "#64748b",
  },
  createButton: {
    alignSelf: "flex-start",
    background: "#2563eb",
    color: "#ffffff",
    borderRadius: 12,
    border: "1px solid #1d4ed8",
    padding: "0.6rem 1.3rem",
    fontWeight: 600,
    cursor: "pointer",
  },
  notesWrapper: {
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  },
  loading: {
    padding: "0.75rem",
    background: "#f8fafc",
    borderRadius: 10,
    border: "1px dashed #cbd5f5",
    color: "#1e293b",
    textAlign: "center",
  },
  empty: {
    padding: "0.75rem",
    background: "#f8fafc",
    borderRadius: 10,
    border: "1px dashed #cbd5f5",
    color: "#64748b",
    textAlign: "center",
  },
  noteCard: {
    background: "#f8fafc",
    borderRadius: 12,
    border: "1px solid #e2e8f0",
    padding: "1rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  },
  noteHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "1rem",
    alignItems: "flex-start",
  },
  noteMeta: {
    fontSize: "0.9rem",
    color: "#475569",
    display: "flex",
    gap: "0.35rem",
    flexWrap: "wrap",
    alignItems: "center",
  },
  metaSeparator: {
    opacity: 0.6,
  },
  updatedAt: {
    fontSize: "0.8rem",
    color: "#64748b",
  },
  tagList: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.4rem",
    marginTop: "0.35rem",
  },
  tagChip: {
    background: "#e0e7ff",
    color: "#1e40af",
    borderRadius: 999,
    padding: "0.25rem 0.65rem",
    fontSize: "0.8rem",
    fontWeight: 600,
  },
  noteActions: {
    display: "flex",
    gap: "0.5rem",
  },
  secondaryButton: {
    background: "#f1f5f9",
    border: "1px solid #cbd5f5",
    borderRadius: 10,
    padding: "0.4rem 0.9rem",
    cursor: "pointer",
    fontWeight: 600,
  },
  dangerButton: {
    background: "rgba(239, 68, 68, 0.12)",
    border: "1px solid rgba(239, 68, 68, 0.45)",
    color: "#b91c1c",
    borderRadius: 10,
    padding: "0.4rem 0.9rem",
    cursor: "pointer",
    fontWeight: 600,
  },
  noteContent: {
    margin: 0,
    whiteSpace: "pre-wrap",
    lineHeight: 1.5,
    color: "#1e293b",
  },
  error: {
    background: "rgba(248, 113, 113, 0.12)",
    color: "#b91c1c",
    borderRadius: 10,
    border: "1px solid rgba(248, 113, 113, 0.35)",
    padding: "0.75rem",
  },
};
