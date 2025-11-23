import { UserStatus } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { signToken } from "../utils/jwt.js";
import { generatePassword, hashPassword, verifyPassword } from "../utils/password.js";
import { sendPasswordResetEmail } from "./mail.service.js";

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
    select: { id: true, email: true, fullName: true },
  });

  if (!user) {
    return null;
  }

  const password = generatePassword();
  const hashedPassword = await hashPassword(password);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      hashedPassword,
      status: UserStatus.ACTIVE,
    },
  });

  try {
    await sendPasswordResetEmail({
      to: user.email,
      fullName: user.fullName,
      password,
    });
  } catch (error) {
    console.error("[mail] Failed to send reset email", error);
  }

  return { userId: user.id };
};
