import React, { useEffect, useMemo, useState } from "react";

import { ApiError } from "../api/client";
import { fetchLeadNotes, LeadNote } from "../api/leads";
import { useAuth } from "../hooks/useAuth";

type SortOrder = "asc" | "desc";

interface LeadNotesListProps {
  leadId: string;
  refreshKey?: number;
}

export const LeadNotesList: React.FC<LeadNotesListProps> = ({
  leadId,
  refreshKey = 0,
}) => {
  const { token } = useAuth();
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  useEffect(() => {
    setNotes([]);
    setError(null);
  }, [leadId]);

  useEffect(() => {
    setSortOrder("desc");
  }, [leadId]);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    const loadNotes = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetchLeadNotes(token, leadId, {
          signal: controller.signal,
        });
        if (!cancelled) {
          setNotes(response.data);
        }
      } catch (err) {
        if (cancelled || (err instanceof Error && err.name === "AbortError")) {
          return;
        }
        const message =
          err instanceof ApiError ? err.message : "Failed to load notes";
        if (!cancelled) {
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadNotes();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [token, leadId, refreshKey]);

  const sortedNotes = useMemo(() => {
    const sorted = [...notes];
    sorted.sort((a, b) => {
      const first = new Date(a.createdAt).getTime();
      const second = new Date(b.createdAt).getTime();
      return sortOrder === "asc" ? first - second : second - first;
    });
    return sorted;
  }, [notes, sortOrder]);

  if (!token) {
    return <p style={styles.empty}>Authentication required.</p>;
  }

  const formatTimestamp = (isoDate: string) => {
    const date = new Date(isoDate);
    const pad = (value: number) => value.toString().padStart(2, "0");
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}, ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  };

  const formatHeader = (note: LeadNote) => {
    const displayName = note.author?.fullName?.trim() || "System";
    const displayEmail = note.author?.email || "—";
    return `${displayName} (${displayEmail}) · ${formatTimestamp(note.createdAt)}`;
  };

  const renderContent = (content: string) => {
    const lines = content.split(/\r?\n/);
    return lines.map((line, lineIndex) => (
      <React.Fragment key={`line-${lineIndex}`}>
        {lineIndex > 0 ? <br /> : null}
        {linkifyLine(line, `line-${lineIndex}`)}
      </React.Fragment>
    ));
  };

  const linkifyLine = (text: string, keyPrefix: string) => {
    const urlPattern = /(https?:\/\/[^\s]+)/g;
    const matches = Array.from(text.matchAll(urlPattern));

    if (!matches.length) {
      return text;
    }

    const nodes: React.ReactNode[] = [];
    let lastIndex = 0;

    matches.forEach((match, index) => {
      const matchText = match[0];
      const matchIndex = match.index ?? 0;
      if (matchIndex > lastIndex) {
        nodes.push(
          <React.Fragment key={`${keyPrefix}-text-${index}`}>
            {text.slice(lastIndex, matchIndex)}
          </React.Fragment>,
        );
      }
      nodes.push(
        <a
          key={`${keyPrefix}-link-${index}`}
          href={matchText}
          target="_blank"
          rel="noopener noreferrer"
          style={styles.noteLink}
        >
          {matchText}
        </a>,
      );
      lastIndex = matchIndex + matchText.length;
    });

    if (lastIndex < text.length) {
      nodes.push(
        <React.Fragment key={`${keyPrefix}-tail`}>
          {text.slice(lastIndex)}
        </React.Fragment>,
      );
    }

    return nodes;
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.heading}>Notes</span>
        <label style={styles.sortControl}>
          Sortowanie
          <select
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value as SortOrder)}
            style={styles.select}
          >
            <option value="desc">Najnowsze</option>
            <option value="asc">Najstarsze</option>
          </select>
        </label>
      </div>
      {error ? <div style={styles.error}>{error}</div> : null}
      {isLoading ? <div style={styles.loading}>Ładowanie notatek...</div> : null}
      {!isLoading && !error && sortedNotes.length === 0 ? (
        <p style={styles.empty}>Brak notatek.</p>
      ) : null}
      {!isLoading && !error && sortedNotes.length > 0 ? (
        <ul style={styles.list}>
          {sortedNotes.map((note) => (
            <li key={note.id} style={styles.listItem}>
              <div style={styles.noteHeader}>{formatHeader(note)}</div>
              <p style={styles.noteBody}>{renderContent(note.content)}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "0.75rem",
  },
  heading: {
    fontSize: "0.95rem",
    fontWeight: 600,
    color: "#1f2937",
  },
  sortControl: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    fontSize: "0.85rem",
    color: "#4b5563",
  },
  select: {
    borderRadius: 8,
    border: "1px solid #d1d5db",
    padding: "0.35rem 0.5rem",
    background: "#fff",
    fontSize: "0.85rem",
  },
  list: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  },
  listItem: {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: "0.75rem",
    background: "#f9fafb",
    boxShadow: "0 4px 8px rgba(15, 23, 42, 0.04)",
  },
  noteHeader: {
    fontSize: "0.85rem",
    fontWeight: 600,
    marginBottom: "0.35rem",
    color: "#111827",
  },
  noteBody: {
    margin: 0,
    fontSize: "0.9rem",
    color: "#1f2937",
    lineHeight: 1.5,
    wordBreak: "break-word",
  },
  noteLink: {
    color: "#1d4ed8",
    textDecoration: "underline",
  },
  error: {
    background: "#fee2e2",
    color: "#b91c1c",
    border: "1px solid #fecaca",
    padding: "0.5rem",
    borderRadius: 8,
  },
  loading: {
    fontSize: "0.9rem",
    color: "#6b7280",
  },
  empty: {
    fontSize: "0.9rem",
    color: "#6b7280",
  },
};
