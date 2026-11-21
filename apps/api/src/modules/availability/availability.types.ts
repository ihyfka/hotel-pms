import { RoomTypeAvailability } from "@hotel-pms/types";

export type { RoomTypeAvailability };

export interface AvailabilityDbRow {
  room_type_id: string;
  code: string;
  name: string;
  base_price: string | number;
  capacity: number;
  amenities: string[] | string;
  available_count: number;
}
