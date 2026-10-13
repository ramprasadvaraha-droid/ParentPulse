export type StudentStatus = 'ACTIVE' | 'ON_LEAVE' | 'VACATED';

export type Room = {
  id: string;
  name: string;
  block: string;
  total_beds: number;
};

export type Student = {
  id: string;
  name: string;
  essl_id: string;
  parent_name: string;
  parent_mobile?: string;
  alternate_mobile?: string;
  room_id: string | null;
  joined_date: string;
  monthly_fee: number;
  status: StudentStatus;
  proration: boolean;
  current_status?: 'INSIDE' | 'OUTSIDE';
};

export type StudentRegistrationInput = {
  name: string;
  essl_id: string;
  parent_name: string;
  parent_mobile?: string;
  alternate_mobile?: string;
  room_id: string;
  joined_date: string;
  monthly_fee: number;
};

export function calculateProrationFlag(joinedDate: string) {
  const value = new Date(joinedDate);
  if (Number.isNaN(value.getTime())) {
    return false;
  }

  const monthStart = new Date(value.getFullYear(), value.getMonth(), 1);
  return value.getTime() > monthStart.getTime() && value.getDate() > 1;
}

export function getActiveOccupancy(roomId: string, students: Student[]) {
  return students.filter(
    (student) => student.room_id === roomId && student.status === 'ACTIVE',
  ).length;
}

export function getRoomAvailability(room: Room, students: Student[]) {
  return Math.max(0, room.total_beds - getActiveOccupancy(room.id, students));
}

export function isDuplicateEsslId(esslId: string, students: Student[]) {
  return students.some(
    (student) => student.essl_id.trim().toLowerCase() === esslId.trim().toLowerCase(),
  );
}

export function createStudentRegistration(
  students: Student[],
  room: Room,
  input: StudentRegistrationInput,
): { student: Student; proration: boolean } {
  const trimmedEsslId = input.essl_id.trim();

  if (!trimmedEsslId) {
    throw new Error('eSSL ID is required');
  }

  if (isDuplicateEsslId(trimmedEsslId, students)) {
    throw new Error('Duplicate eSSL ID within this institution');
  }

  if (getRoomAvailability(room, students) <= 0) {
    throw new Error('Selected room has no available beds');
  }

  const proration = calculateProrationFlag(input.joined_date);

  const student: Student = {
    id: `student-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: input.name.trim(),
    essl_id: trimmedEsslId,
    parent_name: input.parent_name.trim(),
    parent_mobile: input.parent_mobile?.trim() ?? '',
    alternate_mobile: input.alternate_mobile?.trim() ?? '',
    room_id: room.id,
    joined_date: input.joined_date,
    monthly_fee: Number(input.monthly_fee),
    status: 'ACTIVE',
    proration,
    current_status: 'INSIDE',
  };

  return { student, proration };
}
