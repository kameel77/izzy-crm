import { LeadNoteType, LeadStatus } from "@prisma/client";
import { randomUUID } from "crypto";
import { Request, Response } from "express";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { sendMail } from "../services/mail.service.js";

const ANTISPAM_WINDOW_MS = 60 * 60 * 1000; // 1h
const ANTISPAM_MAX_LEADS_PER_WINDOW = 10;

const extractNameParts = (from: string) => {
    const nameMatch = from.match(/"?(.*?)"?\s*<.*?>/);
    const displayName = nameMatch?.[1]?.trim();
    const fallbackFrom = nameMatch ? from.replace(nameMatch[0], "").trim() : from;
    const base = displayName?.length ? displayName : fallbackFrom.split("@")[0]?.replace(/["<>]/g, "");
    if (!base) {
        return { firstName: "Unknown", lastName: "Sender" };
    }
    const [first, ...rest] = base.split(/\s+/).filter(Boolean);
    return {
        firstName: first || "Unknown",
        lastName: rest.join(" ") || "Sender",
    };
};

const extractPhone = (text?: string | null) => {
    if (!text) return null;
    const match = text.match(/(\+?\d[\d\s\-]{6,}\d)/);
    return match ? match[1].replace(/\s+/g, "") : null;
};

const detectCustomerType = (subject?: string | null, body?: string | null) => {
    const haystack = [subject, body].filter(Boolean).join(" ").toLowerCase();
    const isCompany = /sp\.?\s*z\.?\s*o\.?\s*o|spółka|s\.a\.|s\.c\.|spj|sp k|firma|company|ltd/.test(haystack);
    return isCompany ? "firma" : "osoba prywatna";
};

const extractEmails = (input?: string | null) => {
    if (!input) return [];
    const matches = input.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi);
    return matches ? matches.map((value) => value.toLowerCase()) : [];
};

const resolveLeadInboxPartnerId = (params: { to?: string | null }) => {
    const map = env.leadInboxPartnerMap;
    if (map) {
        const toEmails = extractEmails(params.to);
        for (const email of toEmails) {
            const partnerId = map[email];
            if (partnerId) {
                return { partnerId, source: "map" as const };
            }
        }
    }
    return { partnerId: env.leadInboxPartnerId, source: "fallback" as const };
};

export const sendLeadEmail = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { message, links = [], subject, replyToNoteId, quotedHtml, quotedText } = req.body ?? {};
    const userId = req.user?.id;

    if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    if (typeof message !== "string" || !message.trim()) {
        return res.status(400).json({ message: "Message is required" });
    }

    try {
        const lead = await prisma.lead.findUnique({
            where: { id },
            include: { customerProfile: true },
        });

        if (!lead || !lead.customerProfile?.email) {
            return res.status(404).json({ message: "Lead or customer email not found" });
        }

        const normalizedLinks = Array.isArray(links) ? links : [];
        const sanitizedLinks = normalizedLinks
            .map((link) => (typeof link === "string" ? link.trim() : ""))
            .filter((link) => link.length);

        // Append tracking parameters to links
        const trackedLinks = sanitizedLinks.map((link: string) => {
            try {
                const url = new URL(link);
                url.searchParams.append("utm_source", "izzy-crm");
                url.searchParams.append("utm_medium", "email");
                url.searchParams.append("utm_campaign", `lead-${id}`);
                return url.toString();
            } catch (e) {
                return link;
            }
        });

        // Helper to format link title
        const formatLinkTitle = (urlStr: string) => {
            try {
                const url = new URL(urlStr);
                // Pattern: .../samochod/Make/Model/...
                const match = url.pathname.match(/\/samochod\/([^\/]+)\/([^\/]+)/);
                if (match) {
                    const make = match[1];
                    const model = match[2].replace(/-/g, " ");
                    return `${make} ${model}`;
                }
                return urlStr;
            } catch (e) {
                return urlStr;
            }
        };

        const linkList = trackedLinks.map((l: string) => `- ${l}`).join("\n");
        const subjectLine = typeof subject === "string" && subject.trim().length
            ? subject.trim()
            : "Information from Izzy CRM";

        const linkBlockText = trackedLinks.length ? `\n\nLinks:\n${linkList}` : "";
        const fullMessage = `${message}${linkBlockText}${quotedText ? `\n\n${quotedText}` : ""}`;

        const htmlLinks = trackedLinks
            .map((l: string) => {
                const title = formatLinkTitle(l);
                return `<a href="${l}">${title}</a>`;
            })
            .join("<br>");

        const htmlSections: string[] = [
            `<p>${message.replace(/\n/g, "<br>")}</p>`,
        ];

        if (trackedLinks.length) {
            htmlSections.push(`<p>Links:<br>${htmlLinks}</p>`);
        }

        if (typeof quotedHtml === "string" && quotedHtml.trim().length) {
            htmlSections.push(
                `<hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;" />`,
                `<div style="color:#6b7280;font-size:0.9rem;">${quotedHtml}</div>`,
            );
        }

        const htmlMessage = htmlSections.join("");
        const messageId = randomUUID();

        await sendMail({
            to: lead.customerProfile.email,
            subject: subjectLine,
            text: fullMessage,
            html: htmlMessage,
        });

        const note = await prisma.leadNote.create({
            data: {
                leadId: id,
                authorId: userId,
                content: message, // Save only the message content, links are in metadata
                type: "EMAIL_SENT",
                metadata: {
                    from: req.user?.email ?? null,
                    to: lead.customerProfile.email,
                    subject: subjectLine,
                    links: trackedLinks,
                    direction: "OUTGOING",
                    html: htmlMessage,
                    messageId,
                    replyToNoteId: replyToNoteId ?? null,
                    quotedHtml: quotedHtml ?? null,
                },
            },
            include: {
                author: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                    },
                },
            },
        });

        res.json(note);
    } catch (error) {
        console.error("Failed to send email", error);
        res.status(500).json({ message: "Failed to send email" });
    }
};

