import { ApplicationFormStatus, BankDecisionStatus, ConsentType, LeadStatus, Prisma, UserRole } from "@prisma/client";
import { createHash } from "crypto";
import { prisma } from "../lib/prisma.js";
import { createHttpError } from "../utils/httpError.js";
import { CLIENT_ACTIVITY_TIMEOUT_MS, releaseClientActivity } from "./application-form.service.js";

const toJson = (value?: Record<string, unknown>) =>
  (value as Prisma.InputJsonValue | undefined);

export type LeadConsentStatus = "complete" | "incomplete" | "missing_required" | "no_templates";

export const getConsentStatusForLead = async (
  lead: {
    id: string;
    partnerId: string;
    consentRecords: Array<{
      consentTemplateId: string;
      consentGiven: boolean;
      consentTemplate: { isRequired: boolean; formType: string };
    }>;
    applicationForm?: {
      id: string;
      status: ApplicationFormStatus;
    } | null;
  }
): Promise<LeadConsentStatus> => {
  const formTypeSet = new Set<string>(["lead_creation"]); // Default form types for lead creation
  if (lead.applicationForm) {
    formTypeSet.add("financing_application");
  }

  if (
    lead.consentRecords.some(
      (record) => record.consentTemplate.formType === "financing_application",
    )
  ) {
    formTypeSet.add("financing_application");
  }

  const formTypes = Array.from(formTypeSet);

  const requiredTemplates = await prisma.consentTemplate.findMany({
    where: {
      formType: { in: formTypes },
      isActive: true,
      isRequired: true,
    },
    select: { id: true, consentType: true },
  });

  if (requiredTemplates.length === 0) {
    return lead.consentRecords.some((record) => record.consentGiven)
      ? "complete"
      : "no_templates";
  }

  const givenRequiredConsents = new Set(
    lead.consentRecords
      .filter(r => r.consentGiven && r.consentTemplate.isRequired)
      .map(r => r.consentTemplateId)
  );

  const allRequiredGiven = requiredTemplates.every(template =>
    givenRequiredConsents.has(template.id)
  );

  if (!allRequiredGiven) {
    return "missing_required";
  }

  const optionalTemplates = await prisma.consentTemplate.findMany({
    where: {
      formType: { in: formTypes },
      isActive: true,
      isRequired: false,
    },
    select: { id: true },
  });

  const givenOptionalConsents = new Set(
    lead.consentRecords
      .filter(r => r.consentGiven && !r.consentTemplate.isRequired)
      .map(r => r.consentTemplateId)
  );

  const allOptionalGiven = optionalTemplates.every(template =>
    givenOptionalConsents.has(template.id)
  );

  if (optionalTemplates.length > 0 && !allOptionalGiven) {
    return "incomplete";
  }

  return "complete";
};

const leadSummarySelect = {
  id: true,
  status: true,
  partnerId: true,
  leadCreatedAt: true,
  claimedAt: true,
  lastContactAt: true,
  nextActionAt: true,
  createdByUserId: true,
  assignedUser: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
  partner: {
    select: {
      id: true,
      name: true,
    },
  },
  customerProfile: {
    select: {
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
    },
  },
  consentRecords: {
    select: {
      consentTemplateId: true,
      consentGiven: true,
      consentTemplate: { select: { isRequired: true, formType: true } },
    },
  },
  applicationForm: {
    select: {
      id: true,
      status: true,
    },
  },
} satisfies Prisma.LeadSelect;

