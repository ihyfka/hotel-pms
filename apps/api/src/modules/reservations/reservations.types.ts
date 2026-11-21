import { Reservation, ReservationStatus, Guest } from "@hotel-pms/types";

export type { Reservation, ReservationStatus, Guest };

export interface ReservationDbRow {
  id: string;
  reservation_number: string;
  guest_id: string;
  room_type_id: string;
  check_in_date: string;
  check_out_date: string;
  status: ReservationStatus;
  adult_count: number;
  child_count: number;
  special_requests: string | null;
  total_amount: string | number;
  created_at: Date;
  updated_at: Date;
  // Joined guest fields
  guest_first_name?: string;
  guest_last_name?: string;
  guest_email?: string;
  guest_phone?: string;
  // Joined room type fields
  type_code?: string;
  type_name?: string;
  type_base_price?: string | number;
  type_capacity?: number;
  type_amenities?: any;
}

export interface GuestDbRow {
  id: string;
  first_name: string;
  last_name: string;
  name?: string;
  id_number?: string | null;
  notes?: string | null;
  email: string | null;
  phone: string | null;
  created_at: Date;
  updated_at: Date;
}