export const processIncomingEmail = async (params: {
    from: string;
    subject: string;
    text: string;
    html?: string;
    messageId?: string | null;
    to?: string | null;
}) => {
    const { from, subject, text, html, messageId, to } = params;
    // Extract email address from "Name <email@example.com>" format if necessary
    const emailMatch = from.match(/<(.+)>/);
    const senderEmail = emailMatch ? emailMatch[1] : from;

    const customerProfile = await prisma.customerProfile.findFirst({
        where: {
            OR: [
                { email: senderEmail },
                { alternateEmails: { has: senderEmail } },
            ],
        },
        include: { lead: true },
    });

    if (!customerProfile) {
        const partnerResolution = resolveLeadInboxPartnerId({ to });
        if (!partnerResolution.partnerId) {
            console.warn(
                `[email-inbound] Missing LEAD_INBOX_PARTNER_ID – cannot auto-create lead for ${senderEmail}`,
                { to: to ?? null, resolution: partnerResolution.source },
            );
            return { success: false, message: "Unknown sender (partner missing)" };
        }
        const partnerId = partnerResolution.partnerId;

        const windowStart = new Date(Date.now() - ANTISPAM_WINDOW_MS);
        const recentLeadCount = await prisma.lead.count({
            where: {
                partnerId,
                leadCreatedAt: { gte: windowStart },
                customerProfile: { email: senderEmail },
            },
        });

        if (recentLeadCount >= ANTISPAM_MAX_LEADS_PER_WINDOW) {
            console.warn(
                `[email-inbound] Rate limited auto-lead for ${senderEmail}: ${recentLeadCount} leads in last hour`,
            );
            return { success: false, message: "Rate limited" };
        }

        const names = extractNameParts(from);
        const phone = extractPhone(text ?? html ?? "");
        const customerType = detectCustomerType(subject, text ?? html ?? "");
        const notesLines = [
            "Lead utworzony automatycznie z wiadomości e-mail (izzylease.pl).",
            `From: ${from}`,
            `To: ${to ?? "(unknown)"}`,
            `Subject: ${subject ?? "(No Subject)"}`,
            "",
            text || "(No content)",
        ];

        const newLead = await prisma.lead.create({
            data: {
                partnerId,
                status: LeadStatus.INBOUND,
                sourceMetadata: {
                    source: "izzylease.pl",
                    direction: "INCOMING_EMAIL",
                    messageId: messageId ?? null,
                    customerType,
                },
                notes: notesLines.join("\n"),
                customerProfile: {
                    create: {
                        firstName: names.firstName,
                        lastName: names.lastName,
                        email: senderEmail,
                        phone,
                    },
                },
            },
            select: { id: true },
        });

        await prisma.leadNote.create({
            data: {
                leadId: newLead.id,
                content: "Źródło: inbound email (auto)",
                type: LeadNoteType.MANUAL,
                metadata: {
                    source: "INBOUND_EMAIL",
                    partnerId,
                },
            },
        });

        await prisma.leadNote.create({
            data: {
                leadId: newLead.id,
                content: text || "(No content)",
                type: LeadNoteType.EMAIL_RECEIVED,
                metadata: {
                    from,
                    senderEmail,
                    to,
                    subject,
                    html,
                    direction: "INCOMING",
                    messageId: messageId ?? null,
                    source: "izzylease.pl",
                },
            },
        });

        return { success: true, message: "Lead auto-created from incoming email" };
    }

    await prisma.leadNote.create({
        data: {
            leadId: customerProfile.leadId,
            content: text || "(No content)",
            type: LeadNoteType.EMAIL_RECEIVED,
            metadata: {
                from,
                senderEmail,
                to,
                subject,
                html,
                direction: "INCOMING",
                messageId: messageId ?? null,
            },
        },
    });

    return { success: true, message: "Email processed and attached to lead" };
};

export const handleIncomingEmailWebhook = async (req: Request, res: Response) => {
    // This assumes a generic webhook payload structure. 
    // Adjust based on the actual email provider (SendGrid, Mailgun, etc.)
    // For now, we assume a simple JSON payload: { from, subject, text, html }

    const { from, subject, text, html, messageId, to } = req.body;

    if (!from) {
        return res.status(400).json({ message: "Missing 'from' field" });
    }

    try {
        const result = await processIncomingEmail({ from, subject, text, html, messageId, to });
        res.status(200).json(result);
    } catch (error) {
        console.error("Failed to process incoming email", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
