import { createHmac } from "crypto";
import { UserStatus } from "@prisma/client";
import jwt from "jsonwebtoken";

import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { signToken } from "../utils/jwt.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { sendPasswordResetLinkEmail } from "./mail.service.js";

const deriveResetSecret = (hashedPassword: string) =>
  createHmac("sha256", env.JWT_SECRET).update(hashedPassword).digest("hex");

export const authenticateUser = async (email: string, password: string) => {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      hashedPassword: true,
      role: true,
      partnerId: true,
      status: true,
      partner: { select: { id: true, name: true } },
    },
  });

  if (!user) {
    const err = new Error("Invalid credentials");
    (err as Error & { status: number }).status = 401;
    throw err;
  }

  const isPasswordValid = await verifyPassword(password, user.hashedPassword);

  if (!isPasswordValid) {
    const err = new Error("Invalid credentials");
    (err as Error & { status: number }).status = 401;
    throw err;
  }

  if (user.status !== "ACTIVE") {
    const err = new Error("User is not active");
    (err as Error & { status: number }).status = 403;
    throw err;
  }

  const token = signToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    partnerId: user.partnerId,
  });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      partnerId: user.partnerId,
      partner: user.partner,
    },
  };
};

export const requestPasswordReset = async (email: string) => {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, fullName: true, status: true, hashedPassword: true },
  });

  if (!user || user.status === UserStatus.INACTIVE) {
    return null;
  }

  const resetToken = jwt.sign(
    { sub: user.id, email: user.email, purpose: "password_reset" },
    deriveResetSecret(user.hashedPassword),
    { expiresIn: "15m" },
  );

  const resetUrl = `${env.app.baseUrl}/reset-password?token=${encodeURIComponent(resetToken)}`;

  try {
    await sendPasswordResetLinkEmail({
      to: user.email,
      fullName: user.fullName,
      resetUrl,
    });
  } catch (error) {
    console.error("[mail] Failed to send reset email", error);
  }

  return { userId: user.id };
};

export const confirmPasswordReset = async (token: string, newPassword: string) => {
  const decoded = jwt.decode(token) as { sub?: string; purpose?: string } | null;
  if (!decoded?.sub || decoded.purpose !== "password_reset") {
    const err = new Error("Invalid or expired reset token");
    (err as Error & { status: number }).status = 400;
    throw err;
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.sub },
    select: { id: true, status: true, hashedPassword: true },
  });

  if (!user || user.status === UserStatus.INACTIVE) {
    const err = new Error("Invalid or expired reset token");
    (err as Error & { status: number }).status = 400;
    throw err;
  }

  try {
    const verified = jwt.verify(token, deriveResetSecret(user.hashedPassword)) as {
      sub?: string;
      purpose?: string;
    };
    if (verified.sub !== user.id || verified.purpose !== "password_reset") {
      throw new Error("Token mismatch");
    }
  } catch {
    const err = new Error("Invalid or expired reset token");
    (err as Error & { status: number }).status = 400;
    throw err;
  }

  const hashedPassword = await hashPassword(newPassword);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      hashedPassword,
      ...(user.status === UserStatus.INVITED ? { status: UserStatus.ACTIVE } : {}),
    },
  });

  return { userId: user.id };
};
