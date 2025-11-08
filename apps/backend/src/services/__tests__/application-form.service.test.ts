import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://user:pass@localhost:5432/db";
process.env.JWT_SECRET = process.env.JWT_SECRET ?? "testsecret987654321";

const mockPrisma = {
  applicationForm: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  leadNote: {
    create: vi.fn(),
  },
  emailLog: {
    create: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
};

vi.mock("../../lib/prisma.js", () => ({ prisma: mockPrisma }));
vi.mock("crypto", () => ({
  randomBytes: () => Buffer.from("0123456789abcdef0123456789abcdef"),
}));

const { unlockApplicationForm } = await import("../application-form.service.js");

describe("unlockApplicationForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when form missing", async () => {
    mockPrisma.applicationForm.findUnique.mockResolvedValue(null);

    await expect(
      unlockApplicationForm({
        applicationFormId: "form_missing",
        actorUserId: "admin_1",
      }),
    ).rejects.toThrowError("Application form not found");
  });

  it("updates form, note and logs", async () => {
    mockPrisma.applicationForm.findUnique.mockResolvedValue({
      id: "form_1",
      leadId: "lead_1",
      status: "LOCKED",
      unlockHistory: [],
    });

    mockPrisma.applicationForm.update.mockResolvedValue({
      id: "form_1",
      leadId: "lead_1",
      status: "IN_PROGRESS",
      uniqueLink: "newlink",
      linkExpiresAt: new Date(),
    });

    mockPrisma.leadNote.create.mockResolvedValue({ id: "note_1" });
    mockPrisma.emailLog.create.mockResolvedValue({ id: "log_1" });

    const result = await unlockApplicationForm({
      applicationFormId: "form_1",
      actorUserId: "admin_1",
      reason: "Need new docs",
    });

    expect(result.id).toBe("form_1");
    expect(mockPrisma.leadNote.create).toHaveBeenCalled();
    expect(mockPrisma.emailLog.create).toHaveBeenCalled();
    expect(mockPrisma.auditLog.create).toHaveBeenCalled();
  });
});
