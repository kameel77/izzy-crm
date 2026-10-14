import React, { useEffect, useMemo, useRef, useState } from "react";

import { ApiError } from "../api/client";
import {
  DashboardAnalyticsResponse,
  fetchDashboardAnalytics,
  fetchDashboardMonitoringData,
  DashboardMonitoringDataResponse,
} from "../api/analytics";
import { Dashboard } from "../components/dashboard/Dashboard";
import { Icon, SegmentedControl, StatCard } from "../components/ui";
import type { IconName } from "../components/ui";
import { LEAD_STATUS_LABELS } from "../constants/leadStatus";
import { useAuth } from "../hooks/useAuth";
import { useToasts } from "../providers/ToastProvider";

const RANGE_OPTIONS = [
  { label: "7 days", value: "7" },
  { label: "30 days", value: "30" },
  { label: "90 days", value: "90" },
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
        toastsRef.current.addToast(message, "error");
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

  const summaryCards = useMemo<
    Array<{ label: string; value: string; description: string; icon: IconName }>
  >(() => {
    if (!analytics) return [];
    const summary = analytics.summary;
    return [
      {
        label: "Total leads",
        value: formatNumber(summary.totalLeads),
        description: "All-time captured",
        icon: "users",
      },
      {
        label: "New leads",
        value: formatNumber(summary.leadsInRange),
        description: `Created in the last ${rangeDays} days`,
        icon: "plus",
      },
      {
        label: "Conversion rate",
        value: formatPercent(summary.overallConversionRate),
        description: "Signed agreements vs. created leads",
        icon: "chart",
      },
      {
        label: "Avg. time to close",
        value: formatDays(summary.averageTimeToCloseDays),
        description: "Signed agreements in this window",
        icon: "clock",
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
    <div className="app-page">
      <div className="app-title-row">
        <div>
          <h1 className="app-page-title">Analytics</h1>
          <p className="app-page-desc">
            Monitor pipeline health, identify bottlenecks, and surface partner performance trends.
            {rangeLabel ? ` · Window: ${rangeLabel}` : ""}
          </p>
        </div>
        <div className="app-title-row__acts">
          <SegmentedControl
            aria-label="Time range"
            value={String(rangeDays)}
            onChange={(value) => setRangeDays(Number(value))}
            options={RANGE_OPTIONS}
          />
        </div>
      </div>

      {error ? (
        <div className="app-alert app-alert--danger" role="alert">
          <Icon name="alert" />
          {error}
        </div>
      ) : null}

      <section className="app-kpis">
        {summaryCards.map((card) => (
          <StatCard
            key={card.label}
            label={card.label}
            value={card.value}
            compareLabel={card.description}
            icon={card.icon}
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
