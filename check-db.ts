import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Connecting to database...');
        await prisma.$connect();
        console.log('Connected successfully.');

        const userCount = await prisma.user.count();
        console.log(`Found ${userCount} users.`);

        if (userCount > 0) {
            const users = await prisma.user.findMany({ select: { email: true, role: true, status: true } });
            console.log('Users:', users);
        }
    } catch (e) {
        console.error('Error connecting to database:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
