export type OccupancyStatus = "vacant" | "occupied";
export type HousekeepingStatus =
  | "clean"
  | "dirty"
  | "in_progress"
  | "cleaning"
  | "inspected";
export type MaintenanceStatus =
  | "operational"
  | "under_maintenance"
  | "out_of_service";
export type RoomIssueType = "maintenance" | "housekeeping" | "other";
export type RoomIssueSeverity = "low" | "medium" | "high";
export type RoomIssueStatus = "open" | "resolved" | "cancelled";

export interface RoomType {
  id: string;
  name: string;
  capacity: number;
  baseRate: number;
  physicalRoomCount: number;
  overbookingAllowance: number;
  createdAt: Date;
  updatedAt: Date;
  code?: string;
  basePrice?: number;
  amenities?: string[];
}

export interface Room {
  id: string;
  number: string;
  roomTypeId: string;
  housekeeping: HousekeepingStatus;
  occupancy: OccupancyStatus;
  isBlocked: boolean;
  isOutOfOrder: boolean;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
  roomType?: RoomType;
  roomNumber?: string;
  floor?: number;
  building?: string;
  occupancyStatus?: OccupancyStatus;
  housekeepingStatus?: HousekeepingStatus;
  maintenanceStatus?: MaintenanceStatus;
}

export interface RoomStatusHistory {
  id: string;
  roomId: string;
  previousOccupancy?: OccupancyStatus;
  newOccupancy?: OccupancyStatus;
  previousHousekeeping?: HousekeepingStatus;
  newHousekeeping?: HousekeepingStatus;
  previousMaintenance?: MaintenanceStatus;
  newMaintenance?: MaintenanceStatus;
  changedBy?: string;
  reason?: string;
  createdAt: Date;
}

export interface RoomBoardFilter {
  floor?: number;
  building?: string;
  occupancyStatus?: OccupancyStatus;
  housekeepingStatus?: HousekeepingStatus;
  maintenanceStatus?: MaintenanceStatus;
  roomTypeId?: string;
}

export interface RoomOperationalSummary {
  totalRooms: number;
  vacant: number;
  occupied: number;
  clean: number;
  dirty: number;
  cleaning: number;
  inspected: number;
  operational: number;
  underMaintenance: number;
  outOfService: number;
  availableForCheckIn: number; // vacant + inspected + operational
}

export interface FloorBoardGroup {
  floor: number;
  rooms: Room[];
}

export interface RoomBoardData {
  summary: RoomOperationalSummary;
  floors: FloorBoardGroup[];
}