const allowedTransitions: Record<LeadStatus, LeadStatus[]> = {
  NEW: [LeadStatus.FIRST_CONTACT, LeadStatus.UNQUALIFIED],
  FIRST_CONTACT: [LeadStatus.FOLLOW_UP, LeadStatus.VERIFICATION, LeadStatus.UNQUALIFIED, LeadStatus.NEW],
  FOLLOW_UP: [LeadStatus.VERIFICATION, LeadStatus.UNQUALIFIED],
  VERIFICATION: [LeadStatus.GATHERING_DOCUMENTS, LeadStatus.UNQUALIFIED],
  UNQUALIFIED: [],
  GATHERING_DOCUMENTS: [LeadStatus.CREDIT_ANALYSIS, LeadStatus.CLOSED_LOST, LeadStatus.CANCELLED],
  CREDIT_ANALYSIS: [
    LeadStatus.OFFER_PRESENTED,
    LeadStatus.CLOSED_LOST,
    LeadStatus.CLOSED_NO_FINANCING,
    LeadStatus.CANCELLED,
  ],
  OFFER_PRESENTED: [
    LeadStatus.NEGOTIATIONS,
    LeadStatus.TERMS_ACCEPTED,
    LeadStatus.CLOSED_LOST,
    LeadStatus.CANCELLED,
  ],
  NEGOTIATIONS: [LeadStatus.TERMS_ACCEPTED, LeadStatus.CLOSED_LOST, LeadStatus.CANCELLED],
  TERMS_ACCEPTED: [LeadStatus.CONTRACT_IN_PREPARATION, LeadStatus.CLOSED_LOST, LeadStatus.CANCELLED],
  CONTRACT_IN_PREPARATION: [LeadStatus.CONTRACT_SIGNING, LeadStatus.CLOSED_LOST, LeadStatus.CANCELLED],
  CONTRACT_SIGNING: [LeadStatus.CLOSED_WON, LeadStatus.CLOSED_LOST, LeadStatus.CANCELLED],
  CLOSED_WON: [],
  CLOSED_LOST: [],
  CLOSED_NO_FINANCING: [],
  CANCELLED: [],
};

export interface CreateLeadInput {
  partnerId: string;
  sourceMetadata?: Record<string, unknown>;
  notes?: string;
  createdByUserId?: string | null;
  ipAddress?: string;
  userAgent?: string;
  customer: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    dateOfBirth?: string;
  };
  currentVehicle?: {
    make?: string;
    model?: string;
    year?: number;
    mileage?: number;
    ownershipStatus?: string;
  };
  desiredVehicle?: {
    make?: string;
    model?: string;
    year?: number;
    budget?: number;
    preferences?: Record<string, unknown>;
  };
  financing?: {
    bank?: string;
    loanAmount?: number;
    downPayment?: number;
    termMonths?: number;
    income?: number;
    expenses?: number;
  };
  consents?: Array<{
    templateId: string;
    version: number;
    given: boolean;
  }>;
}

export const createLead = async (input: CreateLeadInput) => {
  try {
    const lead = await prisma.$transaction(async (tx) => {
      const newLead = await tx.lead.create({
        data: {
          partnerId: input.partnerId,
          status: LeadStatus.NEW,
          sourceMetadata: toJson(input.sourceMetadata),
          notes: input.notes,
          createdByUserId: input.createdByUserId ?? null,
          customerProfile: {
            create: {
              firstName: input.customer.firstName,
              lastName: input.customer.lastName,
              email: input.customer.email,
              phone: input.customer.phone,
              dateOfBirth: input.customer.dateOfBirth
                ? new Date(input.customer.dateOfBirth)
                : undefined,
            },
          },
          vehicleCurrent: input.currentVehicle
            ? {
                create: {
                  make: input.currentVehicle.make,
                  model: input.currentVehicle.model,
                  year: input.currentVehicle.year ?? undefined,
                  mileage: input.currentVehicle.mileage ?? undefined,
                  ownershipStatus: input.currentVehicle.ownershipStatus,
                },
              }
            : undefined,
          vehicleDesired: input.desiredVehicle
            ? {
                create: {
                  make: input.desiredVehicle.make,
                  model: input.desiredVehicle.model,
                  year: input.desiredVehicle.year ?? undefined,
                  budget: input.desiredVehicle.budget
                    ? new Prisma.Decimal(input.desiredVehicle.budget)
                    : undefined,
                  preferences: toJson(input.desiredVehicle.preferences),
                },
              }
            : undefined,
          financingApps: input.financing
            ? {
                create: {
                  bank: input.financing.bank ?? "TBD",
                  loanAmount: input.financing.loanAmount
                    ? new Prisma.Decimal(input.financing.loanAmount)
                    : undefined,
                  downPayment: input.financing.downPayment
                    ? new Prisma.Decimal(input.financing.downPayment)
                    : undefined,
                  termMonths: input.financing.termMonths ?? undefined,
                  income: input.financing.income
                    ? new Prisma.Decimal(input.financing.income)
                    : undefined,
                  expenses: input.financing.expenses
                    ? new Prisma.Decimal(input.financing.expenses)
                    : undefined,
                },
              }
            : undefined,
        },
        select: {
          id: true,
          status: true,
          partnerId: true,
          leadCreatedAt: true,
        },
      });

      if (input.consents && input.consents.length > 0) {
        const givenConsents = input.consents.filter(c => c.given);
        if (givenConsents.length > 0) {
          if (!input.createdByUserId) {
            throw new Error("User ID is required to record consents.");
          }
          const templateIds = givenConsents.map(c => c.templateId);
          const templates = await tx.consentTemplate.findMany({
            where: { id: { in: templateIds } },
          });

          const templateMap = new Map(templates.map(t => [t.id, t]));

          await tx.consentRecord.createMany({
            data: givenConsents.map(c => {
              const template = templateMap.get(c.templateId);
              if (!template) {
                throw new Error(`Consent template with id ${c.templateId} not found.`);
              }
              return {
                leadId: newLead.id,
                consentTemplateId: c.templateId,
                version: c.version,
                consentGiven: true,
                consentMethod: "PARTNER_SUBMISSION",
                recordedByUserId: input.createdByUserId as string,
                consentType: template.consentType,
                consentText: template.content,
                partnerId: input.partnerId,
                ipAddress: input.ipAddress,
                userAgent: input.userAgent,
              };
            }),
          });
        }
      }

      return newLead;
    });

    return lead;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2003") {
        const notFoundError = new Error("Partner not found");
        (notFoundError as Error & { status: number }).status = 404;
        throw notFoundError;
      }
    }

    throw error;
  }
};

