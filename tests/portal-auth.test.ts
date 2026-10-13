import { describe, expect, it } from 'vitest';

import { authenticateParent, parsePortalSession } from '@/lib/portal-auth';
import { mockStudents } from '@/lib/mock-data';

describe('portal credential validation', () => {
  it('keeps platform-owner sessions out of the institution portal', () => {
    const platformSession = {
      portal: 'platform' as const,
      role: 'SUPER_ADMIN' as const,
      institutionCode: 'PARENTPULSE',
      expiresAt: Date.now() + 60_000,
    };

    expect(parsePortalSession(JSON.stringify(platformSession))?.portal).toBe('platform');
    expect(parsePortalSession(JSON.stringify({ ...platformSession, portal: 'institution' }))).toBeNull();
  });

  it('requires parent name, student ID, and a registered parent mobile', () => {
    expect(authenticateParent('Aarav Sharma', 'ESSL-1001', '+91 99000 00001', mockStudents)).toMatchObject({
      portal: 'parent',
      studentId: 'student-1',
    });
    expect(authenticateParent('Aarav Sharma', 'ESSL-1001', '+91 90000 00000', mockStudents)).toBeNull();
    expect(authenticateParent('Aarav Sharma', 'ESSL-1002', '+91 99000 00001', mockStudents)).toBeNull();
  });

  it('accepts the registered alternate mobile for the same student', () => {
    expect(authenticateParent('Aarav Sharma', 'ESSL-1001', '+91 99000 01001', mockStudents)?.studentId).toBe('student-1');
  });
});