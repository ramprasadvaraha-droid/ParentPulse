import { afterEach, describe, expect, it } from 'vitest';

import {
  createInstitutionSession,
  verifyInstitutionSession,
} from '@/lib/institution-session';

const originalSecret = process.env.SESSION_SECRET;

afterEach(() => {
  if (originalSecret === undefined) delete process.env.SESSION_SECRET;
  else process.env.SESSION_SECRET = originalSecret;
});

describe('institution sessions', () => {
  it('verifies a signed session and rejects a modified token', () => {
    process.env.SESSION_SECRET = 'test-session-secret-with-at-least-32-characters';
    const { token, session } = createInstitutionSession({
      userId: 'user-1',
      institutionId: 'institution-1',
      institutionCode: 'NORTH-HOUSE',
      userEmail: 'admin@example.test',
      role: 'ADMIN',
    });

    expect(verifyInstitutionSession(token)).toEqual(session);
    expect(verifyInstitutionSession(`${token}tampered`)).toBeNull();
  });

  it('rejects tokens signed with a different secret', () => {
    process.env.SESSION_SECRET = 'test-session-secret-with-at-least-32-characters';
    const { token } = createInstitutionSession({
      userId: 'user-1',
      institutionId: 'institution-1',
      institutionCode: 'NORTH-HOUSE',
      userEmail: 'admin@example.test',
      role: 'ADMIN',
    });

    process.env.SESSION_SECRET = 'another-session-secret-with-at-least-32-characters';
    expect(verifyInstitutionSession(token)).toBeNull();
  });

  it('supports platform owner sessions without giving them an institution admin role', () => {
    process.env.SESSION_SECRET = 'test-session-secret-with-at-least-32-characters';
    const { token } = createInstitutionSession({
      userId: 'owner-1',
      institutionId: 'platform-1',
      institutionCode: 'PARENTPULSE',
      userEmail: 'owner@example.test',
      role: 'SUPER_ADMIN',
    });

    expect(verifyInstitutionSession(token)?.role).toBe('SUPER_ADMIN');
  });
});