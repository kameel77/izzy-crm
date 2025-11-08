import {
  ApplicationFormStatus,
  EmailLogStatus,
  EmailLogType,
  UserRole,
  UserStatus,
} from "@prisma/client";
import { randomBytes } from "crypto";

import { prisma } from "../lib/prisma.js";
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
