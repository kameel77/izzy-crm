import { Prisma, UserRole, ApplicationFormStatus, EmailLogStatus, EmailLogType, UserStatus, ConsentMethod } from "@prisma/client";
import { randomBytes, createHash } from "crypto";
import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";
import { createHttpError } from "../utils/httpError.js";
import { sendMail } from "./mail.service.js";

export const ensureOperatorCanMutateLead = async (params: {
  leadId: string;
  actorUserId: string;
  actorRole: UserRole;
}) => {
  if (params.actorRole !== UserRole.OPERATOR) {
    return;
  }

  const form = await prisma.applicationForm.findUnique({
    where: { leadId: params.leadId },
    select: {
      id: true,
      isClientActive: true,
      lastClientActivity: true,
    },
  });

  if (!form?.isClientActive) {
    return;
  }

  if (hasClientSessionExpired(form.lastClientActivity)) {
    await releaseClientActivity(form.id);
    return;
  }

  await prisma.auditLog.create({
    data: {
      leadId: params.leadId,
      userId: params.actorUserId,
      action: "CLIENT_ACTIVE_BLOCK",
      metadata: {
        applicationFormId: form.id,
        lastClientActivity: form.lastClientActivity,
      },
    },
  });

  const supervisors = await prisma.user.findMany({
    where: {
      role: UserRole.SUPERVISOR,
      status: UserStatus.ACTIVE,
    },
    select: {
      email: true,
      fullName: true,
    },
  });

  if (supervisors.length) {
    const subject = `Operator blocked for lead ${params.leadId}`;
    const textLines = [
      `Operator userId: ${params.actorUserId}`,
      `LeadId: ${params.leadId}`,
      `ApplicationFormId: ${form.id}`,
      `Last client activity: ${form.lastClientActivity?.toISOString() ?? "unknown"}`,
    ];

    await Promise.all(
      supervisors.map((supervisor) =>
        sendMail({
          to: supervisor.email,
          subject,
          text: textLines.join("\n"),
        }),
      ),
    );
  }

  throw createHttpError({
    status: 409,
    code: "CLIENT_ACTIVE",
    message: "Klient nadal edytuje formularz. Spróbuj ponownie, gdy sesja wygaśnie.",
  });
};

const UNLOCK_TOKEN_BYTES = 16;
const LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const CLIENT_ACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;

const hasClientSessionExpired = (lastActivity: Date | null) => {
  if (!lastActivity) return true;
  return Date.now() - lastActivity.getTime() > CLIENT_ACTIVITY_TIMEOUT_MS;
};

export const releaseClientActivity = async (applicationFormId: string) => {
  await prisma.applicationForm.update({
    where: { id: applicationFormId },
    data: { isClientActive: false },
  });
};

const buildUnlockHistory = (existing: unknown, entry: unknown) => {
  if (Array.isArray(existing)) {
    return [...existing, entry];
  }
  if (typeof existing === "object" && existing !== null) {
    return [existing, entry];
  }
  return [entry];
};

const hashAccessCode = (code: string) => createHash("sha256").update(code).digest("hex");

const VERIFY_RATE_LIMIT_MAX_ATTEMPTS = 5;
const VERIFY_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const verifyFailuresByFormId = new Map<string, number[]>();

const getRecentFailedAttempts = (applicationFormId: string, nowMs: number) => {
  const attempts = verifyFailuresByFormId.get(applicationFormId) ?? [];
  const recentAttempts = attempts.filter((timestamp) => nowMs - timestamp < VERIFY_RATE_LIMIT_WINDOW_MS);
  if (recentAttempts.length > 0) {
    verifyFailuresByFormId.set(applicationFormId, recentAttempts);
  } else {
    verifyFailuresByFormId.delete(applicationFormId);
  }
  return recentAttempts;
};

const registerFailedAttempt = (applicationFormId: string, nowMs: number) => {
  const recentAttempts = getRecentFailedAttempts(applicationFormId, nowMs);
  recentAttempts.push(nowMs);
  verifyFailuresByFormId.set(applicationFormId, recentAttempts);
};

const clearFailedAttempts = (applicationFormId: string) => {
  verifyFailuresByFormId.delete(applicationFormId);
};

type GenerateLinkInput = {
  leadId: string;
  actorUserId: string;
  accessCode: string;
  expiresInDays?: number;
};

