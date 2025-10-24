import { LeadStatus, Prisma } from "@prisma/client";

import { prisma } from "../lib/prisma.js";

const toJson = (value?: Record<string, unknown>) =>
  (value as Prisma.InputJsonValue | undefined);

export interface CreateLeadInput {
  partnerId: string;
  sourceMetadata?: Record<string, unknown>;
  notes?: string;
  customer: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    dateOfBirth?: string;
  };
  currentVehicle?: {
    make?: string;
    model?: string;
    year?: number;
    mileage?: number;
    ownershipStatus?: string;
  };
  desiredVehicle?: {
    make?: string;
    model?: string;
    year?: number;
    budget?: number;
    preferences?: Record<string, unknown>;
  };
  financing?: {
    bank?: string;
    loanAmount?: number;
    downPayment?: number;
    termMonths?: number;
    income?: number;
    expenses?: number;
  };
}

export const createLead = async (input: CreateLeadInput) => {
  try {
    const lead = await prisma.lead.create({
      data: {
        partnerId: input.partnerId,
        status: LeadStatus.NEW_LEAD,
        sourceMetadata: toJson(input.sourceMetadata),
        notes: input.notes,
        customerProfile: {
          create: {
            firstName: input.customer.firstName,
            lastName: input.customer.lastName,
            email: input.customer.email,
            phone: input.customer.phone,
            dateOfBirth: input.customer.dateOfBirth
              ? new Date(input.customer.dateOfBirth)
              : undefined,
          },
        },
        vehicleCurrent: input.currentVehicle
          ? {
              create: {
                make: input.currentVehicle.make,
                model: input.currentVehicle.model,
                year: input.currentVehicle.year ?? undefined,
                mileage: input.currentVehicle.mileage ?? undefined,
                ownershipStatus: input.currentVehicle.ownershipStatus,
              },
            }
          : undefined,
        vehicleDesired: input.desiredVehicle
          ? {
              create: {
                make: input.desiredVehicle.make,
                model: input.desiredVehicle.model,
                year: input.desiredVehicle.year ?? undefined,
                budget: input.desiredVehicle.budget
                  ? new Prisma.Decimal(input.desiredVehicle.budget)
                  : undefined,
                preferences: toJson(input.desiredVehicle.preferences),
              },
            }
          : undefined,
        financingApps: input.financing
          ? {
              create: {
                bank: input.financing.bank ?? "TBD",
                loanAmount: input.financing.loanAmount
                  ? new Prisma.Decimal(input.financing.loanAmount)
                  : undefined,
                downPayment: input.financing.downPayment
                  ? new Prisma.Decimal(input.financing.downPayment)
                  : undefined,
                termMonths: input.financing.termMonths ?? undefined,
                income: input.financing.income
                  ? new Prisma.Decimal(input.financing.income)
                  : undefined,
                expenses: input.financing.expenses
                  ? new Prisma.Decimal(input.financing.expenses)
                  : undefined,
              },
            }
          : undefined,
      },
      select: {
        id: true,
        status: true,
        partnerId: true,
        leadCreatedAt: true,
      },
    });

    return lead;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2003") {
        const notFoundError = new Error("Partner not found");
        (notFoundError as Error & { status: number }).status = 404;
        throw notFoundError;
      }
    }

    throw error;
  }
};
