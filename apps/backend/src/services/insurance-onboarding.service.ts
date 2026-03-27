import { CommChannel, CommStatus, ConsentMethod, InsuranceOnboardingStatus, LeadStatus } from "@prisma/client";
import { randomBytes } from "crypto";

import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { sendMail } from "./mail.service.js";
import { sendSms } from "./sms.service.js";
import { recordConsentBatch, type RecordConsentInput } from "./consent.service.js";
import { createHttpError } from "../utils/httpError.js";

const ONBOARDING_FORM_TYPE = "onboarding_insurance";

// ── Helpers ───────────────────────────────────────────────────────────────────

const generateToken = () => randomBytes(32).toString("hex");

const interpolate = (template: string, vars: Record<string, string>) =>
    template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");

/** Load a MessageTemplate by key, with fallback defaults for SMS and email */
const getMessageTemplate = async (key: string) => {
    const tpl = await prisma.messageTemplate.findUnique({ where: { key, isActive: true } });
    return tpl;
};

// ── Start Onboarding (idempotent) ─────────────────────────────────────────────

export const startOnboarding = async ({
    leadId,
    actorUserId,
}: {
    leadId: string;
    actorUserId: string;
}) => {
    const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: {
            id: true,
            customerProfile: {
                select: { firstName: true, lastName: true, email: true, phone: true },
            },
        },
    });

    if (!lead) {
        throw createHttpError({ status: 404, message: "Lead not found" });
    }

    const profile = lead.customerProfile;
    if (!profile?.phone) {
        throw createHttpError({
            status: 422,
            code: "MISSING_PHONE",
            message: "Lead nie ma uzupełnionego numeru telefonu.",
        });
    }
    if (!profile.email) {
        throw createHttpError({
            status: 422,
            code: "MISSING_EMAIL",
            message: "Lead nie ma uzupełnionego adresu email.",
        });
    }

    const ttlHours = env.onboarding.linkTtlHours;
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
    const token = generateToken();

    // Upsert session (idempotent – new token each time, old one becomes invalid)
    const session = await prisma.insuranceOnboardingSession.upsert({
        where: { leadId },
        create: {
            leadId,
            status: InsuranceOnboardingStatus.CREATED,
            token,
            tokenExpiresAt: expiresAt,
            sentByUserId: actorUserId,
        },
        update: {
            status: InsuranceOnboardingStatus.CREATED,
            token,
            tokenExpiresAt: expiresAt,
            sentByUserId: actorUserId,
            smsSentAt: null,
            emailSentAt: null,
            openedAt: null,
            slotSelectedAt: null,
            consentsCapAt: null,
        },
    });

    const landingUrl = `${env.app.baseUrl}/onboarding?token=${token}`;
    const firstName = profile.firstName ?? "";

    // ── Send SMS ──────────────────────────────────────────────────────────────
    let finalSmsUrl = landingUrl;
    if (env.smsapi?.token) {
        finalSmsUrl = `[%idzdo:${landingUrl}%]`;
    }

    const smsTpl = await getMessageTemplate("sms_welcome_insurance");
    const smsBody = smsTpl
        ? interpolate(smsTpl.body, { firstName, link: finalSmsUrl })
        : `Witaj${firstName ? ` ${firstName}` : ""}, cieszymy sie, ze mozemy Ci pomoc w znalezieniu nowego auta! Sprawdz maila i ustal termin rozmowy z nami. Twoje dane otrzymalismy od Link4. Zadzwonimy z nr 22 688 77 57. ${finalSmsUrl}`;

    let smsSent = false;
    if (env.smsapi) {
        const result = await sendSms({
            to: profile.phone,
            message: smsBody,
            senderName: env.smsapi.senderName,
            smsapiToken: env.smsapi.token,
            sessionId: session.id,
            templateKey: "sms_welcome_insurance",
        });
        smsSent = result.status === CommStatus.SENT;
    } else {
        console.warn("[onboarding] SMSAPI not configured – skipping SMS for lead", leadId);
        // Still log the attempt
        await prisma.communicationLog.create({
            data: {
                sessionId: session.id,
                channel: CommChannel.SMS,
                templateKey: "sms_welcome_insurance",
                status: CommStatus.FAILED,
                sentTo: profile.phone,
                errorMessage: "SMSAPI not configured",
            },
        });
    }

    // ── Send Email ────────────────────────────────────────────────────────────
    const emailTpl = await getMessageTemplate("email_welcome_insurance");
    const emailSubject = emailTpl?.subject ?? "Pomożemy Ci znaleźć nowe auto – wybierz termin kontaktu";
    const emailBody = emailTpl
        ? interpolate(emailTpl.body, { firstName, link: landingUrl })
        : buildDefaultEmailBody(firstName, landingUrl);

    let emailSent = false;
    try {
        await sendMail({
            to: profile.email,
            subject: emailSubject,
            text: emailBody,
            html: buildEmailHtml(firstName, landingUrl, emailBody),
        });
        emailSent = true;
    } catch (err) {
        console.error("[onboarding] Failed to send email to", profile.email, err);
    }

    await prisma.communicationLog.create({
        data: {
            sessionId: session.id,
            channel: CommChannel.EMAIL,
            templateKey: "email_welcome_insurance",
            status: emailSent ? CommStatus.SENT : CommStatus.FAILED,
            sentTo: profile.email,
            sentAt: emailSent ? new Date() : null,
            payload: { subject: emailSubject },
        },
    });

    // Update session status and timestamps
    const updatedSession = await prisma.insuranceOnboardingSession.update({
        where: { id: session.id },
        data: {
            status: InsuranceOnboardingStatus.ONBOARDING_SENT,
            smsSentAt: smsSent ? new Date() : null,
            emailSentAt: emailSent ? new Date() : null,
        },
    });

    // Audit log
    await prisma.auditLog.create({
        data: {
            leadId,
            userId: actorUserId,
            action: "INSURANCE_ONBOARDING_STARTED",
            metadata: {
                sessionId: session.id,
                smsSent,
                emailSent,
                expiresAt: expiresAt.toISOString(),
            },
        },
    });

    return {
        sessionId: updatedSession.id,
        status: updatedSession.status,
        smsSent,
        emailSent,
        expiresAt,
    };
};

