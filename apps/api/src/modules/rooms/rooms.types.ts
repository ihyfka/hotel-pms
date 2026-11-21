export type {
  OccupancyStatus,
  HousekeepingStatus,
  MaintenanceStatus,
  Room,
  RoomType,
  RoomStatusHistory,
  RoomBoardFilter,
  RoomOperationalSummary,
  FloorBoardGroup,
  RoomBoardData,
} from "@hotel-pms/types";

export interface RoomDbRow {
  id: string;
  room_number?: string;
  number?: string;
  room_type_id: string;
  floor?: number;
  building?: string;
  occupancy_status: "vacant" | "occupied";
  housekeeping_status: "clean" | "dirty" | "in_progress";
  is_blocked?: boolean;
  updated_by?: string | null;
  notes?: string | null;
  created_at: Date;
  updated_at: Date;
  // Joined room type fields
  type_code?: string;
  type_name?: string;
  type_description?: string;
  type_base_price?: string | number;
  type_capacity?: number;
  type_amenities?: any;
}

export interface RoomTypeDbRow {
  id: string;
  code?: string;
  name: string;
  description?: string | null;
  base_price?: string | number;
  base_rate?: string | number;
  capacity: number;
  physical_room_count?: number;
  overbooking_allowance?: number;
  amenities: any;
  created_at: Date;
  updated_at: Date;
}

export interface RoomStatusHistoryDbRow {
  id: string;
  room_id: string;
  previous_occupancy: "vacant" | "occupied" | null;
  new_occupancy: "vacant" | "occupied" | null;
  previous_housekeeping: "clean" | "dirty" | "cleaning" | "inspected" | null;
  new_housekeeping: "clean" | "dirty" | "cleaning" | "inspected" | null;
  previous_maintenance:
    | "operational"
    | "under_maintenance"
    | "out_of_service"
    | null;
  new_maintenance:
    | "operational"
    | "under_maintenance"
    | "out_of_service"
    | null;
  changed_by: string | null;
  reason: string | null;
  created_at: Date;
}
