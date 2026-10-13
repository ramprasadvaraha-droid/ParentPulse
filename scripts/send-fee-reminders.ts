import { calculatePaymentStatus } from '../src/lib/payment-status';
import { isAlternateFeeReminderDay } from '../src/lib/fee-reminders';
import { getPresenceAlertLevels } from '../src/lib/student-presence';

type WhatsAppResponse = {
  messages?: Array<{ id?: string }>;
  error?: { message?: string };
};

function localDate(now: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function isUniqueConstraintError(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

async function sendTemplateMessage(input: {
  phone: string;
  templateName: string;
  parameters: string[];
}) {
  const token = process.env.WHATSAPP_API_KEY;
  const senderId = process.env.WHATSAPP_SENDER_ID;
  const templatePrefix = process.env.WHATSAPP_TEMPLATE_PREFIX ?? 'parentpulse';
  const apiVersion = process.env.WHATSAPP_GRAPH_API_VERSION ?? 'v23.0';
  if (!token || !senderId) throw new Error('Set WHATSAPP_API_KEY and WHATSAPP_SENDER_ID to enable delivery.');
  if (!/^v\d+\.\d+$/.test(apiVersion)) throw new Error('WHATSAPP_GRAPH_API_VERSION is invalid.');

  const response = await fetch(`https://graph.facebook.com/${apiVersion}/${senderId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: input.phone.replace(/\D/g, ''),
      type: 'template',
      template: {
        name: `${templatePrefix}_${input.templateName}`,
        language: { code: 'en' },
        components: [{
          type: 'body',
          parameters: [
            ...input.parameters.map((text) => ({ type: 'text', text })),
          ],
        }],
      },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const result = await response.json() as WhatsAppResponse;
  if (!response.ok) {
    throw new Error(result.error?.message ?? `WhatsApp API returned ${response.status}.`);
  }
  return result.messages?.[0]?.id ?? null;
}

async function claimReminder(prisma: typeof import('../src/lib/prisma').default, input: {
  institutionId: string;
  studentId: string;
  templateKey: string;
}) {
  const where = {
    institution_id: input.institutionId,
    channel: 'WHATSAPP',
    template_key: input.templateKey,
    target_id: input.studentId,
  };
  const previous = await prisma.notificationLog.findFirst({ where });
  if (previous?.status === 'SENT' || previous?.status === 'FAILED' || (previous && previous.retries >= 5)) return null;
  if (previous?.status === 'PROCESSING' && Date.now() - previous.updated_at.getTime() < 15 * 60_000) return null;

  if (!previous) {
    try {
      return await prisma.notificationLog.create({
        data: { ...where, status: 'PROCESSING', retries: 1 },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) return null;
      throw error;
    }
  }

  const claimed = await prisma.notificationLog.updateMany({
    where: { id: previous.id, status: previous.status, updated_at: previous.updated_at },
    data: { status: 'PROCESSING', retries: { increment: 1 } },
  });
  return claimed.count ? prisma.notificationLog.findUnique({ where: { id: previous.id } }) : null;
}

async function updateWorkerHeartbeat(
  prisma: typeof import('../src/lib/prisma').default,
  institutionId: string,
  status: 'RUNNING' | 'STOPPED',
) {
  const where = {
    institution_id: institutionId,
    channel: 'WHATSAPP',
    template_key: 'fee_reminder_worker',
    target_id: 'worker',
  };
  await prisma.notificationLog.upsert({
    where: {
      institution_id_channel_template_key_target_id: where,
    },
    create: { ...where, status },
    update: { status },
  });
}

async function processInstitution(prisma: typeof import('../src/lib/prisma').default, institution: {
  id: string;
  timezone: string;
}) {
  const today = localDate(new Date(), institution.timezone);
  const [year, month] = today.split('-').map(Number);
  const templateKey = `fee_reminder_${today.replace(/-/g, '')}`;
  const billingMonth = new Intl.DateTimeFormat('en', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)));
  const students = await prisma.student.findMany({
    where: { institution_id: institution.id, status: 'ACTIVE' },
    select: {
      id: true,
      name: true,
      joined_date: true,
      monthly_fee: true,
      parent: { select: { whatsapp_number: true, whatsapp_reminders_opted_in: true } },
      fee_dues: {
        where: { institution_id: institution.id, month, year },
        take: 1,
        select: {
          amount_due: true,
          status: true,
          payment_entries: {
            where: { institution_id: institution.id },
            select: { amount: true, is_reversal: true },
          },
        },
      },
    },
  });

  let sent = 0;
  for (const student of students) {
    const phone = student.parent?.whatsapp_number;
    const joinedDate = student.joined_date.toISOString().slice(0, 10);
    if (!phone || !student.parent?.whatsapp_reminders_opted_in || !isAlternateFeeReminderDay(joinedDate, today)) continue;

    const due = student.fee_dues[0];
    if (due?.status === 'WAIVED') continue;
    const payment = calculatePaymentStatus(
      Number(due?.amount_due ?? student.monthly_fee),
      due?.payment_entries.map((entry) => ({
        amount: Number(entry.amount),
        isReversal: entry.is_reversal,
      })) ?? [],
    );
    if (payment.balance <= 0) continue;

    const reminder = await claimReminder(prisma, {
      institutionId: institution.id,
      studentId: student.id,
      templateKey,
    });
    if (!reminder) continue;

    try {
      const providerRef = await sendTemplateMessage({
        phone,
        templateName: 'fee_reminder',
        parameters: [
          student.name,
          billingMonth,
          new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(payment.balance),
        ],
      });
      await prisma.notificationLog.update({
        where: { id: reminder.id },
        data: { status: 'SENT', provider_ref: providerRef },
      });
      sent += 1;
    } catch (error) {
      await prisma.notificationLog.update({
        where: { id: reminder.id },
        data: { status: 'FAILED' },
      });
      console.error(`Fee reminder failed for student ${student.id}:`, error);
    }
  }
  return sent;
}

async function processPresenceAlerts(prisma: typeof import('../src/lib/prisma').default, institution: {
  id: string;
}) {
  const now = new Date();
  const students = await prisma.student.findMany({
    where: { institution_id: institution.id, status: 'ACTIVE', current_status: 'OUTSIDE' },
    select: {
      id: true,
      name: true,
      essl_id: true,
      current_status: true,
      status_since: true,
      parent: { select: { whatsapp_number: true, whatsapp_alerts_opted_in: true } },
    },
  });
  const wardens = await prisma.user.findMany({
    where: {
      institution_id: institution.id,
      role: 'WARDEN',
      status: 'ACTIVE',
      phone_number: { not: null },
    },
    select: { id: true, phone_number: true },
  });
  const wardenRecipients = wardens
    .filter((warden): warden is typeof warden & { phone_number: string } => Boolean(warden.phone_number))
    .map((warden) => ({ id: warden.id, phone: warden.phone_number }));
  if (!wardenRecipients.length && process.env.WHATSAPP_WARDEN_PHONE) {
    wardenRecipients.push({ id: 'local-warden', phone: process.env.WHATSAPP_WARDEN_PHONE });
  }

  let sent = 0;
  for (const student of students) {
    const elapsedHours = Math.floor((now.getTime() - student.status_since.getTime()) / 3_600_000);
    const levels = getPresenceAlertLevels(
      student.current_status,
      student.status_since.toISOString(),
      now.toISOString(),
    );
    const episodeId = student.status_since.toISOString().replace(/[^0-9]/g, '');

    if (levels.includes('WARDEN_2H')) {
      for (const warden of wardenRecipients) {
        const notification = await claimReminder(prisma, {
          institutionId: institution.id,
          studentId: `${student.id}:${warden.id}`,
          templateKey: `absence_warden_2h_${episodeId}`,
        });
        if (!notification) continue;
        try {
          const providerRef = await sendTemplateMessage({
            phone: warden.phone,
            templateName: 'student_absence_warden_2h',
            parameters: [student.name, student.essl_id, `${elapsedHours} hours`],
          });
          await prisma.notificationLog.update({
            where: { id: notification.id },
            data: { status: 'SENT', provider_ref: providerRef },
          });
          sent += 1;
        } catch (error) {
          await prisma.notificationLog.update({ where: { id: notification.id }, data: { status: 'FAILED' } });
          console.error(`Warden absence alert failed for student ${student.id}:`, error);
        }
      }
    }

    const parentPhone = student.parent?.whatsapp_number;
    if (!levels.includes('PARENT_4H') || !parentPhone || !student.parent?.whatsapp_alerts_opted_in) continue;
    const notification = await claimReminder(prisma, {
      institutionId: institution.id,
      studentId: student.id,
      templateKey: `absence_parent_4h_${episodeId}`,
    });
    if (!notification) continue;
    try {
      const providerRef = await sendTemplateMessage({
        phone: parentPhone,
        templateName: 'student_absence_parent_4h',
        parameters: [student.name, student.essl_id, `${elapsedHours} hours`],
      });
      await prisma.notificationLog.update({
        where: { id: notification.id },
        data: { status: 'SENT', provider_ref: providerRef },
      });
      sent += 1;
    } catch (error) {
      await prisma.notificationLog.update({ where: { id: notification.id }, data: { status: 'FAILED' } });
      console.error(`Parent absence alert failed for student ${student.id}:`, error);
    }
  }
  return sent;
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL in .env.development.local.');
  if (!process.env.WHATSAPP_API_KEY || !process.env.WHATSAPP_SENDER_ID) {
    throw new Error('Set WHATSAPP_API_KEY and WHATSAPP_SENDER_ID in .env.development.local.');
  }
  const interval = Number(process.env.WHATSAPP_REMINDER_INTERVAL_MS ?? 60_000);
  if (!Number.isFinite(interval) || interval < 10_000) {
    throw new Error('WHATSAPP_REMINDER_INTERVAL_MS must be at least 10000.');
  }

  const { default: prisma } = await import('../src/lib/prisma');
  let cycleRunning = false;
  const runCycle = async () => {
    if (cycleRunning) return;
    cycleRunning = true;
    try {
      const institutions = await prisma.institution.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, timezone: true },
      });
      let sent = 0;
      for (const institution of institutions) {
        try {
          await updateWorkerHeartbeat(prisma, institution.id, 'RUNNING');
          sent += await processInstitution(prisma, institution);
          sent += await processPresenceAlerts(prisma, institution);
        } catch (error) {
          console.error(`Fee reminder check failed for institution ${institution.id}:`, error);
        }
      }
      if (sent) console.info(`Sent ${sent} WhatsApp notification${sent === 1 ? '' : 's'}.`);
    } finally {
      cycleRunning = false;
    }
  };

  await runCycle();
  const timer = setInterval(() => void runCycle(), interval);
  const shutdown = async () => {
    clearInterval(timer);
    const institutions = await prisma.institution.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true },
    });
    await Promise.all(institutions.map((institution) =>
      updateWorkerHeartbeat(prisma, institution.id, 'STOPPED'),
    ));
    await prisma.$disconnect();
    process.exit(0);
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  console.info(`Local fee reminder worker is running; checking every ${interval}ms.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});