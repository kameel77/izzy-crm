import { Prisma } from "@prisma/client";

import { prisma } from "../lib/prisma.js";

const noteInclude = {
  author: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
  tags: {
    include: {
      tag: {
        select: {
          id: true,
          name: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  },
} satisfies Prisma.LeadNoteInclude;

type NoteWithRelations = Prisma.LeadNoteGetPayload<{ include: typeof noteInclude }>;

export interface LeadNoteTagView {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LeadNoteView {
  id: string;
  leadId: string;
  authorId: string | null;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  author:
    | {
        id: string;
        fullName: string;
        email: string;
      }
    | null;
  tags: LeadNoteTagView[];
}

const serializeNote = (note: NoteWithRelations): LeadNoteView => ({
  id: note.id,
  leadId: note.leadId,
  authorId: note.authorId,
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
  tags: note.tags.map((assignment) => ({
    id: assignment.tag.id,
    name: assignment.tag.name,
    createdAt: assignment.tag.createdAt,
    updatedAt: assignment.tag.updatedAt,
  })),
});

const ensureTagIdsExist = async (
  tx: Prisma.TransactionClient,
  tagIds: string[] | undefined,
) => {
  if (!tagIds || tagIds.length === 0) {
    return;
  }

  const uniqueIds = Array.from(new Set(tagIds));
  const found = await tx.leadNoteTag.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true },
  });

  if (found.length !== uniqueIds.length) {
    const error = new Error("One or more tags could not be found");
    (error as Error & { status?: number }).status = 400;
    throw error;
  }
};

export const listLeadNotes = async (
  leadId: string,
  options?: { tagIds?: string[] },
): Promise<LeadNoteView[]> => {
  const notes = await prisma.leadNote.findMany({
    where: {
      leadId,
      ...(options?.tagIds && options.tagIds.length
        ? { tags: { some: { tagId: { in: options.tagIds } } } }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    include: noteInclude,
  });

  return notes.map(serializeNote);
};

export const createLeadNote = async (input: {
  leadId: string;
  authorId?: string | null;
  content: string;
  tagIds?: string[];
}): Promise<LeadNoteView> => {
  const tagIds = input.tagIds ? Array.from(new Set(input.tagIds)) : [];

  return prisma.$transaction(async (tx) => {
    await ensureTagIdsExist(tx, tagIds);

    const note = await tx.leadNote.create({
      data: {
        leadId: input.leadId,
        authorId: input.authorId ?? null,
        content: input.content,
        tags:
          tagIds.length
            ? {
                createMany: {
                  data: tagIds.map((tagId) => ({ tagId })),
                },
              }
            : undefined,
      },
      include: noteInclude,
    });

    return serializeNote(note);
  });
};

export const updateLeadNote = async (
  noteId: string,
  input: {
    leadId: string;
    content?: string;
    tagIds?: string[];
  },
): Promise<LeadNoteView> => {
  const tagIds = typeof input.tagIds === "undefined" ? undefined : Array.from(new Set(input.tagIds));

  return prisma.$transaction(async (tx) => {
    const existing = await tx.leadNote.findFirst({
      where: { id: noteId, leadId: input.leadId },
      select: { id: true },
    });

    if (!existing) {
      const error = new Error("Lead note not found");
      (error as Error & { status?: number }).status = 404;
      throw error;
    }

    if (typeof input.content !== "undefined") {
      await tx.leadNote.update({
        where: { id: noteId },
        data: { content: input.content },
      });
    }

    if (typeof tagIds !== "undefined") {
      await ensureTagIdsExist(tx, tagIds);

      await tx.leadNoteTagAssignment.deleteMany({
        where: {
          noteId,
          NOT: tagIds.length ? { tagId: { in: tagIds } } : undefined,
        },
      });

      if (tagIds.length) {
        await tx.leadNoteTagAssignment.createMany({
          data: tagIds.map((tagId) => ({ noteId, tagId })),
        });
      }
    }

    const updated = await tx.leadNote.findUnique({
      where: { id: noteId },
      include: noteInclude,
    });

    if (!updated) {
      const error = new Error("Lead note not found");
      (error as Error & { status?: number }).status = 404;
      throw error;
    }

    return serializeNote(updated);
  });
};

export const deleteLeadNote = async (noteId: string, leadId: string): Promise<void> => {
  const existing = await prisma.leadNote.findFirst({
    where: { id: noteId, leadId },
    select: { id: true },
  });

  if (!existing) {
    const error = new Error("Lead note not found");
    (error as Error & { status?: number }).status = 404;
    throw error;
  }

  await prisma.leadNote.delete({
    where: { id: noteId },
  });
};
