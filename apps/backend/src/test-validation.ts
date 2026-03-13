import { PrismaClient } from '@prisma/client';
import { submitApplicationForm } from './services/application-form.service';

const prisma = new PrismaClient();
async function run() {
  const form = await prisma.applicationForm.findFirst({});
  if (!form) {
    console.log('No form found');
    return;
  }
  
  if (form.status === 'SUBMITTED') {
    await prisma.applicationForm.update({
      where: { id: form.id },
      data: { status: 'IN_PROGRESS' }
    });
  }

  console.log('Testing submitApplicationForm on form', form.id);
  
  try {
    const res = await submitApplicationForm(form.id, form.formData || {});
    console.log('Success:', res.id);
  } catch (err) {
    console.error('Failed to submit:', err);
  }
}
run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
