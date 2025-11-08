import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://user:pass@localhost:5432/db";
process.env.JWT_SECRET = process.env.JWT_SECRET ?? "testsecret987654321";
process.env.CORS_ORIGIN = "*";

vi.mock("../../services/consent.service.js", () => ({
  listConsentTemplates: vi.fn(),
  recordConsentBatch: vi.fn(),
}));

const consentService = await import("../../services/consent.service.js");
const listConsentTemplatesMock = consentService
  .listConsentTemplates as vi.MockedFunction<typeof consentService.listConsentTemplates>;
const recordConsentBatchMock = consentService
  .recordConsentBatch as vi.MockedFunction<typeof consentService.recordConsentBatch>;
const { createApp } = await import("../../app.js");

describe("Consent routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns consent templates with filters", async () => {
    const fakeTemplates = [
      {
        id: "tpl_1",
        consentType: "MARKETING",
        formType: "financing_application",
        title: "Marketing zgoda",
        content: "lorem",
        helpText: null,
        version: 3,
        validFrom: new Date(),
        validTo: null,
        isActive: true,
        isRequired: true,
        tags: [],
        createdByUserId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    listConsentTemplatesMock.mockResolvedValue(fakeTemplates as never);

    const app = createApp();
    const response = await request(app).get(
      "/api/consent-templates?form_type=financing_application&include_inactive=true",
    );

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(listConsentTemplatesMock).toHaveBeenCalledWith({
      formType: "financing_application",
      includeInactive: true,
    });
  });

  it("creates consent records", async () => {
    recordConsentBatchMock.mockResolvedValue({ processed: 2 } as never);

    const app = createApp();
    const response = await request(app)
      .post("/api/consent-records")
      .send({
        applicationFormId: "cjld2cjxh0000qzrmn831i7rn",
        leadId: "cjld2cjxh0001qzrmn831i7rn",
        accessCodeHash: "hashhash",
        consents: [
          {
            consentTemplateId: "cjld2cjxh0002qzrmn831i7rn",
            version: 1,
            consentGiven: true,
            consentMethod: "online_form",
          },
          {
            consentTemplateId: "cjld2cjxh0003qzrmn831i7rn",
            version: 2,
            consentGiven: true,
            consentMethod: "partner_submission",
          },
        ],
      });

    expect(response.status).toBe(201);
    expect(response.body.processed).toBe(2);
    expect(recordConsentBatchMock).toHaveBeenCalledWith({
      applicationFormId: "cjld2cjxh0000qzrmn831i7rn",
      leadId: "cjld2cjxh0001qzrmn831i7rn",
      accessCodeHash: "hashhash",
      ipAddress: undefined,
      userAgent: undefined,
      consents: [
        {
          consentTemplateId: "cjld2cjxh0002qzrmn831i7rn",
          consentGiven: true,
          version: 1,
          consentMethod: "ONLINE_FORM",
          acceptedAt: undefined,
          consentText: undefined,
        },
        {
          consentTemplateId: "cjld2cjxh0003qzrmn831i7rn",
          consentGiven: true,
          version: 2,
          consentMethod: "PARTNER_SUBMISSION",
          acceptedAt: undefined,
          consentText: undefined,
        },
      ],
    });
  });

  it("returns error payload from service", async () => {
    const error = new Error("Template outdated") as Error & { status?: number; code?: string };
    error.status = 409;
    error.code = "TEMPLATE_OUTDATED";
    recordConsentBatchMock.mockRejectedValue(error);

    const app = createApp();
    const response = await request(app)
      .post("/api/consent-records")
      .send({
        applicationFormId: "cjld2cjxh0000qzrmn831i7rn",
        leadId: "cjld2cjxh0001qzrmn831i7rn",
        accessCodeHash: "hashhash",
        consents: [
          {
            consentTemplateId: "cjld2cjxh0002qzrmn831i7rn",
            version: 1,
            consentGiven: true,
          },
        ],
      });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("TEMPLATE_OUTDATED");
  });
});
