import React, { useMemo, useState } from "react";

import { LeadNote, downloadLeadNoteAttachment } from "../api/leads";
import { useAuth } from "../hooks/useAuth";
import { useToasts } from "../hooks/useToasts";

interface LeadNotesListProps {
  leadId: string;
  notes: LeadNote[];
}

export const LeadNotesList: React.FC<LeadNotesListProps> = ({ leadId, notes }) => {
  const { token } = useAuth();
  const toasts = useToasts();
  const [isFetching, setIsFetching] = useState<string | null>(null);

  const sortedNotes = useMemo(
    () => [...notes].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [notes],
  );

  const formatDate = (value: string) =>
    new Intl.DateTimeFormat("pl-PL", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleOpenAttachment = async (noteId: string, attachmentId: string) => {
    if (!token) {
      toasts.error("Brak uprawnień do pobrania załącznika");
      return;
    }

    const cacheKey = `${noteId}:${attachmentId}`;
    setIsFetching(cacheKey);

    try {
      const result = await downloadLeadNoteAttachment(token, leadId, noteId, attachmentId);
      const objectUrl = URL.createObjectURL(result.blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = result.filename || "attachment";
      anchor.rel = "noopener";
      anchor.target = "_blank";
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      toasts.error(
        error instanceof Error ? error.message : "Nie udało się pobrać załącznika",
      );
    } finally {
      setIsFetching(null);
    }
  };

  if (!sortedNotes.length) {
    return (
      <div style={styles.empty}>
        <p>Brak notatek dla tego leada.</p>
      </div>
    );
  }

  return (
    <div style={styles.list}>
      {sortedNotes.map((note) => (
        <article key={note.id} style={styles.noteCard}>
          <header style={styles.noteHeader}>
            <div>
              <div style={styles.noteMeta}>{formatDate(note.createdAt)}</div>
              {note.author ? (
                <div style={styles.noteAuthor}>{note.author.fullName || note.author.email}</div>
              ) : (
                <div style={styles.noteAuthor}>System</div>
              )}
            </div>
          </header>
          <p style={styles.noteContent}>{note.content}</p>

          {note.attachments.length ? (
            <div style={styles.attachmentsSection}>
              <div style={styles.attachmentsTitle}>Załączniki</div>
              <div style={styles.attachmentGrid}>
                {note.attachments.map((attachment) => {
                  const cacheKey = `${note.id}:${attachment.id}`;
                  const isLoading = isFetching === cacheKey;
                  return (
                    <div key={attachment.id} style={styles.attachmentCard}>
                      <div>
                        <div style={styles.attachmentName}>{attachment.originalName}</div>
                        <div style={styles.attachmentMeta}>
                          {attachment.mimeType || "Nieznany"} · {formatBytes(attachment.sizeBytes)}
                        </div>
                      </div>
                      <button
                        type="button"
                        style={styles.previewButton}
                        onClick={() => handleOpenAttachment(note.id, attachment.id)}
                        disabled={isLoading}
                      >
                        {isLoading ? "Otwieranie..." : "Pobierz"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "1.5rem",
  },
  empty: {
    border: "1px dashed #cbd5f5",
    padding: "1rem",
    borderRadius: 12,
    background: "#f8fafc",
    color: "#475569",
    textAlign: "center",
  },
  noteCard: {
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    padding: "1.25rem",
    background: "#ffffff",
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)",
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  noteHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  noteMeta: {
    fontSize: "0.9rem",
    color: "#64748b",
  },
  noteAuthor: {
    fontWeight: 600,
    color: "#0f172a",
  },
  noteContent: {
    margin: 0,
    whiteSpace: "pre-wrap",
    lineHeight: 1.6,
    color: "#1f2937",
  },
  attachmentsSection: {
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  },
  attachmentsTitle: {
    fontWeight: 600,
    color: "#0f172a",
  },
  attachmentGrid: {
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  },
  attachmentCard: {
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: "0.75rem 1rem",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "1rem",
    background: "#f8fafc",
  },
  attachmentName: {
    fontWeight: 600,
  },
  attachmentMeta: {
    fontSize: "0.85rem",
    color: "#475569",
  },
  previewButton: {
    border: "none",
    background: "#2563eb",
    color: "#ffffff",
    padding: "0.45rem 1rem",
    borderRadius: 999,
    cursor: "pointer",
    fontWeight: 600,
    minWidth: 120,
  },
};
