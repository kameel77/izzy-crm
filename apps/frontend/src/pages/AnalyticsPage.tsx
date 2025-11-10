import React, { useEffect, useMemo, useRef, useState } from "react";

import { ApiError } from "../api/client";
import {
  DashboardAnalyticsResponse,
  fetchDashboardAnalytics,
  fetchDashboardMonitoringData,
  DashboardMonitoringDataResponse,
} from "../api/analytics";
import { Dashboard } from "../components/dashboard/Dashboard";
import { LEAD_STATUS_LABELS } from "../constants/leadStatus";
import { useAuth } from "../hooks/useAuth";
import { useToasts } from "../providers/ToastProvider";

const RANGE_OPTIONS = [
  { label: "Last 7 days", value: 7 },
  { label: "Last 30 days", value: 30 },
  { label: "Last 90 days", value: 90 },
];

const formatNumber = (value: number) => value.toLocaleString();

const formatPercent = (value: number) => {
  if (!Number.isFinite(value)) return "—";
  if (value === 0) return "0%";
  const scaled = value * 100;
  const decimals = scaled >= 10 ? 1 : 2;
  return `${scaled.toFixed(decimals)}%`;
};

const formatDays = (value: number | null) => {
  if (value === null || Number.isNaN(value)) return "—";
  return `${value.toFixed(1)} days`;
};

const formatRange = (startIso: string, endIso: string) => {
  try {
    const start = new Date(startIso);
    const end = new Date(endIso);
    const formatter = new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
    });
    return `${formatter.format(start)} – ${formatter.format(end)}`;
  } catch {
    return "";
  }
};

interface SummaryCardProps {
  label: string;
  value: string;
  description?: string;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ label, value, description }) => (
  <div style={styles.summaryCard}>
    <div style={styles.summaryLabel}>{label}</div>
    <div style={styles.summaryValue}>{value}</div>
    {description ? <div style={styles.summaryDescription}>{description}</div> : null}
  </div>
);

export const AnalyticsPage: React.FC = () => {
  const { token } = useAuth();
  const toasts = useToasts();
  const toastsRef = useRef(toasts);

  useEffect(() => {
    toastsRef.current = toasts;
  }, [toasts]);

  const [rangeDays, setRangeDays] = useState(30);
  const [analytics, setAnalytics] = useState<DashboardAnalyticsResponse | null>(null);
  const [monitoringData, setMonitoringData] =
    useState<DashboardMonitoringDataResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    let isCancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [analyticsResponse, monitoringResponse] = await Promise.all([
          fetchDashboardAnalytics(token, { rangeDays }),
          fetchDashboardMonitoringData(token),
        ]);

        if (!isCancelled) {
          setAnalytics(analyticsResponse);
          setMonitoringData(monitoringResponse);
        }
      } catch (err) {
        if (isCancelled) {
          return;
        }
        const message =
          err instanceof ApiError ? err.message : "Failed to load analytics dashboard";
        setError(message);
        toastsRef.current.error(message);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    load();

    return () => {
      isCancelled = true;
    };
  }, [token, rangeDays]);

  const summaryCards = useMemo(() => {
    if (!analytics) return [];
    const summary = analytics.summary;
    return [
      {
        label: "Total Leads",
        value: formatNumber(summary.totalLeads),
        description: "All-time captured",
      },
      {
        label: "New Leads",
        value: formatNumber(summary.leadsInRange),
        description: `Created in the last ${rangeDays} days`,
      },
      {
        label: "Conversion Rate",
        value: formatPercent(summary.overallConversionRate),
        description: "Signed agreements vs. created leads",
      },
      {
        label: "Avg. Time to Close",
        value: formatDays(summary.averageTimeToCloseDays),
        description: "Signed agreements in this window",
      },
    ];
  }, [analytics, rangeDays]);

  const conversionData = useMemo(
    () =>
      analytics
        ? analytics.conversionByPartner.map((item) => ({
            name: item.partnerName,
            value: item.conversionRate,
          }))
        : [],
    [analytics],
  );

  const funnelData = useMemo(
    () =>
      analytics
        ? analytics.funnel
            .map((item) => ({
              name: LEAD_STATUS_LABELS[item.status],
              value: item.count,
            }))
            .filter((item) => item.value > 0)
        : [],
    [analytics],
  );

  const rangeLabel =
    analytics && analytics.range ? formatRange(analytics.range.start, analytics.range.end) : "";

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.heading}>Analytics Dashboard</h1>
          <p style={styles.subheading}>
            Monitor pipeline health, identify bottlenecks, and surface partner performance trends.
          </p>
          {rangeLabel ? <p style={styles.rangeHint}>Window: {rangeLabel}</p> : null}
        </div>
        <div style={styles.controls}>
          <label htmlFor="analytics-range" style={styles.controlLabel}>
            Time range
          </label>
          <select
            id="analytics-range"
            value={rangeDays}
            onChange={(event) => setRangeDays(Number(event.target.value))}
            style={styles.select}
          >
            {RANGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </header>

      {error ? <div style={styles.errorBanner}>{error}</div> : null}

      <section style={styles.summaryRow}>
        {summaryCards.map((card) => (
          <SummaryCard
            key={card.label}
            label={card.label}
            value={card.value}
            description={card.description}
          />
        ))}
      </section>

      <Dashboard
        leadVolume={analytics?.leadVolume ?? []}
        conversionRate={conversionData}
        funnel={funnelData}
        monitoringData={monitoringData}
        isLoading={isLoading}
      />
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    display: "flex",
    flexDirection: "column",
    gap: "2rem",
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "1.5rem",
  },
  heading: {
    margin: 0,
    fontSize: "2rem",
    fontWeight: 700,
    color: "#0f172a",
  },
  subheading: {
    marginTop: "0.5rem",
    marginBottom: "0.75rem",
    fontSize: "1rem",
    color: "#475569",
    maxWidth: "620px",
    lineHeight: 1.5,
  },
  rangeHint: {
    margin: 0,
    fontSize: "0.85rem",
    color: "#64748b",
  },
  controls: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
    minWidth: "180px",
  },
  controlLabel: {
    fontSize: "0.8rem",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "#64748b",
  },
  select: {
    padding: "0.6rem 0.75rem",
    borderRadius: "0.75rem",
    border: "1px solid rgba(100, 116, 139, 0.35)",
    background: "#f8fafc",
    fontSize: "0.95rem",
    color: "#0f172a",
    cursor: "pointer",
  },
  summaryRow: {
    display: "grid",
    gap: "1.5rem",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  },
  summaryCard: {
    background: "#fff",
    borderRadius: "1rem",
    padding: "1.5rem",
    boxShadow: "0 18px 35px rgba(15, 23, 42, 0.08)",
    border: "1px solid rgba(15, 23, 42, 0.05)",
  },
  summaryLabel: {
    fontSize: "0.8rem",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "#64748b",
    marginBottom: "0.5rem",
  },
  summaryValue: {
    fontSize: "1.9rem",
    fontWeight: 700,
    color: "#0f172a",
    marginBottom: "0.35rem",
  },
  summaryDescription: {
    fontSize: "0.85rem",
    color: "#475569",
  },
  errorBanner: {
    padding: "0.85rem 1rem",
    borderRadius: "0.75rem",
    background: "rgba(239, 68, 68, 0.12)",
    color: "#b91c1c",
    border: "1px solid rgba(239, 68, 68, 0.25)",
  },
};
