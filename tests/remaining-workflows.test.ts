import { describe, expect, it } from 'vitest';

import type { DeviceStudent, GateEvent } from '@/lib/device-leave';
import { isAlternateFeeReminderDay, isFeeReminderDue } from '@/lib/fee-reminders';
import { getPresenceAlertLevels } from '@/lib/student-presence';
import {
  evaluateAbsenceAlerts,
  getFeeBalance,
  queueAlertNotifications,
  recordManualFeePayment,
  type AbsenceAlert,
  type FeeLedgerState,
} from '@/lib/fee-alerts';

const ledger: FeeLedgerState = {
  dues: [
    {
      id: 'due-a',
      institution_id: 'institution-a',
      student_id: 'student-a',
      student_name: 'Aarav Sharma',
      month: 10,
      year: 2026,
      amount_due: 4200,
      due_date: '2026-10-10',
      status: 'PENDING',
    },
  ],
  payments: [],
  receipts: [],
};

const student: DeviceStudent = {
  id: 'student-a',
  institution_id: 'institution-a',
  name: 'Aarav Sharma',
  essl_id: 'ESSL-1001',
  status: 'ACTIVE',
  current_status: 'OUTSIDE',
};

const exitEvent: GateEvent = {
  id: 'gate-a',
  institution_id: 'institution-a',
  device_id: 'device-a',
  student_id: 'student-a',
  essl_id: 'ESSL-1001',
  punch_time: '2026-10-12T08:00:00.000Z',
  direction: 'OUT',
  is_authorized: true,
};

