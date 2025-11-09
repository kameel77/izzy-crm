import {
  ApplicationFormStatus,
  EmailLogStatus,
  EmailLogType,
  UserRole,
  UserStatus,
} from "@prisma/client";
import { createHash, randomBytes } from "crypto";

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
      status: ApplicationFormStatus.IN_PROGRESS,
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

  return updatedForm;
};
