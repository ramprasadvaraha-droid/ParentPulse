import { NextResponse } from 'next/server';

import { readInstitutionSession } from '@/lib/institution-session';
import { calculatePaymentStatus } from '@/lib/payment-status';

async function getInstitutionAdmin(request: Request) {
  const session = readInstitutionSession(request.headers.get('cookie'));
  if (!session || session.role !== 'ADMIN') {
    return { response: NextResponse.json({ error: 'Institution administrator sign-in required.' }, { status: 401 }) };
  }

  const { default: prisma } = await import('@/lib/prisma');
  const admin = await prisma.user.findFirst({
    where: {
      id: session.userId,
      institution_id: session.institutionId,
      role: 'ADMIN',
      status: 'ACTIVE',
      institution: { status: 'ACTIVE' },
    },
    select: { id: true, institution_id: true, institution: { select: { timezone: true } } },
  });
  if (!admin) {
    return { response: NextResponse.json({ error: 'Institution administrator sign-in required.' }, { status: 401 }) };
  }
  return { prisma, admin };
}

export async function GET(request: Request) {
  try {
    const access = await getInstitutionAdmin(request);
    if ('response' in access) return access.response;

    const currentPeriod = new Intl.DateTimeFormat('en-US', {
      timeZone: access.admin.institution.timezone,
      year: 'numeric',
      month: 'numeric',
    }).formatToParts(new Date());
    const year = Number(currentPeriod.find((part) => part.type === 'year')?.value);
    const month = Number(currentPeriod.find((part) => part.type === 'month')?.value);

    const students = await access.prisma.student.findMany({
      where: { institution_id: access.admin.institution_id, status: 'ACTIVE' },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        essl_id: true,
        monthly_fee: true,
        parent: { select: { name: true } },
        fee_dues: {
          where: { institution_id: access.admin.institution_id, month, year },
          take: 1,
          select: {
            amount_due: true,
            payment_entries: {
              where: { institution_id: access.admin.institution_id },
              select: { amount: true, is_reversal: true },
            },
          },
        },
      },
    });
    const [workerHeartbeat, lastReminder] = await Promise.all([
      access.prisma.notificationLog.findFirst({
        where: {
          institution_id: access.admin.institution_id,
          channel: 'WHATSAPP',
          template_key: 'fee_reminder_worker',
          target_id: 'worker',
        },
        orderBy: { updated_at: 'desc' },
        select: { status: true, updated_at: true },
      }),
      access.prisma.notificationLog.findFirst({
        where: {
          institution_id: access.admin.institution_id,
          channel: 'WHATSAPP',
          template_key: { startsWith: 'fee_reminder_' },
          target_id: { not: 'worker' },
        },
        orderBy: { created_at: 'desc' },
        select: { status: true, created_at: true },
      }),
    ]);

    const candidates = students.map((student) => {
      const due = student.fee_dues[0];
      const amountDue = Number(due?.amount_due ?? student.monthly_fee);
      const payment = calculatePaymentStatus(
        amountDue,
        due?.payment_entries.map((entry) => ({
          amount: Number(entry.amount),
          isReversal: entry.is_reversal,
        })) ?? [],
      );
      return {
        id: student.id,
        name: student.name,
        studentId: student.essl_id,
        parentName: student.parent?.name ?? null,
        amountDue,
        ...payment,
      };
    });

    return NextResponse.json({
      period: `${String(month).padStart(2, '0')}/${year}`,
      summary: {
        paid: candidates.filter((candidate) => candidate.status === 'PAID').length,
        pending: candidates.filter((candidate) => candidate.status === 'PENDING').length,
      },
      paid: candidates.filter((candidate) => candidate.status === 'PAID'),
      pending: candidates.filter((candidate) => candidate.status === 'PENDING'),
      reminders: {
        configured: Boolean(process.env.WHATSAPP_API_KEY && process.env.WHATSAPP_SENDER_ID),
        workerRunning: workerHeartbeat?.status === 'RUNNING'
          && Date.now() - workerHeartbeat.updated_at.getTime() < 3 * 60_000,
        lastStatus: lastReminder?.status ?? null,
        lastAttemptAt: lastReminder?.created_at.toISOString() ?? null,
      },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Unable to load payment status.' }, { status: 503 });
  }
}