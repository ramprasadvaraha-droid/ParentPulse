import { readStudentDirectory } from '@/lib/student-directory';
import type { Student } from '@/lib/student-registry';

export const PORTAL_SESSION_KEY = 'parentpulse:portal-session';
export const PORTAL_SESSION_EVENT = 'parentpulse:portal-session-changed';

export type PortalSession = {
  portal: 'institution' | 'platform' | 'parent';
  role?: 'ADMIN' | 'SUPER_ADMIN';
  institutionCode?: string;
  studentId?: string;
  userEmail?: string;
  expiresAt: number;
};

function createSession(session: Omit<PortalSession, 'expiresAt'>): PortalSession {
  return { ...session, expiresAt: Date.now() + 8 * 60 * 60 * 1000 };
}

function normalizeMobile(value: string) {
  const digits = value.replace(/\D/g, '');
  return digits.startsWith('91') && digits.length === 12 ? digits.slice(2) : digits;
}

export function authenticateParent(
  nameInput: string,
  studentIdInput: string,
  mobileInput: string,
  students: Student[] = readStudentDirectory(),
): PortalSession | null {
  const name = nameInput.trim().toLocaleLowerCase('en-IN');
  const studentId = studentIdInput.trim().toUpperCase();
  const mobile = normalizeMobile(mobileInput);

  const student = students.find((candidate) => {
    const knownMobiles = [candidate.parent_mobile, candidate.alternate_mobile]
      .filter((value): value is string => Boolean(value))
      .map(normalizeMobile);

    return (
      candidate.name.trim().toLocaleLowerCase('en-IN') === name &&
      candidate.essl_id.trim().toUpperCase() === studentId &&
      knownMobiles.includes(mobile)
    );
  });

  return student ? createSession({ portal: 'parent', studentId: student.id }) : null;
}

export function savePortalSession(session: PortalSession) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(PORTAL_SESSION_KEY, JSON.stringify(session));
  window.dispatchEvent(new Event(PORTAL_SESSION_EVENT));
}

export function readPortalSession(): PortalSession | null {
  if (typeof window === 'undefined') return null;
  const stored = window.sessionStorage.getItem(PORTAL_SESSION_KEY);
  if (!stored) return null;

  const session = parsePortalSession(stored);
  if (session) return session;

  window.sessionStorage.removeItem(PORTAL_SESSION_KEY);
  return null;
}

export function parsePortalSession(raw: string | null): PortalSession | null {
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as PortalSession;
    if (
      (session.portal === 'institution' || session.portal === 'platform' || session.portal === 'parent') &&
      session.expiresAt > Date.now() &&
      (session.portal !== 'institution' ||
        (session.role === 'ADMIN' && Boolean(session.institutionCode))) &&
      (session.portal !== 'platform' || session.role === 'SUPER_ADMIN') &&
      (session.portal !== 'parent' || Boolean(session.studentId))
    ) {
      return session;
    }
  } catch {
    return null;
  }
  return null;
}

export function clearPortalSession() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(PORTAL_SESSION_KEY);
  window.dispatchEvent(new Event(PORTAL_SESSION_EVENT));
  void fetch('/api/auth/institution', { method: 'DELETE' });
}

export function getPortalSessionSnapshot() {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage.getItem(PORTAL_SESSION_KEY);
}

export function subscribeToPortalSession(onChange: () => void) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(PORTAL_SESSION_EVENT, onChange);
  return () => window.removeEventListener(PORTAL_SESSION_EVENT, onChange);
}