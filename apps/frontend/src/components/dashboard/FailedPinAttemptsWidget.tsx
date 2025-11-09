import React from "react";

interface FailedPinAttemptsWidgetProps {
  count: number;
  rangeDays: number;
  loading: boolean;
}

export const FailedPinAttemptsWidget: React.FC<FailedPinAttemptsWidgetProps> = ({
  count,
  rangeDays,
  loading,
}) => {
  const metricStyle = {
    ...styles.metric,
    color: count > 0 ? "#ef4444" : "#111827",
  };

  return (
    <div style={styles.card}>
      <h3 style={styles.title}>Nieudane próby PIN</h3>
      {loading ? (
        <p>Ładowanie...</p>
      ) : (
        <>
          <p style={metricStyle}>{count}</p>
          <p style={styles.subtitle}>w ciągu ostatnich {rangeDays} dni</p>
        </>
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
  },
  title: {
    margin: 0,
    fontSize: "1rem",
    fontWeight: 600,
    color: "#4b5563",
  },
  metric: {
    fontSize: "2.25rem",
    fontWeight: 700,
    margin: "0.5rem 0",
  },
  subtitle: {
    margin: 0,
    fontSize: "0.875rem",
    color: "#6b7280",
  },
};
