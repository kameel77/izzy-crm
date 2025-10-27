import React from "react";

import { LeadConversionRateChart } from "./LeadConversionRateChart";
import { LeadFunnelChart } from "./LeadFunnelChart";
import { LeadVolumeChart } from "./LeadVolumeChart";

interface DashboardProps {
  leadVolume: Array<{ date: string; count: number }>;
  conversionRate: Array<{ name: string; value: number }>;
  funnel: Array<{ name: string; value: number }>;
  isLoading?: boolean;
}

const hasData = <T,>(items: T[]) => items.length > 0;

export const Dashboard: React.FC<DashboardProps> = ({
  leadVolume,
  conversionRate,
  funnel,
  isLoading = false,
}) => {
  return (
    <div style={styles.wrapper}>
      <section style={styles.section}>
        <header style={styles.sectionHeader}>
          <h3 style={styles.sectionTitle}>Lead Volume Over Time</h3>
          <p style={styles.sectionSubtitle}>New leads created during the selected window</p>
        </header>
        <div style={styles.chartSurface}>
          {isLoading ? (
            <div style={styles.emptyState}>Loading chart…</div>
          ) : hasData(leadVolume) ? (
            <LeadVolumeChart data={leadVolume} />
          ) : (
            <div style={styles.emptyState}>No lead activity recorded for this range.</div>
          )}
        </div>
      </section>

      <section style={styles.section}>
        <header style={styles.sectionHeader}>
          <h3 style={styles.sectionTitle}>Lead Conversion Rate</h3>
          <p style={styles.sectionSubtitle}>
            Ratio of signed agreements versus created leads per partner
          </p>
        </header>
        <div style={styles.chartSurface}>
          {isLoading ? (
            <div style={styles.emptyState}>Loading chart…</div>
          ) : hasData(conversionRate) ? (
            <LeadConversionRateChart data={conversionRate} />
          ) : (
            <div style={styles.emptyState}>No partner conversion data available.</div>
          )}
        </div>
      </section>

      <section style={styles.section}>
        <header style={styles.sectionHeader}>
          <h3 style={styles.sectionTitle}>Lead Funnel</h3>
          <p style={styles.sectionSubtitle}>Current distribution of leads by status</p>
        </header>
        <div style={styles.chartSurface}>
          {isLoading ? (
            <div style={styles.emptyState}>Loading chart…</div>
          ) : hasData(funnel) ? (
            <LeadFunnelChart data={funnel} />
          ) : (
            <div style={styles.emptyState}>No leads yet in the funnel.</div>
          )}
        </div>
      </section>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: "grid",
    gap: "2rem",
  },
  section: {
    background: "#fff",
    borderRadius: "1rem",
    padding: "1.75rem",
    boxShadow: "0 18px 35px rgba(15, 23, 42, 0.08)",
    border: "1px solid rgba(15, 23, 42, 0.05)",
  },
  sectionHeader: {
    marginBottom: "1.5rem",
  },
  sectionTitle: {
    margin: 0,
    fontSize: "1.15rem",
    fontWeight: 700,
    color: "#0f172a",
  },
  sectionSubtitle: {
    marginTop: "0.4rem",
    marginBottom: 0,
    fontSize: "0.85rem",
    color: "#64748b",
  },
  chartSurface: {
    position: "relative",
    minHeight: "280px",
  },
  emptyState: {
    display: "grid",
    placeItems: "center",
    height: "100%",
    color: "#94a3b8",
    fontSize: "0.9rem",
    background: "repeating-linear-gradient(135deg, #f8fafc, #f8fafc 12px, #f1f5f9 12px, #f1f5f9 24px)",
    borderRadius: "0.75rem",
  },
};