export const generateApplicationFormLink = async ({
  leadId,
  actorUserId,
  accessCode,
  expiresInDays = 7,
}: GenerateLinkInput) => {
  if (!accessCode || accessCode.trim().length < 4) {
    throw createHttpError({ status: 400, message: "Access code must have at least 4 characters" });
  }

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      customerProfile: {
        select: {
          email: true,
          firstName: true,
        },
      },
    },
  });

  if (!lead) {
    throw createHttpError({ status: 404, message: "Lead not found" });
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000);
  const uniqueToken = randomBytes(24).toString("hex");
  const accessCodeHash = hashAccessCode(accessCode);

  const form = await prisma.applicationForm.upsert({
    where: { leadId },
    update: {
      status: ApplicationFormStatus.DRAFT,
      uniqueLink: uniqueToken,
      accessCodeHash,
      linkGeneratedAt: now,
      linkExpiresAt: expiresAt,
      createdByUserId: actorUserId,
      isClientActive: false,
      lastClientActivity: null,
      submittedByClient: false,
      submittedAt: null,
      completionPercent: 0,
      currentStep: 1,
    },
    create: {
      leadId,
      status: ApplicationFormStatus.DRAFT,
      uniqueLink: uniqueToken,
      accessCodeHash,
      linkGeneratedAt: now,
      linkExpiresAt: expiresAt,
      createdByUserId: actorUserId,
    },
    select: {
      id: true,
      leadId: true,
      uniqueLink: true,
      linkExpiresAt: true,
    },
  });

  const linkUrl = `${env.app.baseUrl}/client-form/consents?applicationFormId=${form.id}&leadId=${leadId}&hash=${accessCodeHash}`;

  await prisma.leadNote.create({
    data: {
      leadId,
      authorId: actorUserId,
      content: [
        "Wygenerowano link do formularza",
        `Ważny do: ${expiresAt.toISOString()}`,
      ].join("\n"),
    },
  });

  await prisma.emailLog.create({
    data: {
      applicationFormId: form.id,
      leadId,
      type: EmailLogType.LINK_SENT,
      status: EmailLogStatus.SENT,
      sentTo: lead.customerProfile?.email ?? null,
      payload: {
        link: linkUrl,
        expiresAt: expiresAt.toISOString(),
      },
      noteCreated: false,
    },
  });

  await prisma.auditLog.create({
    data: {
      leadId,
      userId: actorUserId,
      action: "APPLICATION_FORM_CREATED",
      metadata: {
        applicationFormId: form.id,
        expiresAt,
      },
    },
  });

  if (lead.customerProfile?.email) {
    await sendMail({
      to: lead.customerProfile.email,
      subject: "Twój link do formularza finansowania",
      text: [
        `Cześć ${lead.customerProfile.firstName ?? ""}`.trim(),
        "",
        "Poniżej znajdziesz link do formularza oraz kod dostępu:",
        linkUrl,
        `Kod: ${accessCode}`,
        `Link wygasa: ${expiresAt.toLocaleString()}`,
      ].join("\n"),
    });
  }

  return {
    applicationFormId: form.id,
    link: linkUrl,
    expiresAt,
    accessCode,
  };
};