// ── Get Status (for CRM operator) ─────────────────────────────────────────────

export const getOnboardingStatus = async (leadId: string) => {
    const session = await prisma.insuranceOnboardingSession.findUnique({
        where: { leadId },
        select: {
            id: true,
            status: true,
            smsSentAt: true,
            emailSentAt: true,
            openedAt: true,
            slotSelectedAt: true,
            consentsCapAt: true,
            tokenExpiresAt: true,
            createdAt: true,
            updatedAt: true,
            contactSchedule: {
                select: {
                    preferredDate: true,
                    preferredSlot: true,
                    timezone: true,
                },
            },
            communicationLogs: {
                select: {
                    id: true,
                    channel: true,
                    status: true,
                    sentTo: true,
                    sentAt: true,
                    errorMessage: true,
                    createdAt: true,
                },
                orderBy: { createdAt: "desc" },
                take: 10,
            },
        },
    });

    return session;
};

// ── Verify Token (public LP endpoint) ─────────────────────────────────────────

export const verifyOnboardingToken = async (token: string) => {
    const session = await prisma.insuranceOnboardingSession.findUnique({
        where: { token },
        select: {
            id: true,
            leadId: true,
            status: true,
            tokenExpiresAt: true,
            openedAt: true,
            lead: {
                select: {
                    customerProfile: {
                        select: { firstName: true },
                    },
                },
            },
        },
    });

    if (!session) {
        throw createHttpError({ status: 401, code: "INVALID_TOKEN", message: "Nieprawidłowy link lub link wygasł." });
    }

    if (session.tokenExpiresAt < new Date()) {
        throw createHttpError({ status: 401, code: "TOKEN_EXPIRED", message: "Link wygasł. Poproś o nowy link." });
    }

    if (!session.openedAt) {
        await prisma.insuranceOnboardingSession.update({
            where: { id: session.id },
            data: {
                openedAt: new Date(),
                status: InsuranceOnboardingStatus.LINK_OPENED,
            },
        });
    }

    const daysAhead = env.onboarding.contactDaysAhead;

    return {
        sessionId: session.id,
        leadId: session.leadId,
        status: session.status,
        firstName: session.lead.customerProfile?.firstName ?? null,
        daysAhead,
    };
};

