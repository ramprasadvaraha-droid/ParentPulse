import { describe, expect, it } from 'vitest';

import { mockRooms } from '@/lib/mock-data';
import {
  calculateProrationFlag,
  createStudentRegistration,
  getRoomAvailability,
  isDuplicateEsslId,
  type Room,
  type Student,
} from '@/lib/student-registry';

const students: Student[] = [
  {
    id: 's-1',
    name: 'Aarav',
    essl_id: 'ESSL-5001',
    parent_name: 'Parent A',
    room_id: 'room-101',
    joined_date: '2025-02-01',
    monthly_fee: 4200,
    status: 'ACTIVE',
    proration: false,
  },
  {
    id: 's-2',
    name: 'Rohan',
    essl_id: 'ESSL-5002',
    parent_name: 'Parent B',
    room_id: 'room-101',
    joined_date: '2025-02-15',
    monthly_fee: 4300,
    status: 'ACTIVE',
    proration: true,
  },
];

const room: Room = { id: 'room-101', name: 'A-101', block: 'Block A', total_beds: 4 };

describe('phase 2 registration flow', () => {
  it('allows 20 student registrations when rooms are available', () => {
    const pool: Student[] = [];
    const registrationRoom: Room = { id: 'room-201', name: 'Test Hall', block: 'Block C', total_beds: 20 };

    for (let index = 1; index <= 20; index += 1) {
      const result = createStudentRegistration(pool, registrationRoom, {
        name: `Student ${index}`,
        essl_id: `ESSL-${1000 + index}`,
        parent_name: `Parent ${index}`,
        room_id: registrationRoom.id,
        joined_date: '2025-03-01',
        monthly_fee: 4500,
      });

      pool.push(result.student);
    }

    expect(pool).toHaveLength(20);
    expect(pool.every((student) => student.room_id === registrationRoom.id)).toBe(true);
  });

  it('rejects duplicate essl ids within the institution', () => {
    expect(isDuplicateEsslId('ESSL-5001', students)).toBe(true);

    expect(() =>
      createStudentRegistration(students, room, {
        name: 'Duplicate Attempt',
        essl_id: 'ESSL-5001',
        parent_name: 'Parent C',
        room_id: room.id,
        joined_date: '2025-03-05',
        monthly_fee: 4400,
      }),
    ).toThrow(/duplicate eSSL ID/i);
  });

  it('blocks room selection when no beds are left', () => {
    const fullRoom: Room = { id: 'room-full', name: 'Full Room', block: 'Block D', total_beds: 2 };
    const fullStudents: Student[] = [
      { id: 'a', name: 'A', essl_id: 'ESSL-9001', parent_name: 'P1', room_id: 'room-full', joined_date: '2025-03-01', monthly_fee: 2000, status: 'ACTIVE', proration: false },
      { id: 'b', name: 'B', essl_id: 'ESSL-9002', parent_name: 'P2', room_id: 'room-full', joined_date: '2025-03-01', monthly_fee: 2000, status: 'ACTIVE', proration: false },
    ];

    expect(getRoomAvailability(fullRoom, fullStudents)).toBe(0);
    expect(() =>
      createStudentRegistration(fullStudents, fullRoom, {
        name: 'Blocked',
        essl_id: 'ESSL-9003',
        parent_name: 'P3',
        room_id: fullRoom.id,
        joined_date: '2025-03-02',
        monthly_fee: 2500,
      }),
    ).toThrow(/no available beds/i);
  });

  it('marks mid-month joiners for proration', () => {
    expect(calculateProrationFlag('2025-02-15')).toBe(true);
    expect(calculateProrationFlag('2025-02-01')).toBe(false);
  });

  it('stores primary and alternate parent mobile numbers on registration', () => {
    const { student } = createStudentRegistration([], room, {
      name: 'Parent Login Student',
      essl_id: 'ESSL-9100',
      parent_name: 'Parent D',
      parent_mobile: '+91 98765 43210',
      alternate_mobile: '+91 98765 43211',
      room_id: room.id,
      joined_date: '2025-03-01',
      monthly_fee: 4200,
    });

    expect(student.parent_mobile).toBe('+91 98765 43210');
    expect(student.alternate_mobile).toBe('+91 98765 43211');
  });

  it('uses realistic room data and keeps full rooms disabled in the matrix', () => {
    const fullRoom = mockRooms[0];
    const occupancy: Student[] = [{ id: 's-1', name: 'A', essl_id: 'ESSL-7001', parent_name: 'P1', room_id: fullRoom.id, joined_date: '2025-03-01', monthly_fee: 2000, status: 'ACTIVE', proration: false }, { id: 's-2', name: 'B', essl_id: 'ESSL-7002', parent_name: 'P2', room_id: fullRoom.id, joined_date: '2025-03-01', monthly_fee: 2000, status: 'ACTIVE', proration: false }, { id: 's-3', name: 'C', essl_id: 'ESSL-7003', parent_name: 'P3', room_id: fullRoom.id, joined_date: '2025-03-01', monthly_fee: 2000, status: 'ACTIVE', proration: false }, { id: 's-4', name: 'D', essl_id: 'ESSL-7004', parent_name: 'P4', room_id: fullRoom.id, joined_date: '2025-03-01', monthly_fee: 2000, status: 'ACTIVE', proration: false }];

    expect(getRoomAvailability(fullRoom, occupancy)).toBe(0);
  });
});
