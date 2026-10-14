import React from "react";
import { DashboardMonitoringDataResponse } from "../../api/analytics";

import { Card } from "../ui";
import { FailedPinAttemptsWidget } from "./FailedPinAttemptsWidget";
import { LeadConversionRateChart } from "./LeadConversionRateChart";
import { LeadFunnelChart } from "./LeadFunnelChart";
import { LeadVolumeChart } from "./LeadVolumeChart";
import { StuckFormsWidget } from "./StuckFormsWidget";

interface DashboardProps {
  leadVolume: Array<{ date: string; count: number }>;
  conversionRate: Array<{ name: string; value: number }>;
  funnel: Array<{ name: string; value: number }>;
  monitoringData: DashboardMonitoringDataResponse | null;
  isLoading?: boolean;
}

const hasData = <T,>(items: T[]) => items.length > 0;

export const Dashboard: React.FC<DashboardProps> = ({
  leadVolume,
  conversionRate,
  funnel,
  monitoringData,
  isLoading = false,
}) => {
  return (
    <div className="app-stack">
      <div className="app-grid-2">
        <FailedPinAttemptsWidget
          count={monitoringData?.failedPinAttempts.count ?? 0}
          rangeDays={monitoringData?.failedPinAttempts.rangeDays ?? 7}
          loading={isLoading}
        />
        <StuckFormsWidget
          forms={monitoringData?.stuckForms ?? []}
          loading={isLoading}
        />
      </div>

      <Card
        title="Lead volume over time"
        subtitle="New leads created during the selected window"
        icon="chart"
      >
        {isLoading ? (
          <div className="app-chart-empty">Loading chart…</div>
        ) : hasData(leadVolume) ? (
          <LeadVolumeChart data={leadVolume} />
        ) : (
          <div className="app-chart-empty">No lead activity recorded for this range.</div>
        )}
      </Card>

      <Card
        title="Lead conversion rate"
        subtitle="Ratio of signed agreements versus created leads per partner"
        icon="chart"
      >
        {isLoading ? (
          <div className="app-chart-empty">Loading chart…</div>
        ) : hasData(conversionRate) ? (
          <LeadConversionRateChart data={conversionRate} />
        ) : (
          <div className="app-chart-empty">No partner conversion data available.</div>
        )}
      </Card>

      <Card title="Lead funnel" subtitle="Current distribution of leads by status" icon="filter">
        {isLoading ? (
          <div className="app-chart-empty">Loading chart…</div>
        ) : hasData(funnel) ? (
          <LeadFunnelChart data={funnel} />
        ) : (
          <div className="app-chart-empty">No leads yet in the funnel.</div>
        )}
      </Card>
    </div>
  );
};
