import { handleCallback } from '@vercel/queue';
import { EmailQueueBusy, processEmailBatch } from '@/lib/emailQueue';

export const runtime = 'nodejs';
export const maxDuration = 60;

export const POST = handleCallback<{ batchId: string }>(
  async message => {
    await processEmailBatch(message.batchId);
  },
  {
    visibilityTimeoutSeconds: 120,
    // Queue delivery can resume database work, but email sends are never retried.
    retry: error => ({
      afterSeconds: error instanceof EmailQueueBusy ? 2 : 120,
    }),
  }
);
