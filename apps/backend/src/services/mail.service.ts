import nodemailer, { Transporter } from "nodemailer";

import { env } from "../config/env.js";

interface MailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

let transporter: Transporter | null = null;

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
    return;
  }

  await transporter.sendMail({
    from: mailConfig?.from,
    ...options,
  });
};

export const sendUserInviteEmail = async (options: {
  to: string;
  fullName?: string | null;
  temporaryPassword: string;
}) => {
  const greeting = options.fullName ? `Hi ${options.fullName},` : "Hello,";
  const appUrl = env.app.baseUrl;
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

  const html = `<p>${greeting}</p>
  <p>An administrator just created an account for you in Izzy CRM.</p>
  <p><strong>Temporary password:</strong> ${options.temporaryPassword}</p>
  <p>Sign in at: <a href="${appUrl}">${appUrl}</a></p>
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
  const appUrl = env.app.baseUrl;
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

  const html = `<p>${greeting}</p>
  <p>Your password has been reset by an administrator.</p>
  <p><strong>New password:</strong> ${options.password}</p>
  <p>Sign in at: <a href="${appUrl}">${appUrl}</a></p>
  <p>Please update your password after logging in.</p>`;

  await sendMail({
    to: options.to,
    subject,
    text,
    html,
  });
};
