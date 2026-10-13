import type { DeviceStudent, GateEvent, LeaveRequest } from '@/lib/device-leave';

export type FeeStatus = 'PENDING' | 'PARTIAL' | 'PAID' | 'WAIVED';
export type PaymentMode = 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE' | 'OTHER';
export type AlertLevel = 'WARDEN_2H' | 'PARENT_PRINCIPAL_4H';

export type FeeDue = {
  id: string;
  institution_id: string;
  student_id: string;
  student_name: string;
  month: number;
  year: number;
  amount_due: number;
  due_date: string;
  status: FeeStatus;
};

export type RecordedPayment = {
  id: string;
  institution_id: string;
  due_id: string;
  amount: number;
  mode: PaymentMode;
  reference_note: string | null;
  paid_on: string;
  recorded_by: string;
  is_reversal: boolean;
  reversal_of: string | null;
};

export type FeeReceipt = {
  id: string;
  institution_id: string;
  due_id: string;
  receipt_number: string;
  amount: number;
  issued_at: string;
};

export type FeeLedgerState = {
  dues: FeeDue[];
  payments: RecordedPayment[];
  receipts: FeeReceipt[];
};

export type AbsenceAlert = {
  id: string;
  institution_id: string;
  student_id: string;
  level: AlertLevel;
  absence_key: string;
  sent_at: string;
  acknowledged_by: string | null;
  resolved_at: string | null;
};

export type NotificationQueueItem = {
  id: string;
  institution_id: string;
  channel: 'WHATSAPP';
  template_key: string;
  target_id: string;
  status: 'QUEUED';
  created_at: string;
};

const makeId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function getFeeBalance(due: FeeDue, payments: RecordedPayment[]) {
  const netPaid = payments
    .filter((payment) => payment.institution_id === due.institution_id && payment.due_id === due.id)
    .reduce((total, payment) => total + (payment.is_reversal ? -payment.amount : payment.amount), 0);

  return Math.max(0, Number((due.amount_due - netPaid).toFixed(2)));
}

export function recordManualFeePayment(
  state: FeeLedgerState,
  input: {
    institution_id: string;
    due_id: string;
    amount: number;
    mode: PaymentMode;
    reference_note?: string;
    paid_on: string;
    recorded_by: string;
  },
): FeeLedgerState {
  const due = state.dues.find(
    (candidate) =>
      candidate.id === input.due_id && candidate.institution_id === input.institution_id,
  );
  if (!due) {
    throw new Error('Fee due not found for this institution');
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error('Recorded amount must be greater than zero');
  }
  if (!input.recorded_by.trim()) {
    throw new Error('A staff recorder is required');
  }
  if (Number.isNaN(Date.parse(input.paid_on))) {
    throw new Error('A valid collection date is required');
  }

  const balance = getFeeBalance(due, state.payments);
  if (balance <= 0 || input.amount - balance > 0.001) {
    throw new Error('Recorded amount exceeds the remaining fee balance');
  }

  const payment: RecordedPayment = {
    id: makeId('payment'),
    institution_id: input.institution_id,
    due_id: input.due_id,
    amount: Number(input.amount.toFixed(2)),
    mode: input.mode,
    reference_note: input.reference_note?.trim() || null,
    paid_on: new Date(input.paid_on).toISOString(),
    recorded_by: input.recorded_by,
    is_reversal: false,
    reversal_of: null,
  };
  const nextPayments = [...state.payments, payment];
  const nextBalance = getFeeBalance(due, nextPayments);
  const nextStatus: FeeStatus = nextBalance === 0 ? 'PAID' : 'PARTIAL';
  const nextDues = state.dues.map((candidate) =>
    candidate.id === due.id
      ? { ...candidate, status: nextStatus }
      : candidate,
  );
  const paidDate = new Date(input.paid_on);
  const receipt: FeeReceipt = {
    id: makeId('receipt'),
    institution_id: input.institution_id,
    due_id: input.due_id,
    receipt_number: `PP-${paidDate.getUTCFullYear()}${String(paidDate.getUTCMonth() + 1).padStart(2, '0')}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    amount: payment.amount,
    issued_at: payment.paid_on,
  };

  return {
    dues: nextDues,
    payments: nextPayments,
    receipts: [...state.receipts, receipt],
  };
}

export function evaluateAbsenceAlerts(
  students: DeviceStudent[],
  gateLogs: GateEvent[],
  existingAlerts: AbsenceAlert[],
  now: string,
  leaveRequests: LeaveRequest[] = [],
): AbsenceAlert[] {
  const nowTime = Date.parse(now);
  if (Number.isNaN(nowTime)) {
    throw new Error('Alert evaluation time is invalid');
  }

  const newAlerts: AbsenceAlert[] = [];
  for (const student of students) {
    if (student.status !== 'ACTIVE') continue;

    const latestEvent = gateLogs
      .filter((event) => event.institution_id === student.institution_id && event.student_id === student.id)
      .sort((left, right) => Date.parse(right.punch_time) - Date.parse(left.punch_time))[0];
    if (!latestEvent || latestEvent.direction !== 'OUT') continue;

    const elapsed = nowTime - Date.parse(latestEvent.punch_time);
    if (elapsed < 0) continue;

    const exitDate = latestEvent.punch_time.slice(0, 10);
    const currentDate = new Date(nowTime).toISOString().slice(0, 10);
    const hasApprovedPermission = leaveRequests.some(
      (request) =>
        request.institution_id === student.institution_id &&
        request.student_id === student.id &&
        request.status === 'APPROVED' &&
        request.start_date <= exitDate &&
        request.end_date >= exitDate &&
        request.start_date <= currentDate &&
        request.end_date >= currentDate,
    );
    if (hasApprovedPermission) continue;

    const absenceKey = `${student.id}:${new Date(latestEvent.punch_time).toISOString()}`;
    const thresholds: Array<{ level: AlertLevel; hours: number }> = [
      { level: 'WARDEN_2H', hours: 2 },
      { level: 'PARENT_PRINCIPAL_4H', hours: 4 },
    ];

    for (const threshold of thresholds) {
      const alreadyCreated = existingAlerts.some(
        (alert) =>
          alert.institution_id === student.institution_id &&
          alert.student_id === student.id &&
          alert.absence_key === absenceKey &&
          alert.level === threshold.level,
      );
      if (!alreadyCreated && elapsed >= threshold.hours * 60 * 60 * 1000) {
        newAlerts.push({
          id: makeId('alert'),
          institution_id: student.institution_id,
          student_id: student.id,
          level: threshold.level,
          absence_key: absenceKey,
          sent_at: new Date(nowTime).toISOString(),
          acknowledged_by: null,
          resolved_at: null,
        });
      }
    }
  }

  return newAlerts;
}

export function queueAlertNotifications(alerts: AbsenceAlert[], createdAt: string): NotificationQueueItem[] {
  if (Number.isNaN(Date.parse(createdAt))) {
    throw new Error('Notification queue time is invalid');
  }

  return alerts.map((alert) => ({
    id: makeId('notification'),
    institution_id: alert.institution_id,
    channel: 'WHATSAPP',
    template_key:
      alert.level === 'WARDEN_2H' ? 'student_absence_warden_2h' : 'student_absence_parent_4h',
    target_id: alert.student_id,
    status: 'QUEUED',
    created_at: new Date(createdAt).toISOString(),
  }));
}