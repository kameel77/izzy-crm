import { PrismaClient, UserRole, UserStatus, LeadStatus } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  // Seed baseline user (admin) and enumerations if needed.
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@example.com";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "Admin123!";
  const operatorEmail = process.env.SEED_OPERATOR_EMAIL || "operator@example.com";
  const operatorPassword = process.env.SEED_OPERATOR_PASSWORD || "Operator123!";

  const adminHash = await bcrypt.hash(adminPassword, 12);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { hashedPassword: adminHash },
    create: {
      email: adminEmail,
      hashedPassword: adminHash,
      role: UserRole.ADMIN,
      fullName: "Seed Admin",
      status: UserStatus.ACTIVE,
    },
  });

  const partner = await prisma.partner.upsert({
    where: { id: "seed-partner" },
    update: {
      name: "Seed Partner",
    },
    create: {
      id: "seed-partner",
      name: "Seed Partner",
    },
  });

  const operatorHash = await bcrypt.hash(operatorPassword, 12);

  await prisma.user.upsert({
    where: { email: operatorEmail },
    update: {
      hashedPassword: operatorHash,
      partnerId: partner.id,
      status: UserStatus.ACTIVE,
    },
    create: {
      email: operatorEmail,
      hashedPassword: operatorHash,
      role: UserRole.OPERATOR,
      fullName: "Seed Operator",
      status: UserStatus.ACTIVE,
      partnerId: partner.id,
    },
  });

  // Example placeholder to ensure statuses exist in reporting tables if needed.
  const leadStatusValues = Object.values(LeadStatus);
  for (const status of leadStatusValues) {
    await prisma.leadStatusReference.upsert({
      where: { code: status },
      update: {},
      create: {
        code: status,
        description: status.replaceAll("_", " ").toLowerCase(),
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
