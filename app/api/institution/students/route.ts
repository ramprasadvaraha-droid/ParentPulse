import { NextResponse } from 'next/server';
import { z } from 'zod';

import { readInstitutionSession } from '@/lib/institution-session';

const studentInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  studentId: z.string().trim().min(2).max(40),
  parentName: z.string().trim().min(2).max(120),
  parentPhone: z.string().trim().min(7).max(20).regex(/^\+?[0-9 ()-]+$/),
  whatsappRemindersOptedIn: z.boolean().default(false),
  whatsappAlertsOptedIn: z.boolean().default(false),
  joinedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }),
  monthlyFee: z.number().finite().min(0).max(10_000_000),
  roomId: z.string().uuid(),
  bedNumber: z.number().int().min(1).max(4),
});

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
    select: { id: true, institution_id: true },
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

    const students = await access.prisma.student.findMany({
      where: { institution_id: access.admin.institution_id },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        essl_id: true,
        current_status: true,
        status_since: true,
        parent: { select: { name: true, whatsapp_number: true, whatsapp_reminders_opted_in: true, whatsapp_alerts_opted_in: true } },
        room: { select: { name: true, floor: true } },
        bed_number: true,
        joined_date: true,
        monthly_fee: true,
      },
    });
    return NextResponse.json({
      students: students.map((student) => ({
        id: student.id,
        name: student.name,
        studentId: student.essl_id,
        currentStatus: student.current_status,
        statusSince: student.status_since.toISOString(),
        parentName: student.parent?.name ?? null,
        parentPhone: student.parent?.whatsapp_number ?? null,
        whatsappRemindersOptedIn: student.parent?.whatsapp_reminders_opted_in ?? false,
        whatsappAlertsOptedIn: student.parent?.whatsapp_alerts_opted_in ?? false,
        roomName: student.room?.name ?? null,
        floor: student.room?.floor ?? null,
        bedNumber: student.bed_number,
        joinedDate: student.joined_date.toISOString().slice(0, 10),
        monthlyFee: Number(student.monthly_fee),
      })),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({
      error: 'Unable to load student records. Check the database connection and apply pending local Prisma migrations.',
    }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  try {
    if (request.headers.get('origin') !== new URL(request.url).origin) {
      return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });
    }

    const access = await getInstitutionAdmin(request);
    if ('response' in access) return access.response;

    const parsed = z.object({
      studentId: z.string().uuid(),
      currentStatus: z.enum(['INSIDE', 'OUTSIDE']).optional(),
      whatsappRemindersOptedIn: z.boolean().optional(),
      whatsappAlertsOptedIn: z.boolean().optional(),
    }).refine((value) => [
      value.currentStatus,
      value.whatsappRemindersOptedIn,
      value.whatsappAlertsOptedIn,
    ].filter((field) => field !== undefined).length === 1, {
      message: 'Provide one student status or consent update.',
    }).safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Select a student and provide one valid status or consent update.' }, { status: 400 });
    }

    const student = await access.prisma.student.findFirst({
      where: { id: parsed.data.studentId, institution_id: access.admin.institution_id },
      select: { parent_id: true, current_status: true, status_since: true },
    });
    if (!student) {
      return NextResponse.json({ error: 'Student record was not found.' }, { status: 404 });
    }

    if (parsed.data.currentStatus) {
      if (student.current_status === parsed.data.currentStatus) {
        return NextResponse.json({
          currentStatus: student.current_status,
          statusSince: student.status_since.toISOString(),
        });
      }
      const statusSince = new Date();
      await access.prisma.$transaction([
        access.prisma.student.updateMany({
          where: { id: parsed.data.studentId, institution_id: access.admin.institution_id },
          data: { current_status: parsed.data.currentStatus, status_since: statusSince },
        }),
        access.prisma.auditLog.create({
          data: {
            institution_id: access.admin.institution_id,
            user_id: access.admin.id,
            action: 'STUDENT_PRESENCE_UPDATED',
            entity: 'student',
            entity_id: parsed.data.studentId,
            metadata: { current_status: parsed.data.currentStatus },
          },
        }),
      ]);
      return NextResponse.json({ currentStatus: parsed.data.currentStatus, statusSince: statusSince.toISOString() });
    }

    if (!student.parent_id) {
      return NextResponse.json({ error: 'Student guardian record was not found.' }, { status: 404 });
    }
    const reminderConsent = parsed.data.whatsappRemindersOptedIn;
    const safetyConsent = parsed.data.whatsappAlertsOptedIn;
    await access.prisma.$transaction([
      access.prisma.parent.updateMany({
        where: { id: student.parent_id, institution_id: access.admin.institution_id },
        data: reminderConsent !== undefined
          ? { whatsapp_reminders_opted_in: reminderConsent }
          : { whatsapp_alerts_opted_in: safetyConsent! },
      }),
      access.prisma.auditLog.create({
        data: {
          institution_id: access.admin.institution_id,
          user_id: access.admin.id,
          action: reminderConsent !== undefined
            ? 'WHATSAPP_FEE_REMINDER_CONSENT_UPDATED'
            : 'WHATSAPP_SAFETY_ALERT_CONSENT_UPDATED',
          entity: 'parent',
          entity_id: student.parent_id,
          metadata: {
            student_id: parsed.data.studentId,
            opted_in: reminderConsent ?? safetyConsent,
          },
        },
      }),
    ]);

    return NextResponse.json(reminderConsent !== undefined
      ? { whatsappRemindersOptedIn: reminderConsent }
      : { whatsappAlertsOptedIn: safetyConsent });
  } catch {
    return NextResponse.json({ error: 'Unable to update WhatsApp reminder consent.' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    if (request.headers.get('origin') !== new URL(request.url).origin) {
      return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });
    }

    const access = await getInstitutionAdmin(request);
    if ('response' in access) return access.response;

    const parsed = studentInputSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Enter the student, guardian, joined date, fee, room, and bed details.' }, { status: 400 });
    }

    const digits = parsed.data.parentPhone.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15) {
      return NextResponse.json({ error: 'Enter a phone number with 7-15 digits.' }, { status: 400 });
    }
    const phone = parsed.data.parentPhone.trim().startsWith('+') ? `+${digits}` : digits;

    const created = await access.prisma.$transaction(async (transaction) => {
      const room = await transaction.room.findFirst({
        where: { id: parsed.data.roomId, institution_id: access.admin.institution_id },
        select: { id: true, name: true, floor: true, total_beds: true },
      });
      if (!room) throw new Error('ROOM_NOT_FOUND');
      if (parsed.data.bedNumber > room.total_beds) throw new Error('BED_OUT_OF_RANGE');

      const occupiedBed = await transaction.student.findFirst({
        where: {
          institution_id: access.admin.institution_id,
          room_id: room.id,
          bed_number: parsed.data.bedNumber,
        },
        select: { id: true },
      });
      if (occupiedBed) throw new Error('BED_OCCUPIED');

      const parent = await transaction.parent.upsert({
        where: {
          institution_id_whatsapp_number: {
            institution_id: access.admin.institution_id,
            whatsapp_number: phone,
          },
        },
        update: {
          name: parsed.data.parentName,
          ...(parsed.data.whatsappRemindersOptedIn ? { whatsapp_reminders_opted_in: true } : {}),
          ...(parsed.data.whatsappAlertsOptedIn ? { whatsapp_alerts_opted_in: true } : {}),
        },
        create: {
          institution_id: access.admin.institution_id,
          name: parsed.data.parentName,
          whatsapp_number: phone,
          whatsapp_reminders_opted_in: parsed.data.whatsappRemindersOptedIn,
          whatsapp_alerts_opted_in: parsed.data.whatsappAlertsOptedIn,
        },
      });
      const student = await transaction.student.create({
        data: {
          institution_id: access.admin.institution_id,
          parent_id: parent.id,
          room_id: room.id,
          bed_number: parsed.data.bedNumber,
          essl_id: parsed.data.studentId,
          name: parsed.data.name,
          joined_date: new Date(`${parsed.data.joinedDate}T00:00:00.000Z`),
          monthly_fee: parsed.data.monthlyFee,
          status: 'ACTIVE',
        },
      });
      await transaction.auditLog.create({
        data: {
          institution_id: access.admin.institution_id,
          user_id: access.admin.id,
          action: 'STUDENT_REGISTERED',
          entity: 'student',
          entity_id: student.id,
          metadata: { essl_id: student.essl_id, parent_id: parent.id },
        },
      });
      return { student, parent, room };
    });

    return NextResponse.json({
      student: {
        id: created.student.id,
        name: created.student.name,
        studentId: created.student.essl_id,
        currentStatus: created.student.current_status,
        statusSince: created.student.status_since.toISOString(),
        parentName: created.parent.name,
        parentPhone: created.parent.whatsapp_number,
        whatsappRemindersOptedIn: created.parent.whatsapp_reminders_opted_in,
        whatsappAlertsOptedIn: created.parent.whatsapp_alerts_opted_in,
        roomName: created.room.name,
        floor: created.room.floor,
        bedNumber: created.student.bed_number,
        joinedDate: created.student.joined_date.toISOString().slice(0, 10),
        monthlyFee: Number(created.student.monthly_fee),
      },
    }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof Error && error.message === 'ROOM_NOT_FOUND') {
      return NextResponse.json({ error: 'Selected room does not belong to this institution.' }, { status: 404 });
    }
    if (error instanceof Error && error.message === 'BED_OUT_OF_RANGE') {
      return NextResponse.json({ error: 'Selected bed number exceeds this room’s capacity.' }, { status: 400 });
    }
    if (error instanceof Error && error.message === 'BED_OCCUPIED') {
      return NextResponse.json({ error: 'That bed is already assigned. Choose an available bed.' }, { status: 409 });
    }
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      const constraint = 'meta' in error && typeof error.meta === 'object' && error.meta !== null && 'target' in error.meta
        ? String(error.meta.target)
        : '';
      return NextResponse.json({
        error: constraint.includes('room_id')
          ? 'That bed was just assigned. Choose another available bed.'
          : 'That student ID is already registered at this institution.',
      }, { status: 409 });
    }
    return NextResponse.json({ error: 'Unable to register the student.' }, { status: 503 });
  }
}