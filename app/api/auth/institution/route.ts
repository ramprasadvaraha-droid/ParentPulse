import { NextResponse } from 'next/server';
import { z } from 'zod';

import { verifyPassword } from '@/lib/auth';
import {
  createInstitutionSession,
  INSTITUTION_SESSION_COOKIE,
  INSTITUTION_SESSION_MAX_AGE,
  readInstitutionSession,
} from '@/lib/institution-session';

const credentialsSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(256),
});

export async function POST(request: Request) {
  const parsed = credentialsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Email or password is incorrect.' }, { status: 400 });
  }

  try {
    const { default: prisma } = await import('@/lib/prisma');
    const account = await prisma.user.findFirst({
      where: {
        email: parsed.data.email.toLowerCase(),
        status: 'ACTIVE',
        role: 'ADMIN',
        institution: { status: 'ACTIVE' },
      },
      select: {
        id: true,
        email: true,
        password_hash: true,
        role: true,
        institution_id: true,
        institution: { select: { code: true } },
      },
    });

    if (!account?.password_hash || !(await verifyPassword(parsed.data.password, account.password_hash))) {
      return NextResponse.json({ error: 'Email or password is incorrect.' }, { status: 401 });
    }
    const { token, session } = createInstitutionSession({
      userId: account.id,
      institutionId: account.institution_id,
      institutionCode: account.institution.code,
      userEmail: account.email,
      role: 'ADMIN',
    });
    const response = NextResponse.json({
      session: {
        portal: 'institution',
        role: session.role,
        institutionCode: session.institutionCode,
        userEmail: session.userEmail,
        expiresAt: session.expiresAt * 1000,
      },
    });
    response.cookies.set(INSTITUTION_SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: INSTITUTION_SESSION_MAX_AGE,
    });
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch {
    return NextResponse.json({ error: 'Institution sign-in is temporarily unavailable.' }, { status: 503 });
  }
}

export async function GET(request: Request) {
  const session = readInstitutionSession(request.headers.get('cookie'));
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ session: null }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }

  try {
    const { default: prisma } = await import('@/lib/prisma');
    const account = await prisma.user.findFirst({
      where: {
        id: session.userId,
        institution_id: session.institutionId,
        status: 'ACTIVE',
        role: 'ADMIN',
        institution: { status: 'ACTIVE' },
      },
      select: { id: true },
    });
    if (!account) {
      return NextResponse.json({ session: null }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
    }
    return NextResponse.json({
      session: {
        portal: 'institution',
        role: session.role,
        institutionCode: session.institutionCode,
        userEmail: session.userEmail,
        expiresAt: session.expiresAt * 1000,
      },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ session: null }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(INSTITUTION_SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}