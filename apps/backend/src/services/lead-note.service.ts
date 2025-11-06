import { Prisma, UserRole } from "@prisma/client";

import { prisma } from "../lib/prisma.js";

const LEAD_NOTE_AUTHOR_SELECT = {
  id: true,
  fullName: true,
  email: true,
} as const;

export type LeadNoteWithAuthor = Prisma.LeadNoteGetPayload<{
  include: {
    author: {
      select: typeof LEAD_NOTE_AUTHOR_SELECT;
    };
  };
}>;

export const LEAD_NOTE_ALLOWED_ROLES = [
  UserRole.OPERATOR,
  UserRole.ADMIN,
] as const;

type LeadNoteAllowedRole = (typeof LEAD_NOTE_ALLOWED_ROLES)[number];

const isLeadNoteAllowedRole = (role: UserRole): role is LeadNoteAllowedRole =>
  LEAD_NOTE_ALLOWED_ROLES.some((allowedRole) => allowedRole === role);

type Actor = Express.UserPayload | undefined;

const ensureCanManageLeadNotes = (actor: Actor) => {
  if (!actor || !isLeadNoteAllowedRole(actor.role)) {
    const error = new Error("Forbidden");
    (error as Error & { status: number }).status = 403;
    throw error;
  }
};

const ensureLeadExists = async (leadId: string) => {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true },
  });

  if (!lead) {
    const error = new Error("Lead not found");
    (error as Error & { status: number }).status = 404;
    throw error;
  }
};

export interface CreateLeadNoteInput {
  leadId: string;
  content: string;
  url?: string;
}

export const createLeadNote = async (
  actor: Actor,
  input: CreateLeadNoteInput,
): Promise<LeadNoteWithAuthor> => {
  ensureCanManageLeadNotes(actor);
  await ensureLeadExists(input.leadId);

  return prisma.leadNote.create({
    data: {
      leadId: input.leadId,
      authorId: actor!.id,
      content: input.content,
      url: input.url,
    },
    include: {
      author: {
        select: LEAD_NOTE_AUTHOR_SELECT,
      },
    },
  });
};

export interface ListLeadNotesOptions {
  sort?: "asc" | "desc";
}

export const listLeadNotes = async (
  actor: Actor,
  leadId: string,
  options: ListLeadNotesOptions = {},
): Promise<LeadNoteWithAuthor[]> => {
  ensureCanManageLeadNotes(actor);
  await ensureLeadExists(leadId);

  const sortOrder = options.sort ?? "desc";

  return prisma.leadNote.findMany({
    where: { leadId },
    include: {
      author: {
        select: LEAD_NOTE_AUTHOR_SELECT,
      },
    },
    orderBy: {
      createdAt: sortOrder,
    },
  });
};
