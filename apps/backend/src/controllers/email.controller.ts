import { randomUUID } from "crypto";
import { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { sendMail } from "../services/mail.service.js";

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
        where: { email: senderEmail },
        include: { lead: true },
    });

    if (!customerProfile) {
        console.warn(`Received email from unknown sender: ${senderEmail}`);
        return { success: false, message: "Unknown sender" };
    }

    await prisma.leadNote.create({
        data: {
            leadId: customerProfile.leadId,
            content: text || "(No content)",
            type: "EMAIL_RECEIVED",
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
