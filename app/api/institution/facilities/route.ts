import { NextResponse } from 'next/server';
import { z } from 'zod';

import { readInstitutionSession } from '@/lib/institution-session';
import { summarizeRooms } from '@/lib/room-summary';

const createFloorSchema = z.object({
  type: z.literal('floor'),
  name: z.string().trim().min(2).max(80),
  institutionId: z.string().uuid().optional(),
});

const createRoomSchema = z.object({
  type: z.literal('room'),
  floorId: z.string().uuid(),
  name: z.string().trim().min(1).max(40),
  beds: z.number().int().min(1).max(4),
  institutionId: z.string().uuid().optional(),
});

async function getFacilityAccess(request: Request, targetInstitutionId?: string) {
  const session = readInstitutionSession(request.headers.get('cookie'));
  if (!session) {
    return { response: NextResponse.json({ error: 'Institution sign-in required.' }, { status: 401 }) };
  }

  const { default: prisma } = await import('@/lib/prisma');
  const user = await prisma.user.findFirst({
    where: {
      id: session.userId,
      institution_id: session.institutionId,
      role: session.role,
      status: 'ACTIVE',
      ...(session.role === 'ADMIN' ? { institution: { status: 'ACTIVE' as const } } : {}),
    },
    select: { id: true, institution_id: true },
  });
  if (!user) {
    return { response: NextResponse.json({ error: 'Institution sign-in required.' }, { status: 401 }) };
  }

  if (session.role === 'ADMIN') return { prisma, institutionId: user.institution_id };
  if (!targetInstitutionId) {
    return { response: NextResponse.json({ error: 'Choose an institution to manage.' }, { status: 400 }) };
  }

  const institution = await prisma.institution.findFirst({
    where: { id: targetInstitutionId, status: 'ACTIVE', code: { not: 'PARENTPULSE' } },
    select: { id: true },
  });
  if (!institution) {
    return { response: NextResponse.json({ error: 'Institution not found.' }, { status: 404 }) };
  }
  return { prisma, institutionId: institution.id };
}

export async function GET(request: Request) {
  try {
    const targetInstitutionId = new URL(request.url).searchParams.get('institutionId') ?? undefined;
    const access = await getFacilityAccess(request, targetInstitutionId);
    if ('response' in access) return access.response;

    const floors = await access.prisma.floor.findMany({
      where: { institution_id: access.institutionId },
      orderBy: { order_index: 'asc' },
      include: {
        rooms: {
          where: { institution_id: access.institutionId },
          orderBy: { name: 'asc' },
          include: {
            students: {
              where: { institution_id: access.institutionId, bed_number: { not: null } },
              select: { bed_number: true },
            },
          },
        },
      },
    });

    const rooms = floors.flatMap((floor) => floor.rooms);
    const summary = summarizeRooms(rooms.map((room) => ({
      totalBeds: room.total_beds,
      occupiedBeds: room.students.length,
    })));

    return NextResponse.json({
      summary,
      floors: floors.map((floor) => ({
        id: floor.id,
        name: floor.name,
        orderIndex: floor.order_index,
        rooms: floor.rooms.map((room) => ({
          id: room.id,
          name: room.name,
          totalBeds: room.total_beds,
          occupiedBeds: room.students.length,
          availableBeds: Math.max(0, room.total_beds - room.students.length),
          occupiedBedNumbers: room.students.flatMap((student) => student.bed_number === null ? [] : [student.bed_number]),
        })),
      })),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Unable to load floors and rooms.' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    if (request.headers.get('origin') !== new URL(request.url).origin) {
      return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || !('type' in body)) {
      return NextResponse.json({ error: 'Choose a floor or room to create.' }, { status: 400 });
    }

    const access = await getFacilityAccess(request, 'institutionId' in body && typeof body.institutionId === 'string' ? body.institutionId : undefined);
    if ('response' in access) return access.response;

    if (body.type === 'floor') {
      const parsed = createFloorSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Enter a floor name with at least 2 characters.' }, { status: 400 });
      }

      const floor = await access.prisma.$transaction(async (transaction) => {
        const latestFloor = await transaction.floor.findFirst({
          where: { institution_id: access.institutionId },
          orderBy: { order_index: 'desc' },
          select: { order_index: true },
        });
        return transaction.floor.create({
          data: {
            institution_id: access.institutionId,
            name: parsed.data.name,
            order_index: (latestFloor?.order_index ?? 0) + 1,
          },
        });
      });

      return NextResponse.json({
        floor: { id: floor.id, name: floor.name, orderIndex: floor.order_index, rooms: [] },
      }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
    }

    const parsed = createRoomSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Choose a floor, enter a room name, and select 1-4 beds.' }, { status: 400 });
    }

    const floor = await access.prisma.floor.findFirst({
      where: { id: parsed.data.floorId, institution_id: access.institutionId },
      select: { id: true, order_index: true },
    });
    if (!floor) return NextResponse.json({ error: 'Floor not found for this institution.' }, { status: 404 });

    const room = await access.prisma.room.create({
      data: {
        institution_id: access.institutionId,
        floor_id: floor.id,
        floor: floor.order_index,
        name: parsed.data.name,
        total_beds: parsed.data.beds,
      },
    });

    return NextResponse.json({
      room: {
        id: room.id,
        name: room.name,
        totalBeds: room.total_beds,
        occupiedBeds: 0,
        availableBeds: room.total_beds,
      },
    }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ error: 'That floor name or room name is already in use.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Unable to save floor or room.' }, { status: 503 });
  }
}