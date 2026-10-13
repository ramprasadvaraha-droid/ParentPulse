import { compare } from 'bcryptjs';

export type GateDirection = 'IN' | 'OUT';
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type ResidentStatus = 'ACTIVE' | 'ON_LEAVE' | 'VACATED';
export type CurrentStatus = 'INSIDE' | 'OUTSIDE';

export type RegisteredDevice = {
  id: string;
  institution_id: string;
  serial: string;
  secret_hash: string;
  last_heartbeat_at: string | null;
};

export type DeviceStudent = {
  id: string;
  institution_id: string;
  name: string;
  essl_id: string;
  status: ResidentStatus;
  current_status: CurrentStatus;
};

export type GateEvent = {
  id: string;
  institution_id: string;
  device_id: string;
  student_id: string;
  essl_id: string;
  punch_time: string;
  direction: GateDirection;
  is_authorized: boolean;
  raw_payload?: Record<string, unknown>;
};

export type DevicePunchInput = {
  institutionId: string;
  serial: string;
  secret: string;
  esslId: string;
  direction: GateDirection;
  punchTime: string;
  rawPayload?: Record<string, unknown>;
};

export type DeviceState = {
  devices: RegisteredDevice[];
  students: DeviceStudent[];
  gateLogs: GateEvent[];
};

export type LeaveRequest = {
  id: string;
  institution_id: string;
  student_id: string;
  student_name: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: LeaveStatus;
  approved_by: string | null;
  processed_at: string | null;
};

export type NewLeaveRequest = Pick<
  LeaveRequest,
  'institution_id' | 'student_id' | 'student_name' | 'start_date' | 'end_date' | 'reason'
>;

function parseDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value
    ? null
    : date.getTime();
}

export async function ingestEsslPunch(
  state: DeviceState,
  input: DevicePunchInput,
  receivedAt = new Date().toISOString(),
) {
  const device = state.devices.find(
    (candidate) =>
      candidate.institution_id === input.institutionId && candidate.serial === input.serial,
  );

  if (!device || !(await compare(input.secret, device.secret_hash))) {
    throw new Error('Device authentication failed');
  }

  const punchTime = new Date(input.punchTime);
  if (Number.isNaN(punchTime.getTime())) {
    throw new Error('Invalid punch timestamp');
  }

  const normalizedPunchTime = punchTime.toISOString();
  const duplicate = state.gateLogs.some(
    (log) =>
      log.device_id === device.id &&
      log.essl_id === input.esslId.trim() &&
      Date.parse(log.punch_time) === punchTime.getTime(),
  );

  if (duplicate) {
    return { ...state, result: 'duplicate' as const };
  }

  const student = state.students.find(
    (candidate) =>
      candidate.institution_id === input.institutionId &&
      candidate.essl_id.toLowerCase() === input.esslId.trim().toLowerCase(),
  );

  if (!student) {
    throw new Error('No student is registered with this eSSL ID');
  }

  const isAuthorized = student.status === 'ACTIVE';
  const currentStatus: CurrentStatus = input.direction === 'IN' ? 'INSIDE' : 'OUTSIDE';
  const gateLog: GateEvent = {
    id: `${device.id}:${input.esslId.trim()}:${normalizedPunchTime}`,
    institution_id: input.institutionId,
    device_id: device.id,
    student_id: student.id,
    essl_id: student.essl_id,
    punch_time: normalizedPunchTime,
    direction: input.direction,
    is_authorized: isAuthorized,
    raw_payload: input.rawPayload,
  };

  return {
    devices: state.devices.map((candidate) =>
      candidate.id === device.id ? { ...candidate, last_heartbeat_at: receivedAt } : candidate,
    ),
    students: state.students.map((candidate) =>
      candidate.id === student.id && isAuthorized
        ? {
            ...candidate,
            current_status: currentStatus,
          }
        : candidate,
    ),
    gateLogs: [...state.gateLogs, gateLog],
    result: isAuthorized ? ('accepted' as const) : ('unauthorized' as const),
  };
}

export function createLeaveRequest(
  requests: LeaveRequest[],
  input: NewLeaveRequest,
): LeaveRequest {
  const start = parseDateOnly(input.start_date);
  const end = parseDateOnly(input.end_date);
  const reason = input.reason.trim();

  if (start === null || end === null || end < start) {
    throw new Error('Leave dates must be valid and end on or after the start date');
  }
  if (!reason) {
    throw new Error('A leave reason is required');
  }

  const overlaps = requests.some((request) => {
    if (
      request.institution_id !== input.institution_id ||
      request.student_id !== input.student_id ||
      request.status === 'REJECTED'
    ) {
      return false;
    }

    const existingStart = parseDateOnly(request.start_date);
    const existingEnd = parseDateOnly(request.end_date);
    return existingStart !== null && existingEnd !== null && start <= existingEnd && end >= existingStart;
  });

  if (overlaps) {
    throw new Error('An overlapping pending or approved leave already exists');
  }

  return {
    id: `leave-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ...input,
    reason,
    status: 'PENDING',
    approved_by: null,
    processed_at: null,
  };
}

export function reviewLeaveRequest(
  requests: LeaveRequest[],
  requestId: string,
  decision: Exclude<LeaveStatus, 'PENDING'>,
  reviewerId: string,
  processedAt = new Date().toISOString(),
) {
  if (!reviewerId.trim()) {
    throw new Error('A reviewer is required');
  }

  const target = requests.find((request) => request.id === requestId);
  if (!target) {
    throw new Error('Leave request not found');
  }
  if (target.status !== 'PENDING') {
    throw new Error('Only pending leave requests can be reviewed');
  }

  return requests.map((request) =>
    request.id === requestId
      ? {
          ...request,
          status: decision,
          approved_by: reviewerId,
          processed_at: processedAt,
        }
      : request,
  );
}