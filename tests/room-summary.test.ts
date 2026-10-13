import { describe, expect, it } from 'vitest';

import { summarizeRooms } from '@/lib/room-summary';

describe('room summary', () => {
  it('counts rooms and total, occupied, and available beds', () => {
    expect(summarizeRooms([
      { totalBeds: 4, occupiedBeds: 0 },
      { totalBeds: 4, occupiedBeds: 2 },
      { totalBeds: 2, occupiedBeds: 2 },
    ])).toEqual({ totalRooms: 3, totalBeds: 10, occupiedBeds: 4, availableBeds: 6 });
  });
});