export const unlockApplicationForm = async (params: {
  applicationFormId: string;
  actorUserId: string;
  reason?: string;
}) => {
  const form = await prisma.applicationForm.findUnique({
    where: { id: params.applicationFormId },
    select: {
      id: true,
      leadId: true,
      status: true,
      accessCodeHash: true,
      unlockHistory: true,
    },
  });

  if (!form) {
    throw createHttpError({ status: 404, message: "Application form not found" });
  }

  if (form.status === ApplicationFormStatus.LOCKED) {
    // ok – unlocking locked form
  }

  const now = new Date();
  const expiration = new Date(now.getTime() + LINK_TTL_MS);
  const unlockEntry = {
    unlockedBy: params.actorUserId,
    unlockedAt: now.toISOString(),
    reason: params.reason ?? null,
  };

  const updatedForm = await prisma.applicationForm.update({
    where: { id: params.applicationFormId },
    data: {
      status: ApplicationFormStatus.UNLOCKED,
      isClientActive: false,
      lastClientActivity: null,
      uniqueLink: randomBytes(UNLOCK_TOKEN_BYTES).toString("hex"),
      linkGeneratedAt: now,
      linkExpiresAt: expiration,
      unlockHistory: buildUnlockHistory(form.unlockHistory, unlockEntry),
    },
    select: {
      id: true,
      leadId: true,
      status: true,
      uniqueLink: true,
      linkExpiresAt: true,
    },
  });

  // Build link to send to the client (reuse existing accessCodeHash)
  const linkUrl = `${env.app.baseUrl}/client-form/consents?applicationFormId=${updatedForm.id}&leadId=${updatedForm.leadId}&hash=${form.accessCodeHash}`;

  // Enrich unlock history with actor user display data (best-effort)
  const actor = await prisma.user.findUnique({
    where: { id: params.actorUserId },
    select: { id: true, email: true, fullName: true },
  });
  if (actor) {
    await prisma.applicationForm.update({
      where: { id: params.applicationFormId },
      data: {
        unlockHistory: buildUnlockHistory(form.unlockHistory, {
          ...unlockEntry,
          unlockedByUser: {
            id: actor.id,
            email: actor.email,
            fullName: actor.fullName,
          },
        }),
      },
    });
  }

  const note = await prisma.leadNote.create({
    data: {
      leadId: updatedForm.leadId,
      authorId: params.actorUserId,
      content: [
        "Formularz odblokowany",
        params.reason ? `Powód: ${params.reason}` : null,
        `Ważny do: ${expiration.toISOString()}`,
      ]
        .filter(Boolean)
        .join("\n"),
    },
  });

  await prisma.emailLog.create({
    data: {
      applicationFormId: updatedForm.id,
      leadId: updatedForm.leadId,
      type: EmailLogType.UNLOCKED,
      status: EmailLogStatus.SENT,
      payload: {
        reason: params.reason ?? null,
        link: linkUrl,
        expiresAt: expiration.toISOString(),
      },
      noteCreated: true,
      noteId: note.id,
    },
  });

  await prisma.auditLog.create({
    data: {
      leadId: updatedForm.leadId,
      userId: params.actorUserId,
      action: "APPLICATION_FORM_UNLOCK",
      metadata: unlockEntry,
    },
  });

  // Try to deliver email with the refreshed link to the client
  const lead = await prisma.lead.findUnique({
    where: { id: updatedForm.leadId },
    select: {
      customerProfile: {
        select: {
          email: true,
          firstName: true,
        },
      },
    },
  });
  const recipient = lead?.customerProfile?.email;
  if (recipient) {
    await sendMail({
      to: recipient,
      subject: "Twój wniosek został odblokowany – wymagane ponowne potwierdzenie",
      text: [
        `Cześć ${lead?.customerProfile?.firstName ?? ""}`.trim(),
        "",
        "Twój wniosek został odblokowany przez naszego konsultanta w celu weryfikacji/poprawy danych.",
        "Prosimy o ponowne sprawdzenie danych oraz akceptację zgód:",
        linkUrl,
        "",
        `Link wygasa: ${expiration.toLocaleString()}`,
      ].join("\n"),
    });
  }

  return updatedForm;
};

export const verifyApplicationFormAccess = async (params: {
  applicationFormId: string;
  leadId: string;
  code: string;
}) => {
  const now = new Date();
  const nowMs = now.getTime();

  const recentAttempts = getRecentFailedAttempts(params.applicationFormId, nowMs);
  if (recentAttempts.length >= VERIFY_RATE_LIMIT_MAX_ATTEMPTS) {
    throw createHttpError({
      status: 429,
      code: "TOO_MANY_ATTEMPTS",
      message: "Zbyt wiele nieudanych prób. Spróbuj ponownie później.",
    });
  }

  const form = await prisma.applicationForm.findUnique({
    where: { id: params.applicationFormId },
    select: {
      id: true,
      leadId: true,
      status: true,
      accessCodeHash: true,
      linkExpiresAt: true,
    },
  });

  if (!form || form.leadId !== params.leadId || !form.accessCodeHash) {
    registerFailedAttempt(params.applicationFormId, nowMs);
    throw createHttpError({ status: 401, code: "INVALID_CODE", message: "Nieprawidłowy kod dostępu" });
  }

  if (form.linkExpiresAt && form.linkExpiresAt <= now) {
    throw createHttpError({ status: 401, code: "LINK_EXPIRED", message: "Link do formularza wygasł" });
  }

  if (form.status === ApplicationFormStatus.SUBMITTED || form.status === ApplicationFormStatus.LOCKED) {
    throw createHttpError({ status: 401, code: "INVALID_CODE", message: "Formularz jest zablokowany" });
  }

  const providedCodeHash = hashAccessCode(params.code.trim());
  if (providedCodeHash !== form.accessCodeHash) {
    registerFailedAttempt(params.applicationFormId, nowMs);
    throw createHttpError({ status: 401, code: "INVALID_CODE", message: "Nieprawidłowy kod dostępu" });
  }

  clearFailedAttempts(params.applicationFormId);

  await prisma.applicationForm.update({
    where: { id: form.id },
    data: {
      isClientActive: true,
      lastClientActivity: now,
    },
  });

  return { ok: true as const };
};

export const heartbeatApplicationForm = async (applicationFormId: string) => {
  const now = new Date();
  const form = await prisma.applicationForm.findUnique({
    where: { id: applicationFormId },
    select: { id: true },
  });

  if (!form) {
    throw createHttpError({ status: 404, message: "Application form not found" });
  }

  await prisma.applicationForm.update({
    where: { id: applicationFormId },
    data: {
      isClientActive: true,
      lastClientActivity: now,
    },
  });

  return { ok: true as const };
};