export interface LeadListFilters {
  status?: LeadStatus[];
  partnerId?: string;
  scopedPartnerId?: string;
  assignedUserId?: string | null;
  includeAssignedUserId?: string;
  includeAssignedOnly?: boolean;
  createdByUserId?: string;
  search?: string;
  skip: number;
  take: number;
}

export const listLeads = async (filters: LeadListFilters) => {
  const where: Prisma.LeadWhereInput = {};
  const andConditions: Prisma.LeadWhereInput[] = [];

  if (filters.status?.length) {
    andConditions.push({ status: { in: filters.status } });
  }

  if (typeof filters.assignedUserId !== "undefined") {
    if (filters.assignedUserId === null) {
      andConditions.push({ assignedUserId: null });
    } else {
      andConditions.push({ assignedUserId: filters.assignedUserId });
    }
  }

  if (filters.partnerId) {
    andConditions.push({ partnerId: filters.partnerId });
  }

  const scopedOrAssigned: Prisma.LeadWhereInput[] = [];
  if (filters.scopedPartnerId) {
    scopedOrAssigned.push({ partnerId: filters.scopedPartnerId });
  }
  if (filters.includeAssignedUserId) {
    scopedOrAssigned.push({ assignedUserId: filters.includeAssignedUserId });
  }

  if (scopedOrAssigned.length) {
    if (filters.includeAssignedOnly && filters.includeAssignedUserId) {
      andConditions.push({ assignedUserId: filters.includeAssignedUserId });
    } else {
      andConditions.push({ OR: scopedOrAssigned });
    }
  }

  if (filters.createdByUserId) {
    andConditions.push({ createdByUserId: filters.createdByUserId });
  }

  if (filters.search) {
    const searchTerm = filters.search.trim();
    if (searchTerm) {
      andConditions.push({
        OR: [
          { customerProfile: { firstName: { contains: searchTerm, mode: "insensitive" } } },
          { customerProfile: { lastName: { contains: searchTerm, mode: "insensitive" } } },
          { customerProfile: { email: { contains: searchTerm, mode: "insensitive" } } },
          { customerProfile: { phone: { contains: searchTerm, mode: "insensitive" } } },
        ],
      });
    }
  }

  if (andConditions.length) {
    where.AND = andConditions;
  }

  const [items, total] = await prisma.$transaction([
    prisma.lead.findMany({
      where,
      orderBy: { leadCreatedAt: "desc" },
      skip: filters.skip,
      take: filters.take,
      select: leadSummarySelect,
    }),
    prisma.lead.count({ where }),
  ]);

  const itemsWithConsentStatus = await Promise.all(items.map(async (item) => ({
    ...item,
    consentStatus: await getConsentStatusForLead(item),
  })));

  return {
    items: itemsWithConsentStatus,
    total,
  };
};

