export interface RoomAllocation {
  id: string;
  reservationId: string;
  roomId: string;
  assignedAt: Date;
  assignedBy: string;
  releasedAt: Date | null;
  releasedBy: string | null;
  notes?: string;
}
