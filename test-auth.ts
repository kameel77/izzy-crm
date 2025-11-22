import { prisma } from "./apps/backend/src/lib/prisma.js";
import { authenticateUser } from "./apps/backend/src/services/auth.service.js";
import { hashPassword } from "./apps/backend/src/utils/password.js";

async function main() {
    const email = "test-auth-script@example.com";
    const password = "password123";

    try {
        console.log("Creating temp user...");
        const hashedPassword = await hashPassword(password);

        // cleanup if exists
        await prisma.user.deleteMany({ where: { email } });

        const user = await prisma.user.create({
            data: {
                email,
                hashedPassword,
                role: "OPERATOR",
                status: "ACTIVE",
                fullName: "Test Auth User",
            },
        });
        console.log("User created:", user.id);

        console.log("Attempting authentication...");
        const result = await authenticateUser(email, password);
        console.log("Authentication successful!");
        console.log("Token:", result.token ? "Generated" : "Missing");
        console.log("User:", result.user.email);

    } catch (error) {
        console.error("Authentication failed:", error);
    } finally {
        console.log("Cleaning up...");
        await prisma.user.deleteMany({ where: { email } });
        await prisma.$disconnect();
    }
}

main();
