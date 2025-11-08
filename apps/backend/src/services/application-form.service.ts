import { UserRole, UserStatus } from "@prisma/client";

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
