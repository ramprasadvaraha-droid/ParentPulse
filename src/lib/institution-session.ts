import { createHmac, timingSafeEqual } from 'node:crypto';

export const INSTITUTION_SESSION_COOKIE = 'parentpulse-institution-session';
export const INSTITUTION_SESSION_MAX_AGE = 8 * 60 * 60;

export type InstitutionSession = {
  userId: string;
  institutionId: string;
  institutionCode: string;
  userEmail: string;
  role: 'ADMIN' | 'SUPER_ADMIN';
  expiresAt: number;
};

function sessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET must contain at least 32 characters');
  }
  return secret;
}

function sign(payload: string) {
  return createHmac('sha256', sessionSecret()).update(payload).digest('base64url');
}

export function createInstitutionSession(
  session: Omit<InstitutionSession, 'expiresAt'>,
) {
  const value: InstitutionSession = {
    ...session,
    expiresAt: Math.floor(Date.now() / 1000) + INSTITUTION_SESSION_MAX_AGE,
  };
  const payload = Buffer.from(JSON.stringify(value)).toString('base64url');
  return { token: `${payload}.${sign(payload)}`, session: value };
}

export function verifyInstitutionSession(token: string | undefined): InstitutionSession | null {
  if (!token) return null;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) return null;

  try {
    const expected = Buffer.from(sign(payload));
    const actual = Buffer.from(signature);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

    const value = JSON.parse(Buffer.from(payload, 'base64url').toString()) as InstitutionSession;
    if (
      (value.role !== 'ADMIN' && value.role !== 'SUPER_ADMIN') ||
      !value.userId ||
      !value.institutionId ||
      !value.institutionCode ||
      !value.userEmail ||
      !Number.isSafeInteger(value.expiresAt) ||
      value.expiresAt <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

export function readInstitutionSession(cookieHeader: string | null) {
  const token = cookieHeader
    ?.split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${INSTITUTION_SESSION_COOKIE}=`))
    ?.slice(INSTITUTION_SESSION_COOKIE.length + 1);
  return verifyInstitutionSession(token);
}