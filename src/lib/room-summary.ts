export type RoomSummary = {
  totalRooms: number;
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
};

export function summarizeRooms(
  rooms: Array<{ totalBeds: number; occupiedBeds: number }>,
): RoomSummary {
  const totalBeds = rooms.reduce((total, room) => total + room.totalBeds, 0);
  const occupiedBeds = rooms.reduce((total, room) => total + room.occupiedBeds, 0);
  return {
    totalRooms: rooms.length,
    totalBeds,
    occupiedBeds,
    availableBeds: Math.max(0, totalBeds - occupiedBeds),
  };
}