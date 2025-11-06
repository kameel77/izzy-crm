import { UserRole } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { prisma } from "../../lib/prisma.js";
import {
  createLeadNote,
  listLeadNotes,
} from "../lead-note.service.js";

afterEach(() => {
  vi.restoreAllMocks();
});

const operatorUser: Express.UserPayload = {
  id: "user-1",
  email: "operator@example.com",
  role: UserRole.OPERATOR,
};

describe("lead-note.service", () => {
  it("rejects creation when actor lacks permissions", async () => {
    await expect(
      createLeadNote(undefined, {
        leadId: "lead-1",
        content: "Test",
      }),
    ).rejects.toMatchObject({ status: 403 });

    const unauthorizedUser: Express.UserPayload = {
      id: "user-2",
      email: "partner@example.com",
      role: UserRole.PARTNER,
    };

    await expect(
      createLeadNote(unauthorizedUser, {
        leadId: "lead-1",
        content: "Test",
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("creates a lead note when actor is permitted", async () => {
    const findUniqueSpy = vi
      .spyOn(prisma.lead, "findUnique")
      .mockResolvedValue({ id: "lead-1" } as unknown as Awaited<
        ReturnType<typeof prisma.lead.findUnique>
      >);

    const createdNote = {
      id: "note-1",
      leadId: "lead-1",
      authorId: operatorUser.id,
      content: "Follow up",
      url: null,
      createdAt: new Date(),
      author: {
        id: operatorUser.id,
        fullName: "Operator",
        email: operatorUser.email,
      },
    } satisfies Awaited<ReturnType<typeof createLeadNote>>;

    const createSpy = vi
      .spyOn(prisma.leadNoteEntry, "create")
      .mockResolvedValue(
        createdNote as unknown as Awaited<
          ReturnType<typeof prisma.leadNoteEntry.create>
        >,
      );

    const result = await createLeadNote(operatorUser, {
      leadId: "lead-1",
      content: "Follow up",
    });

    expect(findUniqueSpy).toHaveBeenCalledWith({
      where: { id: "lead-1" },
      select: { id: true },
    });

    expect(createSpy).toHaveBeenCalledWith({
      data: {
        leadId: "lead-1",
        authorId: operatorUser.id,
        content: "Follow up",
        url: undefined,
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

    expect(result).toEqual(createdNote);
  });

  it("throws a 404 when the lead is missing", async () => {
    vi.spyOn(prisma.lead, "findUnique").mockResolvedValue(
      null as unknown as Awaited<ReturnType<typeof prisma.lead.findUnique>>,
    );

    await expect(
      createLeadNote(operatorUser, {
        leadId: "missing",
        content: "Test",
      }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("lists lead notes using the requested sort order", async () => {
    vi.spyOn(prisma.lead, "findUnique").mockResolvedValue({
      id: "lead-1",
    } as unknown as Awaited<ReturnType<typeof prisma.lead.findUnique>>);

    const notes = [
      {
        id: "note-1",
        leadId: "lead-1",
        authorId: operatorUser.id,
        content: "Follow up",
        url: null,
        createdAt: new Date(),
        author: {
          id: operatorUser.id,
          fullName: "Operator",
          email: operatorUser.email,
        },
      },
    ] satisfies Awaited<ReturnType<typeof listLeadNotes>>;

    const findManySpy = vi
      .spyOn(prisma.leadNoteEntry, "findMany")
      .mockResolvedValue(
        notes as unknown as Awaited<
          ReturnType<typeof prisma.leadNoteEntry.findMany>
        >,
      );

    const result = await listLeadNotes(operatorUser, "lead-1", { sort: "asc" });

    expect(findManySpy).toHaveBeenCalledWith({
      where: { leadId: "lead-1" },
      include: {
        author: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    expect(result).toEqual(notes);
  });

  it("defaults to descending order when no sort is provided", async () => {
    vi.spyOn(prisma.lead, "findUnique").mockResolvedValue({
      id: "lead-1",
    } as unknown as Awaited<ReturnType<typeof prisma.lead.findUnique>>);

    const findManySpy = vi
      .spyOn(prisma.leadNoteEntry, "findMany")
      .mockResolvedValue(
        [] as unknown as Awaited<ReturnType<typeof prisma.leadNoteEntry.findMany>>,
      );

    await listLeadNotes(operatorUser, "lead-1");

    expect(findManySpy).toHaveBeenCalledWith({
      where: { leadId: "lead-1" },
      include: {
        author: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  });
});
