import {
  ApplicationFormStatus,
  ConsentMethod,
  ConsentTemplate,
} from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { createHttpError } from "../utils/httpError.js";

const DEFAULT_FORM_TYPE = "financing_application";

export type ListConsentTemplatesParams = {
  formType?: string;
  includeInactive?: boolean;
};

export const listConsentTemplates = async (
  params: ListConsentTemplatesParams = {},
): Promise<ConsentTemplate[]> => {
  const { formType = DEFAULT_FORM_TYPE, includeInactive = false } = params;

  return prisma.consentTemplate.findMany({
    where: {
      formType,
      ...(includeInactive ? {} : { isActive: true }),
    },
    orderBy: [
      { consentType: "asc" },
      { version: "desc" },
    ],
  });
};

export type RecordConsentInput = {
  consentTemplateId: string;
  version: number;
  consentGiven: boolean;
  consentMethod?: ConsentMethod;
  consentText?: string;
  acceptedAt?: Date;
};

export type RecordConsentPayload = {
  applicationFormId: string;
  leadId: string;
  ipAddress?: string;
  userAgent?: string;
  accessCodeHash: string;
  consents: RecordConsentInput[];
};

const createConsentError = (status: number, code: string, message: string) =>
  createHttpError({ status, code, message });

export const recordConsentBatch = async (payload: RecordConsentPayload) => {
  if (!payload.consents.length) {
    throw createConsentError(400, "REQUIRED_CONSENT_MISSING", "No consents supplied");
  }

  const form = await prisma.applicationForm.findUnique({
    where: { id: payload.applicationFormId },
  });

  if (!form || form.leadId !== payload.leadId) {
    throw createConsentError(410, "LINK_EXPIRED", "Form link is invalid or expired");
  }

  if (form.linkExpiresAt && form.linkExpiresAt < new Date()) {
    throw createConsentError(410, "LINK_EXPIRED", "Form link expired");
  }

  if (form.status === ApplicationFormStatus.LOCKED) {
    throw createConsentError(409, "LINK_EXPIRED", "Form is locked for edits");
  }

  const templateIds = payload.consents.map((consent) => consent.consentTemplateId);
  const uniqueTemplateIds = [...new Set(templateIds)];

  const templates = await prisma.consentTemplate.findMany({
    where: { id: { in: uniqueTemplateIds } },
  });

  const templateById = new Map(templates.map((template) => [template.id, template]));

  const recordsData = payload.consents.map((consent) => {
    const template = templateById.get(consent.consentTemplateId);

    if (!template || !template.isActive) {
      throw createConsentError(422, "REQUIRED_CONSENT_MISSING", "Consent template missing or inactive");
    }

    if (template.version !== consent.version) {
      throw createConsentError(409, "TEMPLATE_OUTDATED", `Consent template ${template.id} is outdated`);
    }

    if (template.isRequired && !consent.consentGiven) {
      throw createConsentError(422, "REQUIRED_CONSENT_MISSING", `Required consent ${template.id} must be accepted`);
    }

    const recordedAt = consent.acceptedAt ?? new Date();

    return {
      consentTemplateId: template.id,
      consentType: template.consentType,
      consentGiven: consent.consentGiven,
      consentMethod: consent.consentMethod ?? ConsentMethod.ONLINE_FORM,
      consentText: consent.consentText ?? template.content,
      helpTextSnapshot: template.helpText ?? null,
      version: template.version,
      recordedAt,
    };
  });

  await prisma.$transaction(async (tx) => {
    await tx.applicationForm.update({
      where: { id: payload.applicationFormId },
      data: {
        ipAddress: payload.ipAddress ?? form.ipAddress,
        userAgent: payload.userAgent ?? form.userAgent,
      },
    });

    for (const record of recordsData) {
      await tx.consentRecord.upsert({
        where: {
          applicationFormId_consentTemplateId_version: {
            applicationFormId: payload.applicationFormId,
            consentTemplateId: record.consentTemplateId,
            version: record.version,
          },
        },
        update: {
          consentGiven: record.consentGiven,
          consentMethod: record.consentMethod,
          consentText: record.consentText,
          helpTextSnapshot: record.helpTextSnapshot,
          ipAddress: payload.ipAddress,
          userAgent: payload.userAgent,
          recordedAt: record.recordedAt,
          accessCodeHash: payload.accessCodeHash,
        },
        create: {
          consentTemplateId: record.consentTemplateId,
          consentType: record.consentType,
          applicationFormId: payload.applicationFormId,
          leadId: payload.leadId,
          consentGiven: record.consentGiven,
          consentMethod: record.consentMethod,
          ipAddress: payload.ipAddress,
          userAgent: payload.userAgent,
          recordedAt: record.recordedAt,
          version: record.version,
          consentText: record.consentText,
          accessCodeHash: payload.accessCodeHash,
          helpTextSnapshot: record.helpTextSnapshot,
        },
      });
    }
  });

  return { processed: recordsData.length };
};
