import express from "express";
import request from "supertest";
import { UserRole } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { leadRouter } from "../lead.routes.js";
import { errorHandler } from "../../middlewares/errorHandler.js";
import {
  createLeadNote,
  listLeadNotes,
} from "../../services/lead-note.service.js";

vi.mock("../../services/lead-note.service.js", () => ({
  createLeadNote: vi.fn(),
  listLeadNotes: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

const mockedCreateLeadNote = vi.mocked(createLeadNote);
const mockedListLeadNotes = vi.mocked(listLeadNotes);

const setupApp = (role: UserRole) => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = {
      id: "user-1",
      email: "user@example.com",
      role,
    };
    next();
  });
  app.use("/", leadRouter);
  app.use(errorHandler);
  return app;
};

describe("lead notes routes", () => {
  it("creates a lead note for operators", async () => {
    const app = setupApp(UserRole.OPERATOR);
    const note = {
      id: "note-1",
      leadId: "lead-123",
      authorId: "user-1",
      content: "Follow up",
      url: null,
      createdAt: new Date().toISOString(),
      author: {
        id: "user-1",
        fullName: "Operator",
        email: "user@example.com",
      },
    };
    mockedCreateLeadNote.mockResolvedValue(
      note as unknown as Awaited<ReturnType<typeof createLeadNote>>,
    );

    const response = await request(app)
      .post("/lead-123/notes")
      .send({ content: "Follow up" })
      .expect(201);

    expect(response.body).toEqual(note);
    expect(mockedCreateLeadNote).toHaveBeenCalledWith(
      expect.objectContaining({ id: "user-1" }),
      {
        leadId: "lead-123",
        content: "Follow up",
        url: undefined,
      },
    );
  });

  it("rejects users without the proper role", async () => {
    const app = setupApp(UserRole.PARTNER);

    await request(app)
      .post("/lead-123/notes")
      .send({ content: "Follow up" })
      .expect(403, { message: "Forbidden" });

    expect(mockedCreateLeadNote).not.toHaveBeenCalled();
  });

  it("returns lead notes", async () => {
    const app = setupApp(UserRole.ADMIN);
    const notes = [
      {
        id: "note-1",
        leadId: "lead-123",
        authorId: "user-1",
        content: "Follow up",
        url: null,
        createdAt: new Date().toISOString(),
        author: {
          id: "user-1",
          fullName: "Operator",
          email: "user@example.com",
        },
      },
    ];
    mockedListLeadNotes.mockResolvedValue(
      notes as unknown as Awaited<ReturnType<typeof listLeadNotes>>,
    );

    const response = await request(app)
      .get("/lead-123/notes?sort=asc")
      .expect(200);

    expect(response.body).toEqual({ data: notes });
    expect(mockedListLeadNotes).toHaveBeenCalledWith(
      expect.objectContaining({ id: "user-1" }),
      "lead-123",
      { sort: "asc" },
    );
  });

  it("validates incoming payloads", async () => {
    const app = setupApp(UserRole.OPERATOR);

    const response = await request(app)
      .post("/lead-123/notes")
      .send({ content: "" })
      .expect(400);

    expect(response.body).toMatchObject({ message: "Validation failed" });
    expect(mockedCreateLeadNote).not.toHaveBeenCalled();
  });
});
