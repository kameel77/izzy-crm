import { PartnerStatus, Prisma } from "@prisma/client";

import { prisma } from "../lib/prisma.js";

const partnerSummarySelect = {
  id: true,
  name: true,
  status: true,
  contact: true,
  slaRules: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PartnerSelect;

export interface PartnerContactInput {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  [key: string]: string | null | undefined;
}

export type PartnerSlaRulesInput = Record<string, string | number | boolean | null>;

const serializeJson = (
  value?: PartnerSlaRulesInput | null,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined => {
  if (typeof value === "undefined") return undefined;
  if (value === null) return Prisma.JsonNull;
  return value as Prisma.JsonObject;
};

const serializeContact = (
  value?: PartnerContactInput | null,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined => {
  if (typeof value === "undefined") return undefined;
  if (value === null) return Prisma.JsonNull;
  return value as Prisma.JsonObject;
};

export interface ListPartnersFilters {
  status?: PartnerStatus;
  search?: string;
  skip: number;
  take: number;
}

export const listPartners = async (filters: ListPartnersFilters) => {
  const where: Prisma.PartnerWhereInput = {};

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.search) {
    const searchTerm = filters.search.trim();
    if (searchTerm) {
      where.OR = [
        { name: { contains: searchTerm, mode: "insensitive" } },
        { notes: { contains: searchTerm, mode: "insensitive" } },
      ];
    }
  }

  const [items, total] = await prisma.$transaction([
    prisma.partner.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: filters.skip,
      take: filters.take,
      select: partnerSummarySelect,
    }),
    prisma.partner.count({ where }),
  ]);

  return { items, total };
};

export interface CreatePartnerInput {
  name: string;
  status?: PartnerStatus;
  contact?: PartnerContactInput | null;
  slaRules?: PartnerSlaRulesInput | null;
  notes?: string | null;
}

export const createPartner = async (input: CreatePartnerInput) => {
  const partner = await prisma.partner.create({
    data: {
      name: input.name,
      status: input.status ?? PartnerStatus.ACTIVE,
      contact: serializeContact(input.contact),
      slaRules: serializeJson(input.slaRules),
      notes: input.notes ?? null,
    },
    select: partnerSummarySelect,
  });

  return partner;
};

export interface UpdatePartnerInput {
  id: string;
  name?: string;
  status?: PartnerStatus;
  contact?: PartnerContactInput | null;
  slaRules?: PartnerSlaRulesInput | null;
  notes?: string | null;
}

export const updatePartner = async (input: UpdatePartnerInput) => {
  const data: Prisma.PartnerUpdateInput = {};

  if (typeof input.name !== "undefined") {
    data.name = input.name;
  }

  if (typeof input.status !== "undefined") {
    data.status = input.status;
  }

  const serializedContact = serializeContact(input.contact);
  if (typeof serializedContact !== "undefined") {
    data.contact = serializedContact;
  }

  const serializedSla = serializeJson(input.slaRules);
  if (typeof serializedSla !== "undefined") {
    data.slaRules = serializedSla;
  }

  if (typeof input.notes !== "undefined") {
    data.notes = input.notes;
  }

  try {
    const partner = await prisma.partner.update({
      where: { id: input.id },
      data,
      select: partnerSummarySelect,
    });

    return partner;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      const notFound = new Error("Partner not found");
      (notFound as Error & { status: number }).status = 404;
      throw notFound;
    }

    throw error;
  }
};
