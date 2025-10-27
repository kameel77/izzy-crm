import { Prisma, UserRole, UserStatus } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { generatePassword, hashPassword } from "../utils/password.js";

const userSummarySelect = {
  id: true,
  email: true,
  fullName: true,
  phone: true,
  role: true,
  status: true,
  partner: {
    select: {
      id: true,
      name: true,
    },
  },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export interface ListUsersFilters {
  role?: UserRole;
  status?: UserStatus;
  partnerId?: string;
  search?: string;
  skip: number;
  take: number;
}

export const listUsers = async (filters: ListUsersFilters) => {
  const where: Prisma.UserWhereInput = {};

  if (filters.role) {
    where.role = filters.role;
  }

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.partnerId) {
    where.partnerId = filters.partnerId;
  }

  if (filters.search) {
    const searchTerm = filters.search.trim();
    if (searchTerm) {
      where.OR = [
        { email: { contains: searchTerm, mode: "insensitive" } },
        { fullName: { contains: searchTerm, mode: "insensitive" } },
        { phone: { contains: searchTerm, mode: "insensitive" } },
      ];
    }
  }

  const [items, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: filters.skip,
      take: filters.take,
      select: userSummarySelect,
    }),
    prisma.user.count({ where }),
  ]);

  return { items, total };
};

export interface CreateUserInput {
  email: string;
  fullName: string;
  password?: string;
  role: UserRole;
  phone?: string;
  partnerId?: string | null;
  status?: UserStatus;
}

export interface CreateUserResult {
  user: Prisma.UserGetPayload<{ select: typeof userSummarySelect }>;
  initialPassword: string;
  generatedPassword: boolean;
}

export const createUser = async (input: CreateUserInput): Promise<CreateUserResult> => {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });

  if (existing) {
    const error = new Error("Email already in use");
    (error as Error & { status: number }).status = 409;
    throw error;
  }

  const plainPassword = input.password || generatePassword();
  const hashedPassword = await hashPassword(plainPassword);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      fullName: input.fullName,
      phone: input.phone,
      role: input.role,
      status: input.status ?? UserStatus.INVITED,
      partnerId: input.partnerId ?? null,
      hashedPassword,
    },
    select: userSummarySelect,
  });

  return {
    user,
    initialPassword: plainPassword,
    generatedPassword: !input.password,
  };
};

export interface UpdateUserInput {
  id: string;
  fullName?: string;
  phone?: string | null;
  role?: UserRole;
  status?: UserStatus;
  partnerId?: string | null;
  password?: string;
}

export const updateUser = async (input: UpdateUserInput) => {
  const data: Prisma.UserUpdateInput = {};

  if (typeof input.fullName !== "undefined") {
    data.fullName = input.fullName;
  }

  if (typeof input.phone !== "undefined") {
    data.phone = input.phone;
  }

  if (typeof input.role !== "undefined") {
    data.role = input.role;
  }

  if (typeof input.status !== "undefined") {
    data.status = input.status;
  }

  if (typeof input.partnerId !== "undefined") {
    data.partner = input.partnerId ? { connect: { id: input.partnerId } } : { disconnect: true };
  }

  if (typeof input.password !== "undefined") {
    data.hashedPassword = await hashPassword(input.password);
  }

  try {
    const user = await prisma.user.update({
      where: { id: input.id },
      data,
      select: userSummarySelect,
    });

    return user;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      const notFound = new Error("User not found");
      (notFound as Error & { status: number }).status = 404;
      throw notFound;
    }

    throw error;
  }
};

export interface ResetPasswordInput {
  userId: string;
  newPassword: string;
}

export const resetPassword = async (input: ResetPasswordInput) => {
  const hashedPassword = await hashPassword(input.newPassword);

  try {
    const user = await prisma.user.update({
      where: { id: input.userId },
      data: { hashedPassword, status: UserStatus.ACTIVE },
      select: userSummarySelect,
    });

    return user;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      const notFound = new Error("User not found");
      (notFound as Error & { status: number }).status = 404;
      throw notFound;
    }

    throw error;
  }
};
