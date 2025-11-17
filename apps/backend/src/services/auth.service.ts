import { prisma } from "../lib/prisma.js";
import { verifyPassword } from "../utils/password.js";
import { signToken } from "../utils/jwt.js";

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
