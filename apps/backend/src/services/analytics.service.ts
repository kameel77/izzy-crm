import { LeadStatus, Prisma } from "@prisma/client";

import { prisma } from "../lib/prisma.js";

const LEAD_STATUS_SEQUENCE: LeadStatus[] = [
  LeadStatus.NEW_LEAD,
  LeadStatus.LEAD_TAKEN,
  LeadStatus.GET_INFO,
  LeadStatus.WAITING_FOR_BANK,
  LeadStatus.WAITING_FOR_APPROVAL,
  LeadStatus.BANK_REJECTED,
  LeadStatus.CLIENT_ACCEPTED,
  LeadStatus.CLIENT_REJECTED,
  LeadStatus.AGREEMENT_SIGNED,
];

const MS_IN_DAY = 1000 * 60 * 60 * 24;

const formatDateKey = (value: Date) => value.toISOString().slice(0, 10);

export interface DashboardAnalyticsOptions {
  partnerId?: string;
  rangeDays?: number;
}

export interface DashboardAnalytics {
  range: {
    start: string;
    end: string;
    days: number;
  };
  leadVolume: Array<{
    date: string;
    count: number;
  }>;
  conversionByPartner: Array<{
    partnerId: string;
    partnerName: string;
    totalLeads: number;
    convertedLeads: number;
    conversionRate: number;
  }>;
  funnel: Array<{
    status: LeadStatus;
    count: number;
  }>;
  summary: {
    totalLeads: number;
    leadsInRange: number;
    signedLeadsInRange: number;
    overallConversionRate: number;
    averageTimeToCloseDays: number | null;
  };
}

export const getDashboardAnalytics = async (
  options: DashboardAnalyticsOptions = {},
): Promise<DashboardAnalytics> => {
  const rangeDays = Math.min(Math.max(options.rangeDays ?? 30, 1), 365);

  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  const start = new Date(end);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (rangeDays - 1));

  const leadWhere: Prisma.LeadWhereInput = {};
  if (options.partnerId) {
    leadWhere.partnerId = options.partnerId;
  }

  const leadsInRange = await prisma.lead.findMany({
    where: {
      ...leadWhere,
      leadCreatedAt: { gte: start },
    },
    select: {
      id: true,
      status: true,
      leadCreatedAt: true,
      partnerId: true,
      partner: {
        select: {
          name: true,
        },
      },
    },
  });

  const totalLeads = await prisma.lead.count({
    where: leadWhere,
  });

  const funnelGroups = await prisma.lead.groupBy({
    by: ["status"],
    _count: {
      _all: true,
    },
    where: leadWhere,
  });

  const funnel = LEAD_STATUS_SEQUENCE.map((status) => ({
    status,
    count: funnelGroups.find((group) => group.status === status)?._count._all ?? 0,
  }));

  const volumeSeed = new Map<string, number>();
  for (let offset = 0; offset < rangeDays; offset += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + offset);
    volumeSeed.set(formatDateKey(date), 0);
  }

  let signedLeadsInRange = 0;

  const partnerStats = new Map<
    string,
    {
      partnerId: string;
      partnerName: string;
      totalLeads: number;
      convertedLeads: number;
    }
  >();

  for (const lead of leadsInRange) {
    const dayKey = formatDateKey(lead.leadCreatedAt);
    volumeSeed.set(dayKey, (volumeSeed.get(dayKey) ?? 0) + 1);

    const partnerId = lead.partnerId;
    const existing =
      partnerStats.get(partnerId) ??
      {
        partnerId,
        partnerName: lead.partner?.name ?? "Unknown Partner",
        totalLeads: 0,
        convertedLeads: 0,
      };

    existing.totalLeads += 1;
    if (lead.status === LeadStatus.AGREEMENT_SIGNED) {
      existing.convertedLeads += 1;
      signedLeadsInRange += 1;
    }

    partnerStats.set(partnerId, existing);
  }

  const leadVolume = Array.from(volumeSeed.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, count]) => ({ date, count }));

  const conversionByPartner = Array.from(partnerStats.values())
    .sort((a, b) => b.totalLeads - a.totalLeads)
    .map((stats) => ({
      ...stats,
      conversionRate: stats.totalLeads > 0 ? stats.convertedLeads / stats.totalLeads : 0,
    }));

  const overallConversionRate =
    leadsInRange.length > 0 ? signedLeadsInRange / leadsInRange.length : 0;

  const agreements = await prisma.agreement.findMany({
    where: {
      signedAt: { not: null, gte: start },
      lead: {
        ...leadWhere,
        status: LeadStatus.AGREEMENT_SIGNED,
      },
    },
    select: {
      signedAt: true,
      lead: {
        select: {
          leadCreatedAt: true,
        },
      },
    },
  });

  const durations = agreements
    .filter((record) => record.signedAt && record.lead?.leadCreatedAt)
    .map(
      (record) =>
        ((record.signedAt as Date).getTime() - record.lead.leadCreatedAt.getTime()) / MS_IN_DAY,
    )
    .filter((value) => Number.isFinite(value) && value >= 0);

  const averageTimeToCloseDays =
    durations.length > 0
      ? durations.reduce((sum, value) => sum + value, 0) / durations.length
      : null;

  return {
    range: {
      start: start.toISOString(),
      end: end.toISOString(),
      days: rangeDays,
    },
    leadVolume,
    conversionByPartner,
    funnel,
    summary: {
      totalLeads,
      leadsInRange: leadsInRange.length,
      signedLeadsInRange,
      overallConversionRate,
      averageTimeToCloseDays,
    },
  };
};