// ── Save Contact Slot ─────────────────────────────────────────────────────────

export const saveContactSlot = async ({
    token,
    preferredDate,
    preferredSlot,
    timezone = "Europe/Warsaw",
}: {
    token: string;
    preferredDate: Date;
    preferredSlot: string;
    timezone?: string;
}) => {
    const session = await prisma.insuranceOnboardingSession.findUnique({
        where: { token },
        select: {
            id: true,
            leadId: true,
            tokenExpiresAt: true,
            status: true,
            lead: { select: { customerProfile: { select: { firstName: true, lastName: true } } } },
        },
    });

    if (!session) {
        throw createHttpError({ status: 401, code: "INVALID_TOKEN", message: "Nieprawidłowy link." });
    }

    if (session.tokenExpiresAt < new Date()) {
        throw createHttpError({ status: 401, code: "TOKEN_EXPIRED", message: "Link wygasł." });
    }

    const schedule = await prisma.contactSchedule.upsert({
        where: { sessionId: session.id },
        create: {
            sessionId: session.id,
            leadId: session.leadId,
            preferredDate,
            preferredSlot,
            timezone,
        },
        update: {
            preferredDate,
            preferredSlot,
            timezone,
        },
    });

    await prisma.$transaction([
        prisma.insuranceOnboardingSession.update({
            where: { id: session.id },
            data: {
                status: InsuranceOnboardingStatus.ONBOARDING_CONFIRMED,
                slotSelectedAt: new Date(),
            },
        }),
        prisma.lead.update({
            where: { id: session.leadId },
            data: { status: LeadStatus.ONBOARDING_CONFIRMED },
        }),
    ]);

    const firstName = session.lead.customerProfile?.firstName ?? "";
    const lastName = session.lead.customerProfile?.lastName ?? "";
    const clientName = [firstName, lastName].filter(Boolean).join(" ") || "Klient";
    const dateFmt = preferredDate.toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Warsaw" });

    sendMail({
        to: "link4@izzylease.pl, marcin.grodowski@izzylease.pl",
        subject: "Klient potwierdził termin onboardingu",
        text: `${clientName} potwierdził termin kontaktu: ${preferredSlot}, ${dateFmt}.`,
        html: `<p><strong>${clientName}</strong> potwierdził termin kontaktu:</p><p><strong>${preferredSlot}</strong>, ${dateFmt}</p>`,
    }).catch((err) => console.error("[mail] Failed to send onboarding confirmed notification", err));

    return { scheduleId: schedule.id, preferredDate, preferredSlot };
};

// ── Capture Consents ──────────────────────────────────────────────────────────

