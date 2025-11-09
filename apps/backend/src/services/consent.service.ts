import {
  ApplicationFormStatus,
  ConsentMethod,
  ConsentTemplate,
  ConsentType,
} from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { createHttpError } from "../utils/httpError.js";
import { notifyApplicationReadyForReview } from "./crm-notification.service.js";

const DEFAULT_FORM_TYPE = "financing_application";
const CACHE_TTL_MS = 5 * 60 * 1000;
const STALE_WARNING_MS = 15 * 60 * 1000;

type TemplateCacheEntry = {
  data: ConsentTemplate[];
  expiresAt: number;
  fetchedAt: number;
  warned: boolean;
};

const templateCache = new Map<string, TemplateCacheEntry>();
const templateCacheStats = {
  hits: 0,
  misses: 0,
  lastWarningTs: 0,
};

const buildCacheKey = (formType: string, includeInactive: boolean) =>
  `${formType}:${includeInactive}`;

export const getConsentTemplateCacheStats = () => ({
  ...templateCacheStats,
});

export type ListConsentTemplatesParams = {
  formType?: string;
  includeInactive?: boolean;
  applicationFormId?: string;
  leadId?: string;
};

export const listConsentTemplates = async (
  params: ListConsentTemplatesParams = {},
): Promise<ConsentTemplate[]> => {
  const { formType = DEFAULT_FORM_TYPE, includeInactive = false } = params;
  const cacheKey = buildCacheKey(formType, includeInactive);
  const now = Date.now();
  const cached = templateCache.get(cacheKey);

  if (cached && cached.expiresAt > now) {
    templateCacheStats.hits += 1;
    if (!cached.warned && now - cached.fetchedAt > STALE_WARNING_MS) {
      cached.warned = true;
      templateCacheStats.lastWarningTs = now;
      console.warn(
        `[consent-cache] Consent template cache for ${cacheKey} older than 15 minutes – consider refreshing source data`,
      );
    }
    return cached.data;
  }

  templateCacheStats.misses += 1;

  const templates = await prisma.consentTemplate.findMany({
    where: {
      formType,
      ...(includeInactive ? {} : { isActive: true }),
    },
    orderBy: [
      { consentType: "asc" },
      { version: "desc" },
    ],
  });

  templateCache.set(cacheKey, {
    data: templates,
    expiresAt: now + CACHE_TTL_MS,
    fetchedAt: now,
    warned: false,
  });

  return templates;
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

const createConsentError = (
  status: number,
  code: string,
  message: string,
  meta?: Record<string, unknown>,
  retryAfterSeconds?: number,
) => createHttpError({ status, code, message, meta, retryAfterSeconds });

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
      throw createConsentError(
        409,
        "TEMPLATE_OUTDATED",
        `Consent template ${template.id} is outdated`,
        { consentTemplateId: template.id, latestVersion: template.version },
        0,
      );
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
        status:
          form.status === ApplicationFormStatus.READY ||
          form.status === ApplicationFormStatus.SUBMITTED
            ? form.status
            : ApplicationFormStatus.READY,
        submittedByClient: true,
        submittedAt: form.submittedAt ?? new Date(),
        isClientActive: false,
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

  await notifyApplicationReadyForReview({
    applicationFormId: payload.applicationFormId,
    leadId: payload.leadId,
    consents: recordsData.map((record) => ({
      consentTemplateId: record.consentTemplateId,
      version: record.version,
      consentGiven: record.consentGiven,
      consentType: record.consentType as ConsentType,
    })),
    ipAddress: payload.ipAddress ?? form.ipAddress,
    userAgent: payload.userAgent ?? form.userAgent,
  });

  return { processed: recordsData.length };
};
