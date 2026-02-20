import React from "react";
import { Link } from "react-router-dom";
import { StuckForm } from "../../api/analytics";

interface StuckFormsWidgetProps {
  forms: StuckForm[];
  loading: boolean;
}

const timeAgo = (date: string) => {
  const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + " lat temu";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + " mies. temu";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + " dni temu";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + " godz. temu";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + " min. temu";
  return "przed chwilą";
};

export const StuckFormsWidget: React.FC<StuckFormsWidgetProps> = ({ forms, loading }) => {
  return (
    <div style={styles.card}>
      <h3 style={styles.title}>&quot;Zawieszone&quot; formularze</h3>
      {loading ? (
        <p>Ładowanie...</p>
      ) : forms.length === 0 ? (
        <p style={styles.emptyState}>Brak zawieszonych formularzy.</p>
      ) : (
        <ul style={styles.list}>
          {forms.map((form) => (
            <li key={form.id} style={styles.listItem}>
              <div style={styles.formInfo}>
                <Link to={`/leads/${form.leadId}`} style={styles.link}>
                  {form.customer?.firstName} {form.customer?.lastName}
                </Link>
                <span style={styles.email}>{form.customer?.email}</span>
              </div>
              <div style={styles.formStatus}>
                <span>{form.completionPercent}%</span>
                <span style={styles.time}>{timeAgo(form.updatedAt)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: "#fff",
    padding: "1.5rem",
    borderRadius: "0.75rem",
    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
    color: "#111827",
    maxHeight: "400px",
    overflowY: "auto",
  },
  title: {
    margin: 0,
    fontSize: "1rem",
    fontWeight: 600,
    color: "#4b5563",
    paddingBottom: "0.5rem",
    borderBottom: "1px solid #e5e7eb",
  },
  emptyState: {
    textAlign: "center",
    padding: "2rem 0",
    color: "#6b7280",
  },
  list: {
    listStyle: "none",
    padding: 0,
    margin: 0,
  },
  listItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0.75rem 0.25rem",
    borderBottom: "1px solid #f3f4f6",
  },
  formInfo: {
    display: "flex",
    flexDirection: "column",
  },
  link: {
    fontWeight: 500,
    color: "#1d4ed8",
    textDecoration: "none",
  },
  email: {
    fontSize: "0.875rem",
    color: "#6b7280",
  },
  formStatus: {
    textAlign: "right",
  },
  time: {
    fontSize: "0.875rem",
    color: "#6b7280",
    display: "block",
  },
};
