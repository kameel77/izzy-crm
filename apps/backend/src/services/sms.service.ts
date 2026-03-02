import { CommChannel, CommStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export type SmsResult = {
    messageId?: string;
    status: CommStatus;
};

const SMSAPI_URL = "https://api.smsapi.com/sms.do";
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const sendSms = async ({
    to,
    message,
    senderName,
    smsapiToken,
    sessionId,
    templateKey,
}: {
    to: string;
    message: string;
    senderName: string;
    smsapiToken: string;
    sessionId: string;
    templateKey?: string;
}): Promise<SmsResult> => {
    const logEntry = await prisma.communicationLog.create({
        data: {
            sessionId,
            channel: CommChannel.SMS,
            templateKey,
            status: CommStatus.PENDING,
            sentTo: to,
            payload: { message: message.slice(0, 160) },
        },
    });

    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const params = new URLSearchParams({
                to,
                message,
                from: senderName,
                format: "json",
            });

            const response = await fetch(`${SMSAPI_URL}?${params.toString()}`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${smsapiToken}`,
                },
            });

            const body = (await response.json()) as {
                count?: number;
                list?: Array<{ id?: string; status?: string }>;
                error?: number;
                message?: string;
            };

            if (!response.ok || body.error) {
                throw new Error(
                    `SMSAPI error ${body.error ?? response.status}: ${body.message ?? "Unknown error"}`,
                );
            }

            const msgId = body.list?.[0]?.id;

            await prisma.communicationLog.update({
                where: { id: logEntry.id },
                data: {
                    status: CommStatus.SENT,
                    providerMessageId: msgId ?? null,
                    sentAt: new Date(),
                    retries: attempt - 1,
                },
            });

            console.info(`[sms] Sent to ${to} (msgId: ${msgId ?? "n/a"}, attempt: ${attempt})`);
            return { messageId: msgId, status: CommStatus.SENT };
        } catch (error) {
            lastError = error;
            console.warn(`[sms] Attempt ${attempt}/${MAX_RETRIES} failed for ${to}:`, error);
            if (attempt < MAX_RETRIES) {
                await sleep(RETRY_DELAY_MS * attempt);
            }
        }
    }

    const errorMessage = lastError instanceof Error ? lastError.message : String(lastError);
    await prisma.communicationLog.update({
        where: { id: logEntry.id },
        data: {
            status: CommStatus.FAILED,
            errorMessage,
            retries: MAX_RETRIES,
        },
    });

    console.error(`[sms] Failed to send to ${to} after ${MAX_RETRIES} attempts:`, lastError);
    return { status: CommStatus.FAILED };
};
