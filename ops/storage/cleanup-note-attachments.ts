import dotenv from "dotenv";

import { PrismaClient } from "@prisma/client";

import { deleteStoredFile } from "../../apps/backend/src/utils/upload.js";

dotenv.config();

const prisma = new PrismaClient();

const batchSize = Number.parseInt(process.env.CLEANUP_BATCH_SIZE ?? "50", 10) || 50;

const runCleanup = async () => {
  const attachments = await prisma.leadNoteAttachment.findMany({
    where: {
      deletedAt: { not: null },
    },
    take: batchSize,
  });

  if (!attachments.length) {
    return { processed: 0 };
  }

  for (const attachment of attachments) {
    await deleteStoredFile({
      storageProvider: attachment.storageProvider,
      storageKey: attachment.storageKey ?? undefined,
    });

    await prisma.leadNoteAttachment.delete({
      where: { id: attachment.id },
    });
  }

  return { processed: attachments.length };
};

runCleanup()
  .then(async ({ processed }) => {
    // eslint-disable-next-line no-console
    console.log(`Cleanup finished. Removed ${processed} attachments.`);
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    // eslint-disable-next-line no-console
    console.error("Cleanup failed", error);
    await prisma.$disconnect();
    process.exit(1);
  });
