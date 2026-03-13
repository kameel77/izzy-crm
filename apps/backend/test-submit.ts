import { submitApplicationForm } from "./src/services/application-form.service.js";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function run() {
  const form = await prisma.applicationForm.findFirst({ where: { status: 'IN_PROGRESS' } });
  if (!form) { console.log("no form found"); return; }
  try {
    const res = await submitApplicationForm(form.id, form.formData || { consents: [] });
    console.log("Success", res);
  } catch (e) {
    console.error("Error", e);
  }
}
run().finally(() => process.exit(0));