export interface StuckForm {
  id: string;
  leadId: string;
  updatedAt: Date;
  completionPercent: number;
  customer: {
    firstName: string;
    lastName: string;
    email: string | null;
  } | null;
}

export interface DashboardMonitoringData {
  stuckForms: StuckForm[];
  failedPinAttempts: {
    count: number;
    rangeDays: number;
  };
}

export const getDashboardMonitoringData = async (): Promise<DashboardMonitoringData> => {
  const stuckThreshold = new Date();
  stuckThreshold.setHours(stuckThreshold.getHours() - 24);

  const stuckForms = await prisma.applicationForm.findMany({
    where: {
      status: "IN_PROGRESS",
      updatedAt: { lt: stuckThreshold },
    },
    select: {
      id: true,
      leadId: true,
      updatedAt: true,
      completionPercent: true,
      lead: {
        select: {
          customerProfile: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      },
    },
    orderBy: {
      updatedAt: "asc",
    },
  });

  const pinFailRangeDays = 7;
  const pinFailThreshold = new Date();
  pinFailThreshold.setDate(pinFailThreshold.getDate() - pinFailRangeDays);

  const recentFormsWithHistory = await prisma.applicationForm.findMany({
    where: {
      updatedAt: { gt: pinFailThreshold },
      unlockHistory: { not: Prisma.JsonNull },
    },
    select: {
      unlockHistory: true,
    },
  });

  let failedPinAttempts = 0;
  for (const form of recentFormsWithHistory) {
    if (Array.isArray(form.unlockHistory)) {
      for (const entry of form.unlockHistory) {
        if (
          typeof entry === "object" &&
          entry !== null &&
          "type" in entry &&
          entry.type === "CLIENT_ATTEMPT" &&
          "success" in entry &&
          entry.success === false
        ) {
          failedPinAttempts++;
        }
      }
    }
  }

  return {
    stuckForms: stuckForms.map((form) => ({
      id: form.id,
      leadId: form.leadId,
      updatedAt: form.updatedAt,
      completionPercent: form.completionPercent,
      customer: form.lead?.customerProfile
        ? {
            firstName: form.lead.customerProfile.firstName,
            lastName: form.lead.customerProfile.lastName,
            email: form.lead.customerProfile.email,
          }
        : null,
    })),
    failedPinAttempts: {
      count: failedPinAttempts,
      rangeDays: pinFailRangeDays,
    },
  };
};
