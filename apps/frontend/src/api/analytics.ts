import { LeadStatus } from "../constants/leadStatus";
import { apiFetch } from "./client";

export interface LeadVolumePoint {
  date: string;
  count: number;
}

export interface ConversionByPartner {
  partnerId: string;
  partnerName: string;
  totalLeads: number;
  convertedLeads: number;
  conversionRate: number;
}

export interface FunnelPoint {
  status: LeadStatus;
  count: number;
}

export interface DashboardAnalyticsSummary {
  totalLeads: number;
  leadsInRange: number;
  signedLeadsInRange: number;
  overallConversionRate: number;
  averageTimeToCloseDays: number | null;
}

export interface DashboardAnalyticsResponse {
  range: {
    start: string;
    end: string;
    days: number;
  };
  leadVolume: LeadVolumePoint[];
  conversionByPartner: ConversionByPartner[];
  funnel: FunnelPoint[];
  summary: DashboardAnalyticsSummary;
}

export interface DashboardAnalyticsParams {
  rangeDays?: number;
  partnerId?: string;
}

export const fetchDashboardAnalytics = (
  token: string,
  params: DashboardAnalyticsParams = {},
) => {
  const searchParams = new URLSearchParams();
  if (params.rangeDays) {
    searchParams.set("rangeDays", String(params.rangeDays));
  }
  if (params.partnerId) {
    searchParams.set("partnerId", params.partnerId);
  }

  const query = searchParams.toString();
  const path = `/api/analytics/dashboard${query ? `?${query}` : ""}`;

  return apiFetch<DashboardAnalyticsResponse>(path, { token });
};

export interface StuckForm {
  id: string;
  leadId: string;
  updatedAt: string;
  completionPercent: number;
  customer: {
    firstName: string;
    lastName: string;
    email: string | null;
  } | null;
}

export interface DashboardMonitoringDataResponse {
  stuckForms: StuckForm[];
  failedPinAttempts: {
    count: number;
    rangeDays: number;
  };
}

export const fetchDashboardMonitoringData = (token: string) => {
  const path = "/api/analytics/monitoring";
  return apiFetch<DashboardMonitoringDataResponse>(path, { token });
};
