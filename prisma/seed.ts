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
      
        // Seed consent templates
        const consentTypes = [
          {
            type: "PARTNER_DECLARATION",
            title: "Oświadczenie o partnerstwie",
            content: "Oświadczam, że zapoznałem się z warunkami współpracy z partnerem.",
            isRequired: true,
          },
          {
            type: "MARKETING",
            title: "Zgoda marketingowa",
            content: "Zgadzam się na otrzymywanie informacji handlowych drogą elektroniczną.",
            isRequired: false,
          },
          {
            type: "FINANCIAL_PARTNERS",
            title: "Zgoda na przekazanie danych partnerom finansowym",
            content: "Zgadzam się na przekazanie moich danych partnerom finansowym w celu przedstawienia oferty.",
            isRequired: true,
          },
          {
            type: "VEHICLE_PARTNERS",
            title: "Zgoda na przekazanie danych partnerom motoryzacyjnym",
            content: "Zgadzam się na przekazanie moich danych partnerom motoryzacyjnym w celu przedstawienia oferty pojazdu.",
            isRequired: true,
          },
        ];
      
        for (const consent of consentTypes) {
          await prisma.consentTemplate.upsert({
            where: {
              consentType_formType_version: {
                consentType: consent.type as any,
                formType: "financing_application",
                version: 1,
              },
            },
            update: {},
            create: {
              consentType: consent.type as any,
              formType: "financing_application",
              title: consent.title,
              content: consent.content,
              version: 1,
              isActive: true,
              isRequired: consent.isRequired,
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
