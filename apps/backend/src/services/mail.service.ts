import nodemailer, { Transporter } from "nodemailer";

import { env } from "../config/env.js";
import { escapeHtml } from "../utils/html.js";

interface MailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export let transporter: Transporter | null = null;

const mailConfig = env.email;

const isEmailConfigured =
  Boolean(mailConfig?.host) &&
  Boolean(mailConfig?.user) &&
  Boolean(mailConfig?.password) &&
  Boolean(mailConfig?.from);

if (isEmailConfigured && mailConfig) {
  transporter = nodemailer.createTransport({
    host: mailConfig.host,
    port: mailConfig.port,
    secure: mailConfig.secure,
    auth: {
      user: mailConfig.user,
      pass: mailConfig.password,
    },
  });

  transporter
    .verify()
    .then(() => {
      console.info("[mail] Transport verified");
    })
    .catch((error: unknown) => {
      console.error("[mail] Transport verification failed", error);
    });
} else {
  console.warn("[mail] SMTP credentials missing – email notifications are disabled");
}

export const sendMail = async (options: MailOptions) => {
  if (!transporter || !isEmailConfigured) {
    console.warn("[mail] Transport not configured, skipping message to", options.to);
    return;
  }

  try {
    const info = await transporter.sendMail({
      from: mailConfig?.from,
      ...options,
    });
    console.info(
      `[mail] Sent message "${options.subject}" to ${options.to} (id: ${info.messageId ?? "n/a"})`,
    );
  } catch (error) {
    console.error("[mail] Failed to send message", { to: options.to, subject: options.subject, error });
    throw error;
  }
};

export const sendUserInviteEmail = async (options: {
  to: string;
  fullName?: string | null;
  temporaryPassword: string;
}) => {
  const greeting = options.fullName ? `Hi ${options.fullName},` : "Hello,";
  const safeGreeting = escapeHtml(greeting);
  const safePassword = escapeHtml(options.temporaryPassword);
  const appUrl = env.app.baseUrl;
  const safeAppUrl = escapeHtml(appUrl);
  const subject = "You have been invited to Izzy CRM";
  const text = [
    greeting,
    "",
    "An administrator just created an account for you in Izzy CRM.",
    `Temporary password: ${options.temporaryPassword}`,
    "",
    `Sign in at: ${appUrl}`,
    "",
    "Please change your password after logging in.",
  ].join("\n");

  const html = `<p>${safeGreeting}</p>
  <p>An administrator just created an account for you in Izzy CRM.</p>
  <p><strong>Temporary password:</strong> ${safePassword}</p>
  <p>Sign in at: <a href="${safeAppUrl}">${safeAppUrl}</a></p>
  <p>Please change your password after logging in.</p>`;

  await sendMail({
    to: options.to,
    subject,
    text,
    html,
  });
};

export const sendPasswordResetEmail = async (options: {
  to: string;
  fullName?: string | null;
  password: string;
}) => {
  const greeting = options.fullName ? `Hi ${options.fullName},` : "Hello,";
  const safeGreeting = escapeHtml(greeting);
  const safePassword = escapeHtml(options.password);
  const appUrl = env.app.baseUrl;
  const safeAppUrl = escapeHtml(appUrl);
  const subject = "Your Izzy CRM password has been reset";
  const text = [
    greeting,
    "",
    "Your password has been reset by an administrator.",
    `New password: ${options.password}`,
    "",
    `Sign in at: ${appUrl}`,
    "",
    "Please update your password after logging in.",
  ].join("\n");

  const html = `<p>${safeGreeting}</p>
  <p>Your password has been reset by an administrator.</p>
  <p><strong>New password:</strong> ${safePassword}</p>
  <p>Sign in at: <a href="${safeAppUrl}">${safeAppUrl}</a></p>
  <p>Please update your password after logging in.</p>`;

  await sendMail({
    to: options.to,
    subject,
    text,
    html,
  });
};

export const sendPasswordResetLinkEmail = async (options: {
  to: string;
  fullName?: string | null;
  resetUrl: string;
}) => {
  const greeting = options.fullName ? `Cześć ${options.fullName},` : "Cześć,";
  const safeGreeting = escapeHtml(greeting);
  const safeResetUrl = escapeHtml(options.resetUrl);
  const subject = "Reset hasła w Izzy CRM";
  const text = [
    greeting,
    "",
    "Otrzymaliśmy prośbę o zresetowanie hasła do Twojego konta w Izzy CRM.",
    "Kliknij w poniższy link (ważny przez 15 minut), aby ustawić nowe hasło:",
    options.resetUrl,
    "",
    "Jeśli to nie Ty prosiłeś o zmianę hasła, zignoruj tę wiadomość – Twoje dotychczasowe hasło pozostaje bez zmian.",
  ].join("\n");

  const html = `<p>${safeGreeting}</p>
  <p>Otrzymaliśmy prośbę o zresetowanie hasła do Twojego konta w Izzy CRM.</p>
  <p><a href="${safeResetUrl}">Ustaw nowe hasło (link ważny 15 minut)</a></p>
  <p>Jeśli to nie Ty prosiłeś o zmianę hasła, zignoruj tę wiadomość – Twoje dotychczasowe hasło pozostaje bez zmian.</p>`;

  await sendMail({
    to: options.to,
    subject,
    text,
    html,
  });
};
