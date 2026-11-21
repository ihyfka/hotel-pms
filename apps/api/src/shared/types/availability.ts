export interface RoomTypeAvailability {
  room_type_id: string;
  code: string;
  name: string;
  base_price: number;
  capacity: number;
  amenities: string[];
  available_count: number;
  total_nights: number;
  total_price: number;
}
