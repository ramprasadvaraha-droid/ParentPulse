import { NextResponse } from 'next/server';
import { z } from 'zod';

import { hashPassword } from '@/lib/auth';
import { readInstitutionSession } from '@/lib/institution-session';
import { generateAccountPassword } from '@/lib/password-policy';

const institutionInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9][A-Z0-9-]{1,19}$/),
  adminName: z.string().trim().min(2).max(120),
  adminEmail: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
});

async function getPlatformOwner(request: Request) {
  const session = readInstitutionSession(request.headers.get('cookie'));
  if (!session) return { response: NextResponse.json({ error: 'Sign in required.' }, { status: 401 }) };
  if (session.role !== 'SUPER_ADMIN') {
    return { response: NextResponse.json({ error: 'Platform owner access required.' }, { status: 403 }) };
  }

  const { default: prisma } = await import('@/lib/prisma');
  const owner = await prisma.user.findFirst({
    where: {
      id: session.userId,
      institution_id: session.institutionId,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
    },
    select: { id: true },
  });
  if (!owner) return { response: NextResponse.json({ error: 'Platform owner access required.' }, { status: 403 }) };
  return { prisma };
}

export async function GET(request: Request) {
  try {
    const access = await getPlatformOwner(request);
    if ('response' in access) return access.response;

    const institutions = await access.prisma.institution.findMany({
      where: { code: { not: 'PARENTPULSE' } },
      orderBy: { created_at: 'asc' },
      select: {
        id: true,
        name: true,
        code: true,
        status: true,
        created_at: true,
        users: {
          where: { role: 'ADMIN', status: 'ACTIVE' },
          select: { email: true },
          take: 1,
        },
      },
    });
    return NextResponse.json({
      institutions: institutions.map(({ users, created_at, ...institution }) => ({
        ...institution,
        adminEmail: users[0]?.email ?? null,
        createdAt: created_at.toISOString(),
      })),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Unable to load institutions.' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    if (request.headers.get('origin') !== new URL(request.url).origin) {
      return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });
    }

    const access = await getPlatformOwner(request);
    if ('response' in access) return access.response;

    const parsed = institutionInputSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Check the institution and administrator details.' }, { status: 400 });
    }

    const existingManagementAccount = await access.prisma.user.findFirst({
      where: {
        email: parsed.data.adminEmail,
        role: { in: ['ADMIN', 'SUPER_ADMIN'] },
      },
      select: { id: true },
    });
    if (existingManagementAccount) {
      return NextResponse.json({
        error: 'Use a different email from every ParentPulse owner and institution administrator.',
      }, { status: 409 });
    }

    const password = generateAccountPassword();
    const passwordHash = await hashPassword(password);
    const created = await access.prisma.$transaction(async (transaction) => {
      const institution = await transaction.institution.create({
        data: {
          name: parsed.data.name,
          code: parsed.data.code,
          status: 'ACTIVE',
        },
      });
      const admin = await transaction.user.create({
        data: {
          institution_id: institution.id,
          name: parsed.data.adminName,
          email: parsed.data.adminEmail,
          password_hash: passwordHash,
          role: 'ADMIN',
          status: 'ACTIVE',
        },
      });
      await transaction.auditLog.create({
        data: {
          institution_id: institution.id,
          action: 'INSTITUTION_PROVISIONED',
          entity: 'institution',
          entity_id: institution.id,
          metadata: { created_by: 'platform_owner', admin_email: admin.email },
        },
      });
      return { institution, admin };
    });

    return NextResponse.json({
      institution: {
        id: created.institution.id,
        name: created.institution.name,
        code: created.institution.code,
        status: created.institution.status,
        adminEmail: created.admin.email,
        createdAt: created.institution.created_at.toISOString(),
      },
      temporaryPassword: password,
    }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ error: 'That institution code is already registered, or the administrator email is already in use. Choose a unique code and email.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Unable to create the institution account.' }, { status: 503 });
  }
}