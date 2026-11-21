import { RoomAllocation } from "@hotel-pms/types";

export type { RoomAllocation };

export interface RoomAllocationDbRow {
  id: string;
  reservation_id: string;
  room_id: string;
  assigned_at: Date;
  assigned_by: string;
  released_at: Date | null;
  released_by: string | null;
  notes: string | null;
  // Joined room fields
  room_number?: string;
  room_floor?: number;
  room_building?: string;
  // Joined reservation fields
  reservation_number?: string;
  check_in_date?: string;
  check_out_date?: string;
}
