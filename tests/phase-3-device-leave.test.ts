import { hash } from 'bcryptjs';
import { beforeAll, describe, expect, it } from 'vitest';

import {
  createLeaveRequest,
  ingestEsslPunch,
  reviewLeaveRequest,
  type DeviceState,
  type LeaveRequest,
} from '@/lib/device-leave';

const deviceSecret = 'device-secret-for-tests';
let state: DeviceState;

beforeAll(async () => {
  state = {
    devices: [
      {
        id: 'device-a',
        institution_id: 'institution-a',
        serial: 'ESSL-DEVICE-01',
        secret_hash: await hash(deviceSecret, 4),
        last_heartbeat_at: null,
      },
    ],
    students: [
      {
        id: 'student-a',
        institution_id: 'institution-a',
        name: 'Aarav Sharma',
        essl_id: 'ESSL-1001',
        status: 'ACTIVE',
        current_status: 'INSIDE',
      },
      {
        id: 'student-inactive',
        institution_id: 'institution-a',
        name: 'Former Resident',
        essl_id: 'ESSL-1002',
        status: 'VACATED',
        current_status: 'OUTSIDE',
      },
    ],
    gateLogs: [],
  };
});

const punch = {
  institutionId: 'institution-a',
  serial: 'ESSL-DEVICE-01',
  secret: deviceSecret,
  esslId: 'ESSL-1001',
  direction: 'OUT' as const,
  punchTime: '2026-10-12T10:00:00.000Z',
};

describe('phase 3 device and leave workflows', () => {
  it('authenticates eSSL events, records the punch, and updates resident status', async () => {
    const result = await ingestEsslPunch(state, punch, '2026-10-12T10:00:02.000Z');

    expect(result.result).toBe('accepted');
    expect(result.gateLogs).toHaveLength(1);
    expect(result.gateLogs[0].is_authorized).toBe(true);
    expect(result.students[0].current_status).toBe('OUTSIDE');
    expect(result.devices[0].last_heartbeat_at).toBe('2026-10-12T10:00:02.000Z');
  });

  it('rejects invalid device credentials and cross-institution device access', async () => {
    await expect(ingestEsslPunch(state, { ...punch, secret: 'wrong' })).rejects.toThrow(
      /device authentication failed/i,
    );
    await expect(
      ingestEsslPunch(state, { ...punch, institutionId: 'institution-b' }),
    ).rejects.toThrow(/device authentication failed/i);
  });

  it('does not apply the same device punch twice', async () => {
    const first = await ingestEsslPunch(state, punch);
    const repeated = await ingestEsslPunch(first, punch);

    expect(repeated.result).toBe('duplicate');
    expect(repeated.gateLogs).toHaveLength(1);
  });

  it('records scans from inactive residents as unauthorized without changing status', async () => {
    const result = await ingestEsslPunch(state, {
      ...punch,
      esslId: 'ESSL-1002',
    });

    expect(result.result).toBe('unauthorized');
    expect(result.gateLogs[0].is_authorized).toBe(false);
    expect(result.students[1].current_status).toBe('OUTSIDE');
  });

  it('creates valid pending leave and rejects overlapping active requests', () => {
    const request = createLeaveRequest([], {
      institution_id: 'institution-a',
      student_id: 'student-a',
      student_name: 'Aarav Sharma',
      start_date: '2026-10-20',
      end_date: '2026-10-22',
      reason: 'Family visit',
    });

    expect(request.status).toBe('PENDING');
    expect(() =>
      createLeaveRequest([request], {
        institution_id: 'institution-a',
        student_id: 'student-a',
        student_name: 'Aarav Sharma',
        start_date: '2026-10-22',
        end_date: '2026-10-23',
        reason: 'Another visit',
      }),
    ).toThrow(/overlapping/i);
  });

  it('records leave approval or rejection once with reviewer and timestamp', () => {
    const request: LeaveRequest = {
      id: 'leave-1',
      institution_id: 'institution-a',
      student_id: 'student-a',
      student_name: 'Aarav Sharma',
      start_date: '2026-10-20',
      end_date: '2026-10-22',
      reason: 'Family visit',
      status: 'PENDING',
      approved_by: null,
      processed_at: null,
    };
    const reviewed = reviewLeaveRequest(
      [request],
      request.id,
      'APPROVED',
      'warden-1',
      '2026-10-12T10:30:00.000Z',
    );

    expect(reviewed[0]).toMatchObject({
      status: 'APPROVED',
      approved_by: 'warden-1',
      processed_at: '2026-10-12T10:30:00.000Z',
    });
    expect(() => reviewLeaveRequest(reviewed, request.id, 'REJECTED', 'warden-2')).toThrow(
      /only pending/i,
    );
  });
});