export const captureConsents = async ({
    token,
    consents,
    ipAddress,
    userAgent,
}: {
    token: string;
    consents: RecordConsentInput[];
    ipAddress?: string;
    userAgent?: string;
}) => {
    const session = await prisma.insuranceOnboardingSession.findUnique({
        where: { token },
        select: { id: true, leadId: true, tokenExpiresAt: true, status: true },
    });

    if (!session) {
        throw createHttpError({ status: 401, code: "INVALID_TOKEN", message: "Nieprawidłowy link." });
    }

    if (session.tokenExpiresAt < new Date()) {
        throw createHttpError({ status: 401, code: "TOKEN_EXPIRED", message: "Link wygasł." });
    }

    // Re-use existing consent service with onboarding_insurance form type
    // We need an applicationFormId equivalent – we use the sessionId as a surrogate
    // by recording consents directly with leadId (no applicationForm required for onboarding)
    const templates = await prisma.consentTemplate.findMany({
        where: { formType: ONBOARDING_FORM_TYPE, isActive: true },
    });

    const templateById = new Map(templates.map((t) => [t.id, t]));

    await prisma.$transaction(async (tx) => {
        for (const consent of consents) {
            const template = templateById.get(consent.consentTemplateId);
            if (!template) continue;

            if (template.isRequired && !consent.consentGiven) {
                throw createHttpError({
                    status: 422,
                    code: "REQUIRED_CONSENT_MISSING",
                    message: `Wymagana zgoda ${template.title} musi być zaakceptowana.`,
                });
            }

            await tx.consentRecord.upsert({
                where: {
                    applicationFormId_consentTemplateId_version: {
                        // For onboarding sessions we use a dummy applicationFormId
                        // We use session.id prefixed to avoid collision
                        applicationFormId: `onboarding_${session.id}`,
                        consentTemplateId: consent.consentTemplateId,
                        version: consent.version,
                    },
                },
                create: {
                    consentTemplateId: consent.consentTemplateId,
                    consentType: template.consentType,
                    leadId: session.leadId,
                    consentGiven: consent.consentGiven,
                    consentMethod: consent.consentMethod ?? ConsentMethod.ONLINE_FORM,
                    consentText: consent.consentText ?? template.content,
                    helpTextSnapshot: template.helpText ?? null,
                    version: consent.version,
                    ipAddress,
                    userAgent,
                    recordedAt: consent.acceptedAt ?? new Date(),
                    accessCodeHash: session.id, // session id as reference
                },
                update: {
                    consentGiven: consent.consentGiven,
                    ipAddress,
                    userAgent,
                    recordedAt: consent.acceptedAt ?? new Date(),
                },
            });
        }
    });

    await prisma.insuranceOnboardingSession.update({
        where: { id: session.id },
        data: {
            status: InsuranceOnboardingStatus.CONSENTS_CAPTURED,
            consentsCapAt: new Date(),
            ipAddress: ipAddress ?? null,
            userAgent: userAgent ?? null,
        },
    });

    return { captured: consents.length };
};

// ── Email template helpers ─────────────────────────────────────────────────────

const buildDefaultEmailBody = (firstName: string, link: string) =>
    [
        firstName ? `Cześć ${firstName},` : "Cześć,",
        "",
        "Ponieważ jesteś w trakcie procesu likwidacji szkody Twojego samochodu, Link4 przesłał nam za Twoją zgodą Twoje dane kontaktowe, abyśmy pomogli Tobie znaleźć nowe auto.",
        "",
        "Kliknij w link i daj nam znać, kiedy możemy się z Tobą skontaktować:",
        link,
        "",
        "Łączymy się z poważaniem,",
        "Zespół Carsalon",
    ].join("\n");

const buildEmailHtml = (firstName: string, link: string, fallbackText: string) => {
    const greeting = firstName ? `Cześć ${firstName},` : "Cześć,";
    return `
<!DOCTYPE html>
<html lang="pl">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:Inter,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr><td style="background:linear-gradient(135deg,#f97316,#ea580c);padding:32px 40px;">
          <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;">Pomożemy Ci znaleźć nowe auto</h1>
        </td></tr>
        <tr><td style="padding:40px;">
          <p style="margin:0 0 16px;color:#1e293b;font-size:16px;">${greeting}</p>
          <p style="margin:0 0 16px;color:#475569;font-size:15px;line-height:1.6;">
            Ponieważ jesteś w trakcie procesu likwidacji szkody Twojego samochodu, Link4 przesłał nam za Twoją zgodą Twoje dane kontaktowe, abyśmy pomogli Tobie znaleźć nowe auto.
          </p>
          <p style="margin:0 0 32px;color:#475569;font-size:15px;line-height:1.6;">
            Kliknij w przycisk poniżej i wybierz termin, w którym możemy się z Tobą skontaktować.
          </p>
          <a href="${link}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#f97316,#ea580c);color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">
            Wybierz termin kontaktu →
          </a>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0;">
          <p style="margin:0;color:#94a3b8;font-size:13px;">
            Jeśli przycisk nie działa, skopiuj i wklej ten link do przeglądarki:<br>
            <a href="${link}" style="color:#f97316;word-break:break-all;">${link}</a>
          </p>
        </td></tr>
        <tr><td style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">Carsalon Sp. z o.o. | Otrzymałeś tę wiadomość, ponieważ wyraziłeś zgodę na kontakt.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();
};