export const getLeadById = async (id: string) => {
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      partner: { select: { id: true, name: true } },
      assignedUser: { select: { id: true, fullName: true, email: true } },
      customerProfile: true,
      vehicleCurrent: true,
      vehicleDesired: true,
            applicationForm: {
              select: {
                id: true,
                status: true,
                isClientActive: true,
                uniqueLink: true,
                linkExpiresAt: true,
                submittedAt: true,
                lastClientActivity: true,
                unlockHistory: true,
                formData: true,
              },
            },
      financingApps: {
        orderBy: { createdAt: "desc" },
      },
      documents: {
        orderBy: { uploadedAt: "desc" },
      },
      leadNotes: {
        orderBy: { createdAt: "desc" },
        include: {
          author: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
      },
      offers: {
        orderBy: { createdAt: "desc" },
      },
      agreement: true,
      reminders: {
        orderBy: { dueAt: "asc" },
      },
      auditLogs: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
      },
      consentRecords: {
        orderBy: { recordedAt: "desc" },
        include: {
          consentTemplate: { select: { id: true, title: true, content: true, version: true, isRequired: true, formType: true } },
          recordedBy: { select: { id: true, fullName: true, email: true } },
          partner: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!lead) return null;

  if (lead.applicationForm?.isClientActive) {
    const lastActivity = lead.applicationForm.lastClientActivity;
    if (!lastActivity || Date.now() - lastActivity.getTime() > CLIENT_ACTIVITY_TIMEOUT_MS) {
      await releaseClientActivity(lead.applicationForm.id);
      lead.applicationForm.isClientActive = false;
      lead.applicationForm.lastClientActivity = null;
    }
  }

  const consentStatus = await getConsentStatusForLead(lead);

  return { ...lead, consentStatus };
};

export interface UpdateLeadVehiclesInput {
  leadId: string;
  userId: string;
  current?: {
    make?: string;
    model?: string;
    year?: number;
    mileage?: number;
    ownershipStatus?: string;
  } | null;
  desired?: {
    make?: string;
    model?: string;
    year?: number;
    budget?: number | null;
    preferences?: Record<string, unknown> | null;
  } | null;
  amountAvailable?: number | null;
}

export const updateLeadVehicles = async (input: UpdateLeadVehiclesInput) => {
  return prisma.$transaction(async (tx) => {
    const existingLead = await tx.lead.findUnique({
      where: { id: input.leadId },
      select: { id: true },
    });

    if (!existingLead) {
      const error = new Error("Lead not found");
      (error as Error & { status: number }).status = 404;
      throw error;
    }

    if (typeof input.current !== "undefined") {
      if (input.current) {
        await tx.vehicleCurrent.upsert({
          where: { leadId: input.leadId },
          create: {
            leadId: input.leadId,
            make: input.current.make,
            model: input.current.model,
            year: input.current.year ?? undefined,
            mileage: input.current.mileage ?? undefined,
            ownershipStatus: input.current.ownershipStatus,
          },
          update: {
            make: input.current.make,
            model: input.current.model,
            year: input.current.year ?? undefined,
            mileage: input.current.mileage ?? undefined,
            ownershipStatus: input.current.ownershipStatus,
          },
        });
      } else {
        await tx.vehicleCurrent.deleteMany({ where: { leadId: input.leadId } });
      }
    }

    if (typeof input.desired !== "undefined") {
      if (input.desired) {
        await tx.vehicleDesired.upsert({
          where: { leadId: input.leadId },
          create: {
            leadId: input.leadId,
            make: input.desired.make,
            model: input.desired.model,
            year: input.desired.year ?? undefined,
            budget: typeof input.desired.budget === "number"
              ? new Prisma.Decimal(input.desired.budget)
              : undefined,
            preferences:
              typeof input.desired.preferences === "undefined"
                ? undefined
                : input.desired.preferences === null
                  ? Prisma.JsonNull
                  : toJson(input.desired.preferences),
          },
          update: {
            make: input.desired.make,
            model: input.desired.model,
            year: input.desired.year ?? undefined,
            budget: typeof input.desired.budget === "number"
              ? new Prisma.Decimal(input.desired.budget)
              : input.desired.budget === null
                ? null
                : undefined,
            preferences:
              typeof input.desired.preferences === "undefined"
                ? undefined
                : input.desired.preferences === null
                  ? Prisma.JsonNull
                  : toJson(input.desired.preferences),
          },
        });
      } else {
        await tx.vehicleDesired.deleteMany({ where: { leadId: input.leadId } });
      }
    }

    if (typeof input.amountAvailable !== "undefined") {
      const existingFinancing = await tx.financingApplication.findFirst({
        where: { leadId: input.leadId },
        orderBy: { createdAt: "desc" },
      });

      if (existingFinancing) {
        await tx.financingApplication.update({
          where: { id: existingFinancing.id },
          data: {
            downPayment:
              input.amountAvailable === null
                ? null
                : new Prisma.Decimal(input.amountAvailable),
            bank: existingFinancing.bank || "TBD",
          },
        });
      } else if (input.amountAvailable !== null) {
        await tx.financingApplication.create({
          data: {
            leadId: input.leadId,
            bank: "TBD",
            downPayment: new Prisma.Decimal(input.amountAvailable),
          },
        });
      }
    }

    const updatedVehicles = await tx.lead.findUnique({
      where: { id: input.leadId },
      select: {
        vehicleCurrent: true,
        vehicleDesired: true,
        financingApps: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    await tx.auditLog.create({
      data: {
        leadId: input.leadId,
        userId: input.userId,
        action: "vehicle_updated",
        field: "vehicle",
        newValue: {
          vehicleCurrent: updatedVehicles?.vehicleCurrent ?? null,
          vehicleDesired: updatedVehicles?.vehicleDesired
            ? {
                ...updatedVehicles.vehicleDesired,
                budget: updatedVehicles.vehicleDesired.budget
                  ? updatedVehicles.vehicleDesired.budget.toString()
                  : null,
              }
            : null,
          amountAvailable: updatedVehicles?.financingApps?.[0]?.downPayment
            ? updatedVehicles.financingApps[0].downPayment.toString()
            : null,
        } as Prisma.InputJsonValue,
      },
    });

    return updatedVehicles;
  });
};


export interface AssignLeadInput {
  leadId: string;
  assignToUserId: string | null;
  actorUserId: string;
}

export const assignLeadOwner = async (input: AssignLeadInput) => {
  return prisma.$transaction(async (tx) => {
    const current = await tx.lead.findUnique({
      where: { id: input.leadId },
      select: { assignedUserId: true },
    });

    if (!current) {
      const notFound = new Error("Lead not found");
      (notFound as Error & { status: number }).status = 404;
      throw notFound;
    }

    if (input.assignToUserId) {
      const user = await tx.user.findUnique({
        where: { id: input.assignToUserId },
        select: { id: true, role: true },
      });

      if (!user) {
        const notFound = new Error("User not found");
        (notFound as Error & { status: number }).status = 404;
        throw notFound;
      }

      if (user.role !== UserRole.OPERATOR) {
        const invalidRole = new Error("Only operators can be assigned to leads");
        (invalidRole as Error & { status: number }).status = 400;
        throw invalidRole;
      }
    }

    const updatedLead = await tx.lead.update({
      where: { id: input.leadId },
      data: { assignedUserId: input.assignToUserId },
      select: leadSummarySelect,
    });

    await tx.auditLog.create({
      data: {
        leadId: input.leadId,
        userId: input.actorUserId,
        action: "assignment_change",
        field: "assignedUserId",
        oldValue: current.assignedUserId
          ? { assignedUserId: current.assignedUserId }
          : Prisma.JsonNull,
        newValue: input.assignToUserId ? { assignedUserId: input.assignToUserId } : Prisma.JsonNull,
      },
    });

    return updatedLead;
  });
};

export interface TransitionLeadInput {
  leadId: string;
  targetStatus: LeadStatus;
  userId: string;
  notes?: string;
  assignToUserId?: string | null;
  lastContactAt?: Date;
  nextActionAt?: Date;
}

export const transitionLeadStatus = async (input: TransitionLeadInput) => {
  return prisma.$transaction(async (tx) => {
    const current = await tx.lead.findUnique({
      where: { id: input.leadId },
      select: {
        id: true,
        status: true,
        assignedUserId: true,
      },
    });

    if (!current) {
      const error = new Error("Lead not found");
      (error as Error & { status: number }).status = 404;
      throw error;
    }

    if (current.status === input.targetStatus) {
      const error = new Error("Lead already in requested status");
      (error as Error & { status: number }).status = 400;
      throw error;
    }

    const transitions = allowedTransitions[current.status] || [];
    if (!transitions.includes(input.targetStatus)) {
      const error = new Error("Status transition not allowed");
      (error as Error & { status: number }).status = 400;
      throw error;
    }

    const data: Prisma.LeadUncheckedUpdateInput = {
      status: input.targetStatus,
    };

    if (typeof input.assignToUserId !== "undefined") {
      data.assignedUserId = input.assignToUserId;
    }

    if (input.targetStatus === LeadStatus.FIRST_CONTACT) {
      data.assignedUserId = input.assignToUserId ?? input.userId;
      data.claimedAt = new Date();
    }

    if (input.targetStatus === LeadStatus.NEW) {
      data.assignedUserId = null;
      data.claimedAt = null;
    }

    if (input.lastContactAt) {
      data.lastContactAt = input.lastContactAt;
    }

    if (input.nextActionAt) {
      data.nextActionAt = input.nextActionAt;
    }

    if (typeof input.notes !== "undefined") {
      data.notes = input.notes;
    }

    let updatedLead: Prisma.LeadGetPayload<{ select: typeof leadSummarySelect }>;

    try {
      updatedLead = await tx.lead.update({
        where: { id: input.leadId },
        data,
        select: leadSummarySelect,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2025") {
          const notFound = new Error("Lead not found");
          (notFound as Error & { status: number }).status = 404;
          throw notFound;
        }

        if (error.code === "P2003") {
          const relationError = new Error("Related record not found");
          (relationError as Error & { status: number }).status = 400;
          throw relationError;
        }
      }

      throw error;
    }

    await tx.auditLog.create({
      data: {
        leadId: input.leadId,
        userId: input.userId,
        action: "status_change",
        field: "status",
        oldValue: current.status,
        newValue: input.targetStatus,
        metadata: {
          ...(input.notes ? { notes: input.notes } : {}),
          ...(typeof input.assignToUserId !== "undefined"
            ? { assignedUserId: input.assignToUserId }
            : {}),
        },
      },
    });

    return updatedLead;
  });
};

interface FinancingPayload {
  bank: string;
  loanAmount?: number;
  downPayment?: number;
  termMonths?: number;
  income?: number;
  expenses?: number;
  decision?: string;
}

export interface UpsertFinancingInput extends FinancingPayload {
  leadId: string;
  applicationId?: string;
  userId: string;
}

const toDecimal = (value?: number) =>
  typeof value === "number" ? new Prisma.Decimal(value) : undefined;

const parseDecision = (value?: string): BankDecisionStatus | null => {
  if (!value) return null;
  const upper = value.toUpperCase() as BankDecisionStatus;
  if (["PENDING", "APPROVED", "REJECTED"].includes(upper)) {
    return upper;
  }
  return null;
};

export const upsertFinancingApplication = async (input: UpsertFinancingInput) => {
  return prisma.$transaction(async (tx) => {
    const lead = await tx.lead.findUnique({
      where: { id: input.leadId },
      select: { id: true },
    });

    if (!lead) {
      const error = new Error("Lead not found");
      (error as Error & { status: number }).status = 404;
      throw error;
    }

    const decisionValue = parseDecision(input.decision);

    const data: Prisma.FinancingApplicationUncheckedCreateInput = {
      leadId: input.leadId,
      bank: input.bank,
      loanAmount: toDecimal(input.loanAmount) ?? null,
      downPayment: toDecimal(input.downPayment) ?? null,
      termMonths: input.termMonths ?? null,
      income: toDecimal(input.income) ?? null,
      expenses: toDecimal(input.expenses) ?? null,
      decision: decisionValue,
    };

    const auditPayload = {
      bank: input.bank,
      loanAmount: input.loanAmount ?? null,
      downPayment: input.downPayment ?? null,
      termMonths: input.termMonths ?? null,
      income: input.income ?? null,
      expenses: input.expenses ?? null,
      decision: decisionValue,
    } satisfies Record<string, unknown>;

    let application;

    if (input.applicationId) {
      const existing = await tx.financingApplication.findUnique({
        where: { id: input.applicationId },
        select: { id: true, leadId: true },
      });

      if (!existing || existing.leadId !== input.leadId) {
        const error = new Error("Financing application not found");
        (error as Error & { status: number }).status = 404;
        throw error;
      }

      application = await tx.financingApplication.update({
        where: { id: input.applicationId },
        data,
      });
    } else {
      application = await tx.financingApplication.create({ data });
    }

    await tx.auditLog.create({
      data: {
        leadId: input.leadId,
        userId: input.userId,
        action: "financing_update",
        field: "financing",
        oldValue: input.applicationId
          ? ({ applicationId: input.applicationId } as Prisma.InputJsonValue)
          : undefined,
        newValue: auditPayload as Prisma.InputJsonValue,
      },
    });

    return application;
  });
};

export interface AddDocumentInput {
  leadId: string;
  userId: string;
  type: string;
  filePath: string;
  checksum?: string;
  originalName?: string;
  mimeType?: string;
  size?: number;
  storageProvider?: string;
  storageKey?: string;
}

export const addLeadDocument = async (input: AddDocumentInput) => {
  const document = await prisma.document.create({
    data: {
      leadId: input.leadId,
      type: input.type,
      filePath: input.filePath,
      uploadedBy: input.userId,
      checksum: input.checksum,
      originalName: input.originalName,
      mimeType: input.mimeType,
      sizeBytes: input.size ?? null,
      storageProvider: input.storageProvider,
      storageKey: input.storageKey,
    },
  });

  await prisma.auditLog.create({
    data: {
      leadId: input.leadId,
      userId: input.userId,
      action: "document_added",
      field: "document",
      newValue: {
        id: document.id,
        type: document.type,
        filePath: document.filePath,
        originalName: input.originalName,
        mimeType: input.mimeType,
        size: input.size,
        storageProvider: input.storageProvider,
      } as Prisma.InputJsonValue,
    },
  });

  return document;
};

export interface AddLeadNoteInput {
  leadId: string;
  userId: string;
  content: string;
  link?: string | null;
}

export const addLeadNote = async (input: AddLeadNoteInput) => {
  return prisma.$transaction(async (tx) => {
    const lead = await tx.lead.findUnique({
      where: { id: input.leadId },
      select: { id: true },
    });

    if (!lead) {
      const error = new Error("Lead not found");
      (error as Error & { status: number }).status = 404;
      throw error;
    }

    const note = await tx.leadNote.create({
      data: {
        leadId: input.leadId,
        authorId: input.userId,
        content: input.content,
        link: input.link ?? null,
      },
      include: {
        author: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    await tx.auditLog.create({
      data: {
        leadId: input.leadId,
        userId: input.userId,
        action: "note_added",
        field: "notes",
        newValue: {
          id: note.id,
          content: note.content,
          link: note.link,
        } as Prisma.InputJsonValue,
      },
    });

    return note;
  });
};

export const anonymizeLead = async (params: { leadId: string; actorUserId: string }) => {
  const { leadId, actorUserId } = params;

  return prisma.$transaction(async (tx) => {
    const lead = await tx.lead.findUnique({
      where: { id: leadId },
      include: { customerProfile: true },
    });

    if (!lead) {
      throw createHttpError({ status: 404, message: "Lead not found" });
    }

    if (lead.customerProfile) {
      const { id, nationalIdHash } = lead.customerProfile;
      const anonymizedEmail = `anon_${id.substring(0, 8)}@anonymized.local`;

      await tx.customerProfile.update({
        where: { id },
        data: {
          firstName: "ANONIMIZOWANY",
          lastName: `UŻYTKOWNIK_${id.substring(0, 8)}`,
          email: anonymizedEmail,
          phone: "000000000",
          address: Prisma.JsonNull,
          employmentInfo: Prisma.JsonNull,
          dateOfBirth: null,
          nationalIdHash: nationalIdHash
            ? createHash("sha256").update(nationalIdHash).digest("hex")
            : null,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        leadId,
        userId: actorUserId,
        action: "LEAD_ANONYMIZED",
        metadata: {
          anonymizedAt: new Date().toISOString(),
        },
      },
    });
  });
};