describe('remaining institutional workflows', () => {
  it('raises outside-presence alerts only after the strict two- and four-hour thresholds', () => {
    const statusSince = '2026-10-13T08:00:00.000Z';
    expect(getPresenceAlertLevels('OUTSIDE', statusSince, '2026-10-13T10:00:00.000Z')).toEqual([]);
    expect(getPresenceAlertLevels('OUTSIDE', statusSince, '2026-10-13T10:00:00.001Z')).toEqual(['WARDEN_2H']);
    expect(getPresenceAlertLevels('OUTSIDE', statusSince, '2026-10-13T12:00:00.000Z')).toEqual(['WARDEN_2H']);
    expect(getPresenceAlertLevels('OUTSIDE', statusSince, '2026-10-13T12:00:00.001Z')).toEqual(['WARDEN_2H', 'PARENT_4H']);
    expect(getPresenceAlertLevels('INSIDE', statusSince, '2026-10-13T14:00:00.000Z')).toEqual([]);
  });

  it('makes the monthly fee reminder due the day after the join-day deadline', () => {
    expect(isFeeReminderDue('2026-09-12', '2026-10-12')).toBe(false);
    expect(isFeeReminderDue('2026-09-12', '2026-10-13')).toBe(true);
    expect(isFeeReminderDue('2026-10-12', '2026-10-13')).toBe(false);
    expect(isFeeReminderDue('2026-01-31', '2026-02-28')).toBe(false);
    expect(isFeeReminderDue('2026-01-31', '2026-02-29')).toBe(false);
    expect(isAlternateFeeReminderDay('2026-09-12', '2026-10-13')).toBe(true);
    expect(isAlternateFeeReminderDay('2026-09-12', '2026-10-14')).toBe(false);
    expect(isAlternateFeeReminderDay('2026-09-12', '2026-10-15')).toBe(true);
  });

  it('records manual fee collection and issues a receipt without processing payment', () => {
    const partial = recordManualFeePayment(ledger, {
      institution_id: 'institution-a',
      due_id: 'due-a',
      amount: 1200,
      mode: 'UPI',
      reference_note: 'Counter collection reference',
      paid_on: '2026-10-12T10:00:00.000Z',
      recorded_by: 'accountant-a',
    });

    expect(partial.dues[0].status).toBe('PARTIAL');
    expect(getFeeBalance(partial.dues[0], partial.payments)).toBe(3000);
    expect(partial.receipts[0].amount).toBe(1200);
    expect(partial.receipts[0].receipt_number).toMatch(/^PP-202610-/);
  });

  it('marks a due paid only when manual entries cover the balance', () => {
    const partial = recordManualFeePayment(ledger, {
      institution_id: 'institution-a',
      due_id: 'due-a',
      amount: 1200,
      mode: 'CASH',
      paid_on: '2026-10-12T10:00:00.000Z',
      recorded_by: 'accountant-a',
    });
    const paid = recordManualFeePayment(partial, {
      institution_id: 'institution-a',
      due_id: 'due-a',
      amount: 3000,
      mode: 'BANK_TRANSFER',
      paid_on: '2026-10-12T11:00:00.000Z',
      recorded_by: 'accountant-a',
    });

    expect(paid.dues[0].status).toBe('PAID');
    expect(getFeeBalance(paid.dues[0], paid.payments)).toBe(0);
    expect(paid.receipts).toHaveLength(2);
  });

  it('rejects over-collection and cross-institution fee access', () => {
    expect(() =>
      recordManualFeePayment(ledger, {
        institution_id: 'institution-a',
        due_id: 'due-a',
        amount: 4200.01,
        mode: 'CASH',
        paid_on: '2026-10-12T10:00:00.000Z',
        recorded_by: 'accountant-a',
      }),
    ).toThrow(/exceeds/i);
    expect(() =>
      recordManualFeePayment(ledger, {
        institution_id: 'institution-b',
        due_id: 'due-a',
        amount: 100,
        mode: 'CASH',
        paid_on: '2026-10-12T10:00:00.000Z',
        recorded_by: 'accountant-b',
      }),
    ).toThrow(/not found/i);
  });

  it('creates a warden alert after two hours and a parent alert after four hours', () => {
    const twoHourAlerts = evaluateAbsenceAlerts(
      [student],
      [exitEvent],
      [],
      '2026-10-12T10:00:00.000Z',
    );
    expect(twoHourAlerts.map((alert) => alert.level)).toEqual(['WARDEN_2H']);

    const fourHourAlerts = evaluateAbsenceAlerts(
      [student],
      [exitEvent],
      twoHourAlerts,
      '2026-10-12T12:00:00.000Z',
    );
    expect(fourHourAlerts.map((alert) => alert.level)).toEqual(['PARENT_PRINCIPAL_4H']);
  });

  it('requires warden approval before parent permission suppresses absence alerts', () => {
    const permission = {
      id: 'leave-approved',
      institution_id: student.institution_id,
      student_id: student.id,
      student_name: student.name,
      start_date: '2026-10-12',
      end_date: '2026-10-12',
      reason: 'Parent permission',
      status: 'PENDING' as const,
      approved_by: null,
      processed_at: null,
    };
    const pendingAlerts = evaluateAbsenceAlerts(
      [student],
      [exitEvent],
      [],
      '2026-10-12T10:00:00.000Z',
      [permission],
    );
    expect(pendingAlerts.map((alert) => alert.level)).toEqual(['WARDEN_2H']);

    const approvedAlerts = evaluateAbsenceAlerts(
      [student],
      [exitEvent],
      [],
      '2026-10-12T10:00:00.000Z',
      [{ ...permission, status: 'APPROVED', approved_by: 'warden-1', processed_at: '2026-10-12T09:00:00.000Z' }],
    );

    expect(approvedAlerts).toHaveLength(0);
  });

  it('deduplicates threshold alerts and does not alert for an active inside resident', () => {
    const alerts = evaluateAbsenceAlerts(
      [{ ...student, current_status: 'INSIDE' }],
      [{ ...exitEvent, direction: 'IN', punch_time: '2026-10-12T11:00:00.000Z' }, exitEvent],
      [],
      '2026-10-12T13:00:00.000Z',
    );
    expect(alerts).toHaveLength(0);
  });

  it('queues notification records without sending them', () => {
    const alerts: AbsenceAlert[] = evaluateAbsenceAlerts(
      [student],
      [exitEvent],
      [],
      '2026-10-12T12:00:00.000Z',
    );
    const queue = queueAlertNotifications(alerts, '2026-10-12T12:00:00.000Z');

    expect(queue.map((item) => item.status)).toEqual(['QUEUED', 'QUEUED']);
    expect(queue.map((item) => item.template_key)).toEqual([
      'student_absence_warden_2h',
      'student_absence_parent_4h',
    ]);
  });
});