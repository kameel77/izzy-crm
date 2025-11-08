import { Prisma } from "@prisma/client";
import type { LeadNoteTag } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import type { LeadNoteTagView } from "./lead-note.service.js";

const serializeTag = (tag: LeadNoteTag): LeadNoteTagView => ({
  id: tag.id,
  name: tag.name,
  createdAt: tag.createdAt,
  updatedAt: tag.updatedAt,
});

export const listNoteTags = async (): Promise<LeadNoteTagView[]> => {
  const tags = await prisma.leadNoteTag.findMany({
    orderBy: { name: "asc" },
  });

  return tags.map(serializeTag);
};

export const createNoteTag = async (input: { name: string }): Promise<LeadNoteTagView> => {
  try {
    const tag = await prisma.leadNoteTag.create({
      data: {
        name: input.name,
      },
    });

    return serializeTag(tag);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const conflict = new Error("A tag with this name already exists");
      (conflict as Error & { status?: number }).status = 409;
      throw conflict;
    }

    throw error;
  }
};

export const updateNoteTag = async (
  id: string,
  input: { name: string },
): Promise<LeadNoteTagView> => {
  try {
    const tag = await prisma.leadNoteTag.update({
      where: { id },
      data: {
        name: input.name,
      },
    });

    return serializeTag(tag);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        const notFound = new Error("Tag not found");
        (notFound as Error & { status?: number }).status = 404;
        throw notFound;
      }

      if (error.code === "P2002") {
        const conflict = new Error("A tag with this name already exists");
        (conflict as Error & { status?: number }).status = 409;
        throw conflict;
      }
    }

    throw error;
  }
};

export const deleteNoteTag = async (id: string): Promise<void> => {
  const usage = await prisma.leadNoteTagAssignment.count({
    where: { tagId: id },
  });

  if (usage > 0) {
    const error = new Error("Cannot delete tag while it is assigned to notes");
    (error as Error & { status?: number }).status = 400;
    throw error;
  }

  try {
    await prisma.leadNoteTag.delete({
      where: { id },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      const notFound = new Error("Tag not found");
      (notFound as Error & { status?: number }).status = 404;
      throw notFound;
    }

    throw error;
  }
};
