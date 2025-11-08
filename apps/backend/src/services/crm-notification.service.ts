import { EmailLogStatus, EmailLogType } from "@prisma/client";
import { fetch } from "undici";

import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";

export type ReadyForReviewEvent = {
  applicationFormId: string;
  leadId: string;
  consents: Array<{
    consentTemplateId: string;
    consentType: string;
    version: number;
    consentGiven: boolean;
  }>;
  ipAddress?: string | null;
  userAgent?: string | null;
};

const buildPayload = (event: ReadyForReviewEvent) => ({
  event: "application.ready_for_review",
  applicationFormId: event.applicationFormId,
  leadId: event.leadId,
  consents: event.consents,
  clientIp: event.ipAddress ?? null,
  userAgent: event.userAgent ?? null,
});

const createLeadNoteContent = (event: ReadyForReviewEvent) => {
  const list = event.consents
    .map((consent) => `${consent.consentTemplateId} (v${consent.version})`)
    .join(", ");
  return [
    "Wniosek gotowy do przeglądu (application.ready_for_review)",
    list ? `Szablony: ${list}` : undefined,
  ]
    .filter(Boolean)
    .join("\n");
};

export const notifyApplicationReadyForReview = async (event: ReadyForReviewEvent) => {
  const existingLog = await prisma.emailLog.findFirst({
    where: {
      applicationFormId: event.applicationFormId,
      type: EmailLogType.READY_FOR_REVIEW,
    },
  });

  if (existingLog) {
    return existingLog;
  }

  const payload = buildPayload(event);
  const note = await prisma.leadNote.create({
    data: {
      leadId: event.leadId,
      content: createLeadNoteContent(event),
    },
  });

  const emailLog = await prisma.emailLog.create({
    data: {
      applicationFormId: event.applicationFormId,
      leadId: event.leadId,
      type: EmailLogType.READY_FOR_REVIEW,
      status: EmailLogStatus.SENT,
      sentTo: env.integrations.crmWebhook?.url ?? null,
      payload,
      noteCreated: true,
      noteId: note.id,
    },
  });

  const webhookConfig = env.integrations.crmWebhook;
  if (!webhookConfig?.url) {
    return emailLog;
  }

  try {
    const response = await fetch(webhookConfig.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(webhookConfig.token ? { Authorization: `Bearer ${webhookConfig.token}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    await prisma.emailLog.update({
      where: { id: emailLog.id },
      data: {
        status: response.ok ? EmailLogStatus.DELIVERED : EmailLogStatus.FAILED,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      // eslint-disable-next-line no-console
      console.error("[crm-webhook] Non-200 response", response.status, errorBody);
    }
  } catch (error) {
    await prisma.emailLog.update({
      where: { id: emailLog.id },
      data: { status: EmailLogStatus.FAILED },
    });
    // eslint-disable-next-line no-console
    console.error("[crm-webhook] Failed to send webhook", error);
  }

  return emailLog;
};