export const saveApplicationFormProgress = async (params: {
  applicationFormId: string;
  formData: object;
  currentStep: number;
  completionPercent: number;
}) => {
  const { applicationFormId, formData, currentStep, completionPercent } = params;

  const form = await prisma.applicationForm.findUnique({
    where: { id: applicationFormId },
    select: { id: true, status: true },
  });

  if (!form) {
    throw createHttpError({ status: 404, message: "Application form not found" });
  }

  if (form.status === ApplicationFormStatus.SUBMITTED || form.status === ApplicationFormStatus.LOCKED) {
    throw createHttpError({ status: 409, message: "Form is locked and cannot be edited" });
  }

  const now = new Date();
  const updatedForm = await prisma.applicationForm.update({
    where: { id: applicationFormId },
    data: {
      formData,
      currentStep,
      completionPercent,
      isClientActive: true,
      lastClientActivity: now,
      lastAutoSave: now,
      status: ApplicationFormStatus.IN_PROGRESS,
    },
    select: {
      id: true,
      lastAutoSave: true,
    },
  });

  return updatedForm;
};

export const getApplicationFormById = async (params: { applicationFormId: string }) => {
  const { applicationFormId } = params;

  const form = await prisma.applicationForm.findUnique({
    where: { id: applicationFormId },
    select: {
      id: true,
      status: true,
      submittedAt: true,
      formData: true,
      currentStep: true,
      completionPercent: true,
      isClientActive: true,
      lastClientActivity: true,
      lastAutoSave: true,
    },
  });

  if (!form) {
    throw createHttpError({ status: 404, message: "Application form not found" });
  }

  return form;
};

export const logUnlockAttempt = async (params: {
  applicationFormId: string;
  success: boolean;
  ipAddress?: string;
  userAgent?: string;
}) => {
  const form = await prisma.applicationForm.findUnique({
    where: { id: params.applicationFormId },
    select: { id: true, unlockHistory: true, leadId: true },
  });

  if (!form) {
    // Fail silently, as this is a non-critical logging operation.
    console.warn(`logUnlockAttempt: ApplicationForm not found with id ${params.applicationFormId}`);
    return;
  }

  // Fetch client display data (best-effort)
  const lead = await prisma.lead.findUnique({
    where: { id: form.leadId },
    select: {
      customerProfile: {
        select: { firstName: true, lastName: true, email: true },
      },
    },
  });

  const unlockEntry = {
    type: "CLIENT_ATTEMPT",
    timestamp: new Date().toISOString(),
    success: params.success,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    client: {
      firstName: lead?.customerProfile?.firstName ?? null,
      lastName: lead?.customerProfile?.lastName ?? null,
      email: lead?.customerProfile?.email ?? null,
    },
  };

  await prisma.applicationForm.update({
    where: { id: params.applicationFormId },
    data: {
      unlockHistory: buildUnlockHistory(form.unlockHistory, unlockEntry),
    },
  });
};

export const submitApplicationForm = async (id: string, formData: Prisma.JsonObject) => {
  return prisma.$transaction(async (tx) => {
    const form = await tx.applicationForm.findUnique({
      where: { id },
      select: { id: true, status: true, leadId: true },
    });

    if (!form) {
      throw createHttpError({ status: 404, message: 'Application form not found' });
    }

    if (form.status === 'SUBMITTED') {
      return form;
    }

    const consents = ((formData.consents as Prisma.JsonArray) ?? []) as Array<{
      templateId: string;
      given: boolean;
    }>;

    if (consents.length > 0) {
      const templateIds = consents.map((c) => c.templateId);
      const templates = await tx.consentTemplate.findMany({
        where: { id: { in: templateIds } },
      });
      const templateMap = new Map(templates.map((t) => [t.id, t]));

      const consentRecordsData = consents.map((c) => {
        const template = templateMap.get(c.templateId);
        if (!template) {
          throw createHttpError({ status: 400, message: `Consent template ${c.templateId} not found` });
        }
        return {
          leadId: form.leadId,
          applicationFormId: form.id,
          consentTemplateId: template.id,
          version: template.version,
          consentGiven: c.given,
          consentMethod: ConsentMethod.ONLINE_FORM,
          consentType: template.consentType,
          consentText: template.content,
          ipAddress: "unknown", // TODO: Capture IP
        };
      });

      await tx.consentRecord.createMany({
        data: consentRecordsData,
      });
    }

    const updatedForm = await tx.applicationForm.update({
      where: { id },
      data: {
        formData,
        status: 'SUBMITTED',
        submittedAt: new Date(),
        isClientActive: false,
      },
    });

    return updatedForm;
  });
};
