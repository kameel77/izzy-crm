import { BankDecisionStatus, LeadStatus, Prisma, UserRole } from "@prisma/client";

import { prisma } from "../lib/prisma.js";

const toJson = (value?: Record<string, unknown>) =>
  (value as Prisma.InputJsonValue | undefined);

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
} satisfies Prisma.LeadSelect;

const leadNoteAttachmentSelect = {
  id: true,
  leadId: true,
  noteId: true,
  originalName: true,
  mimeType: true,
  sizeBytes: true,
  storageProvider: true,
  storageKey: true,
  publicUrl: true,
  createdAt: true,
} satisfies Prisma.LeadNoteAttachmentSelect;

const leadNoteInclude = {
  author: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
  attachments: {
    where: { deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: leadNoteAttachmentSelect,
  },
} satisfies Prisma.LeadNoteInclude;

const buildAttachmentDownloadUrl = (
  leadId: string,
  noteId: string,
  attachmentId: string,
) => `/api/leads/${leadId}/notes/${noteId}/attachments/${attachmentId}/download`;

const mapLeadNote = (
  leadId: string,
  note: Prisma.LeadNoteGetPayload<{ include: typeof leadNoteInclude }>,
) => ({
  id: note.id,
  content: note.content,
  createdAt: note.createdAt,
  updatedAt: note.updatedAt,
  author: note.author
    ? {
        id: note.author.id,
        fullName: note.author.fullName,
        email: note.author.email,
      }
    : null,
  attachments: note.attachments.map((attachment) => ({
    id: attachment.id,
    originalName: attachment.originalName,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    downloadUrl: buildAttachmentDownloadUrl(leadId, note.id, attachment.id),
    storageProvider: attachment.storageProvider,
    createdAt: attachment.createdAt,
  })),
});

const allowedTransitions: Record<LeadStatus, LeadStatus[]> = {
  NEW_LEAD: [LeadStatus.LEAD_TAKEN, LeadStatus.BANK_REJECTED],
  LEAD_TAKEN: [LeadStatus.GET_INFO, LeadStatus.BANK_REJECTED, LeadStatus.NEW_LEAD],
  GET_INFO: [LeadStatus.WAITING_FOR_BANK, LeadStatus.BANK_REJECTED, LeadStatus.CLIENT_REJECTED],
  WAITING_FOR_BANK: [LeadStatus.WAITING_FOR_APPROVAL, LeadStatus.BANK_REJECTED],
  WAITING_FOR_APPROVAL: [LeadStatus.CLIENT_ACCEPTED, LeadStatus.CLIENT_REJECTED],
  BANK_REJECTED: [LeadStatus.GET_INFO, LeadStatus.NEW_LEAD],
  CLIENT_ACCEPTED: [LeadStatus.AGREEMENT_SIGNED, LeadStatus.CLIENT_REJECTED],
  CLIENT_REJECTED: [LeadStatus.GET_INFO],
  AGREEMENT_SIGNED: [],
};

export interface CreateLeadInput {
  partnerId: string;
  sourceMetadata?: Record<string, unknown>;
  notes?: string;
  createdByUserId?: string | null;
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
}

export const createLead = async (input: CreateLeadInput) => {
  try {
    const lead = await prisma.lead.create({
      data: {
        partnerId: input.partnerId,
        status: LeadStatus.NEW_LEAD,
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
  assignedUserId?: string | null;
  createdByUserId?: string;
  search?: string;
  skip: number;
  take: number;
}

export const listLeads = async (filters: LeadListFilters) => {
  const where: Prisma.LeadWhereInput = {};

  if (filters.status?.length) {
    where.status = { in: filters.status };
  }

  if (typeof filters.assignedUserId !== "undefined") {
    if (filters.assignedUserId === null) {
      where.assignedUserId = null;
    } else {
      where.assignedUserId = filters.assignedUserId;
    }
  }

  if (filters.partnerId) {
    where.partnerId = filters.partnerId;
  }

  if (filters.createdByUserId) {
    where.createdByUserId = filters.createdByUserId;
  }

  if (filters.search) {
    const searchTerm = filters.search.trim();
    if (searchTerm) {
      where.OR = [
        { customerProfile: { firstName: { contains: searchTerm, mode: "insensitive" } } },
        { customerProfile: { lastName: { contains: searchTerm, mode: "insensitive" } } },
        { customerProfile: { email: { contains: searchTerm, mode: "insensitive" } } },
        { customerProfile: { phone: { contains: searchTerm, mode: "insensitive" } } },
      ];
    }
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

  return {
    items,
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
      financingApps: {
        orderBy: { createdAt: "desc" },
      },
      documents: {
        orderBy: { uploadedAt: "desc" },
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
      leadNotes: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        include: leadNoteInclude,
      },
    },
  });

  if (!lead) {
    return null;
  }

  const { leadNotes, ...rest } = lead;

  return {
    ...rest,
    leadNotes: leadNotes.map((note) => mapLeadNote(lead.id, note)),
  };
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

    if (input.targetStatus === LeadStatus.LEAD_TAKEN) {
      data.assignedUserId = input.assignToUserId ?? input.userId;
      data.claimedAt = new Date();
    }

    if (input.targetStatus === LeadStatus.NEW_LEAD) {
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

export interface CreateLeadNoteInput {
  leadId: string;
  authorId: string;
  content: string;
  attachments: Array<{
    originalName: string;
    mimeType?: string | null;
    sizeBytes: number;
    storageProvider: string;
    storageKey?: string | null;
    publicUrl?: string | null;
  }>;
}

export const createLeadNote = async (input: CreateLeadNoteInput) => {
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
        content: input.content,
        authorId: input.authorId,
        attachments: input.attachments.length
          ? {
              create: input.attachments.map((attachment) => ({
                leadId: input.leadId,
                originalName: attachment.originalName,
                mimeType: attachment.mimeType ?? null,
                sizeBytes: attachment.sizeBytes,
                storageProvider: attachment.storageProvider,
                storageKey: attachment.storageKey ?? null,
                publicUrl: attachment.publicUrl ?? null,
              })),
            }
          : undefined,
      },
      include: leadNoteInclude,
    });

    await tx.auditLog.create({
      data: {
        leadId: input.leadId,
        userId: input.authorId,
        action: "note_created",
        field: "leadNote",
        newValue: {
          id: note.id,
          content: input.content,
          attachments: note.attachments.map((attachment) => ({
            id: attachment.id,
            originalName: attachment.originalName,
          })),
        } as Prisma.InputJsonValue,
      },
    });

    return mapLeadNote(input.leadId, note);
  });
};

export interface DeleteLeadNoteInput {
  leadId: string;
  noteId: string;
  actorUserId: string;
}

export const deleteLeadNote = async (input: DeleteLeadNoteInput) => {
  return prisma.$transaction(async (tx) => {
    const note = await tx.leadNote.findFirst({
      where: {
        id: input.noteId,
        leadId: input.leadId,
        deletedAt: null,
      },
      include: {
        attachments: {
          where: { deletedAt: null },
          select: {
            id: true,
            storageProvider: true,
            storageKey: true,
          },
        },
      },
    });

    if (!note) {
      const error = new Error("Lead note not found");
      (error as Error & { status: number }).status = 404;
      throw error;
    }

    const deletedAt = new Date();

    await tx.leadNoteAttachment.updateMany({
      where: { noteId: input.noteId },
      data: { deletedAt },
    });

    await tx.leadNote.update({
      where: { id: input.noteId },
      data: { deletedAt },
    });

    await tx.auditLog.create({
      data: {
        leadId: input.leadId,
        userId: input.actorUserId,
        action: "note_deleted",
        field: "leadNote",
        oldValue: {
          id: note.id,
          content: note.content,
        } as Prisma.InputJsonValue,
        newValue: { deletedAt: deletedAt.toISOString() } as Prisma.InputJsonValue,
      },
    });

    return {
      deletedAt,
      attachmentIds: note.attachments.map((attachment) => attachment.id),
    };
  });
};

export const findLeadNoteAttachment = async (
  leadId: string,
  noteId: string,
  attachmentId: string,
) => {
  return prisma.leadNoteAttachment.findFirst({
    where: {
      id: attachmentId,
      leadId,
      noteId,
      deletedAt: null,
      note: {
        deletedAt: null,
      },
    },
    include: {
      note: {
        select: {
          id: true,
          leadId: true,
          deletedAt: true,
          lead: {
            select: {
              id: true,
              partnerId: true,
              createdByUserId: true,
            },
          },
        },
      },
    },
  });
};

export { buildAttachmentDownloadUrl };
