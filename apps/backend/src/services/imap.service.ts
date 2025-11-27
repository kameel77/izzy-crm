import imaps from "imap-simple";
import { simpleParser } from "mailparser";
import { env } from "../config/env.js";
import { processIncomingEmail } from "../controllers/email.controller.js";

export class ImapService {
    private config: imaps.ImapSimpleOptions | null = null;
    private readonly isConfigured: boolean;

    constructor() {
        const inbox = env.leadEmail;

        if (inbox?.imapHost && inbox?.user && inbox?.password) {
            this.config = {
                imap: {
                    user: inbox.user,
                    password: inbox.password,
                    host: inbox.imapHost,
                    port: inbox.imapPort ?? 993,
                    tls: inbox.imapSecure ?? true,
                    authTimeout: 3000,
                },
            };
        }

        this.isConfigured = Boolean(this.config);
    }

    public async fetchUnreadEmails() {
        if (!this.config) {
            console.warn("[imap] Lead inbox not configured; skipping fetch");
            return;
        }

        const resolveAddressText = (address: unknown): string | undefined => {
            if (!address) return undefined;
            if (Array.isArray(address)) {
                const combined = address
                    .map((entry) => resolveAddressText(entry))
                    .filter((value): value is string => Boolean(value))
                    .join(", ");
                return combined || undefined;
            }
            if (typeof address === "object" && address !== null) {
                const text = "text" in address ? (address as { text?: string }).text : undefined;
                const addr = "address" in address ? (address as { address?: string }).address : undefined;
                if (text || addr) {
                    return text || addr || undefined;
                }
                if ("value" in address) {
                    return resolveAddressText((address as { value?: unknown }).value);
                }
            }
            return undefined;
        };

        try {
            const connection = await imaps.connect(this.config);
            await connection.openBox("INBOX");

            const searchCriteria = ["UNSEEN"];
            const fetchOptions = {
                bodies: ["HEADER", "TEXT", ""],
                markSeen: false,
            };

            const messages = await connection.search(searchCriteria, fetchOptions);

            for (const message of messages) {
                const all = message.parts.find((part) => part.which === "");
                const id = message.attributes.uid;
                const idHeader = "Imap-Id: " + id + "\r\n";

                if (all) {
                    const parsed = await simpleParser(idHeader + all.body);

                    const from = resolveAddressText(parsed.from) || "";
                    const subject = parsed.subject || "(No Subject)";
                    const text = parsed.text || "";
                    const html = typeof parsed.html === "string" ? parsed.html : undefined;
                    const messageId = parsed.messageId || undefined;
                    const to = resolveAddressText(parsed.to);

                    if (from) {
                        console.log(`Processing email from: ${from}`);
                        await processIncomingEmail({
                            from,
                            subject,
                            text,
                            html,
                            messageId,
                            to,
                        });

                        // Mark as seen only after successful processing
                        await connection.addFlags(id, "SEEN");
                    }
                }
            }

            connection.end();
        } catch (error) {
            console.error("IMAP Fetch Error:", error);
        }
    }

    public startPolling(intervalMs: number = 60000) {
        if (!this.config) {
            console.warn("[imap] Lead inbox not configured; IMAP polling disabled");
            return;
        }

        console.log("[imap] Starting IMAP polling for lead inbox...");
        this.fetchUnreadEmails(); // Initial fetch
        setInterval(() => {
            this.fetchUnreadEmails();
        }, intervalMs);
    }
}

export const imapService = new ImapService();
