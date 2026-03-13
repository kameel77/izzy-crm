import { describe, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { submitApplicationForm } from '../application-form.service';

const prisma = new PrismaClient();

describe('Test Submit', () => {
  it('submits correctly', async () => {
    const form = await prisma.applicationForm.findFirst({});
    if (!form) return;

    if (form.status === 'SUBMITTED') {
      await prisma.applicationForm.update({
        where: { id: form.id },
        data: { status: 'IN_PROGRESS' }
      });
    }

    try {
      const res = await submitApplicationForm(form.id, form.formData || {});
      console.log('Success:', res.id);
    } catch (err: any) {
      console.error('Failed to submit:', err.message);
      throw err;
    }
  });
});
