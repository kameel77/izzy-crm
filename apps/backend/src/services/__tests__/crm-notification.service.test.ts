import { EmailLogStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://user:pass@localhost:5432/db";
process.env.JWT_SECRET = process.env.JWT_SECRET ?? "testsecret987654321";
process.env.CRM_WEBHOOK_URL = "https://crm.example.com/webhook";
process.env.CRM_WEBHOOK_TOKEN = "token123";

const prismaMock = {
  emailLog: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  leadNote: {
    create: vi.fn(),
  },
};

const fetchMock = vi.fn();

vi.mock("../../lib/prisma.js", () => ({
  prisma: prismaMock,
}));

vi.mock("undici", () => ({
  fetch: fetchMock,
}));

describe("notifyApplicationReadyForReview", () => {
  const loadModule = async () => {
    const module = await import("../crm-notification.service.js");
    return module.notifyApplicationReadyForReview;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips webhook when notification already logged", async () => {
    prismaMock.emailLog.findFirst.mockResolvedValue({ id: "existing" });

    const notify = await loadModule();
    await notify({
      applicationFormId: "form_1",
      leadId: "lead_1",
      consents: [],
    });

    expect(prismaMock.emailLog.create).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("creates log, note and delivers webhook", async () => {
    prismaMock.emailLog.findFirst.mockResolvedValue(null);
    prismaMock.leadNote.create.mockResolvedValue({ id: "note_1" });
    prismaMock.emailLog.create.mockResolvedValue({ id: "log_1" });
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "",
    });

    const notify = await loadModule();
    await notify({
      applicationFormId: "form_2",
      leadId: "lead_2",
      consents: [
        {
          consentTemplateId: "tpl_1",
          version: 2,
          consentGiven: true,
          consentType: "MARKETING",
        },
      ],
      ipAddress: "127.0.0.1",
      userAgent: "Mozilla",
    });

    expect(prismaMock.leadNote.create).toHaveBeenCalled();
    expect(prismaMock.emailLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          applicationFormId: "form_2",
          type: expect.any(String),
          noteId: "note_1",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://crm.example.com/webhook",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(prismaMock.emailLog.update).toHaveBeenCalledWith({
      where: { id: "log_1" },
      data: { status: EmailLogStatus.DELIVERED },
    });
  });
});
