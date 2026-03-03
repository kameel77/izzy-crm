/**
 * Seed script – Insurance Onboarding default data.
 * Run: cd apps/backend && npx tsx src/seeds/insurance-onboarding.seed.ts
 */
import { CommChannel, ConsentType, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    console.log("🌱 Seeding insurance onboarding data…");

    // ── Message Templates ────────────────────────────────────────────────────────
    const templates = [
        {
            key: "sms_welcome_insurance",
            channel: CommChannel.SMS,
            subject: null,
            body: "Cześć {{firstName}}! Ponieważ jesteś w trakcie procesu likwidacji szkody Twojego samochodu, Link4 przesłał nam za Twoją zgodą Twoje dane kontaktowe, abyśmy pomogli Tobie znaleźć nowe auto. Kliknij w link i daj nam znać, kiedy możemy się z Tobą skontaktować: {{link}}",
        },
        {
            key: "email_welcome_insurance",
            channel: CommChannel.EMAIL,
            subject: "Pomożemy Ci znaleźć nowe auto – wybierz termin kontaktu",
            body: "Cześć {{firstName}},\n\nPonieważ jesteś w trakcie procesu likwidacji szkody Twojego samochodu, Link4 przesłał nam za Twoją zgodą Twoje dane kontaktowe, abyśmy pomogli Tobie znaleźć nowe auto.\n\nKliknij w link i daj nam znać, kiedy możemy się z Tobą skontaktować:\n{{link}}\n\nŁączymy się z poważaniem,\nZespół Carsalon",
        },
    ];

    for (const tpl of templates) {
        await prisma.messageTemplate.upsert({
            where: { key: tpl.key },
            create: { ...tpl, isActive: true, version: 1 },
            update: { ...tpl },
        });
        console.log(`  ✓ MessageTemplate: ${tpl.key}`);
    }

    // ── Consent Templates ────────────────────────────────────────────────────────
    const consentTemplates = [
        {
            key: "zgoda_kontakt_tel_onboarding",
            consentType: ConsentType.PHONE_CONTACT,
            title: "Zgoda na kontakt telefoniczny",
            content:
                "Wyrażam zgodę na kontakt telefoniczny przez Carsalon Sp. z o.o. w celu przedstawienia oferty pojazdów zastępczych oraz usług finansowania.",
            helpText: "Zgoda jest wymagana, abyśmy mogli się z Tobą skontaktować.",
            isRequired: true,
            formType: "onboarding_insurance",
        },
        {
            key: "zgoda_instytucje_finansowe_onboarding",
            consentType: ConsentType.FINANCIAL_PARTNERS,
            title: "Zgoda na przekazanie danych do instytucji finansowych",
            content:
                "Wyrażam zgodę na przekazanie moich danych osobowych do instytucji finansowych w celu uzyskania oferty finansowania pojazdu.",
            helpText: null,
            isRequired: true,
            formType: "onboarding_insurance",
        },
        {
            key: "zgoda_dealerzy_onboarding",
            consentType: ConsentType.VEHICLE_PARTNERS,
            title: "Zgoda na przekazanie danych do dealerów samochodowych",
            content:
                "Wyrażam zgodę na przekazanie moich danych osobowych do partnerskich dealerów samochodowych w celu przedstawienia oferty nowych pojazdów.",
            helpText: null,
            isRequired: false,
            formType: "onboarding_insurance",
        },
    ];

    for (const ct of consentTemplates) {
        const existing = await prisma.consentTemplate.findFirst({
            where: { formType: ct.formType, consentType: ct.consentType },
        });

        if (existing) {
            await prisma.consentTemplate.update({
                where: { id: existing.id },
                data: {
                    title: ct.title,
                    content: ct.content,
                    helpText: ct.helpText ?? undefined,
                    isRequired: ct.isRequired,
                    isActive: true,
                },
            });
            console.log(`  ✓ Updated ConsentTemplate: ${ct.title}`);
        } else {
            await prisma.consentTemplate.create({
                data: {
                    consentType: ct.consentType,
                    title: ct.title,
                    content: ct.content,
                    helpText: ct.helpText ?? undefined,
                    isRequired: ct.isRequired,
                    isActive: true,
                    formType: ct.formType,
                    version: 1,
                },
            });
            console.log(`  ✓ Created ConsentTemplate: ${ct.title}`);
        }
    }

    console.log("✅ Done!");
}

main()
    .catch((e) => {
        console.error("❌ Seed failed:", e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
