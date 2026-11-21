import { pool, withTransaction, query } from "../../config/database.js";
import {
  Room,
  RoomType,
  RoomStatusHistory,
  RoomBoardFilter,
  RoomOperationalSummary,
  FloorBoardGroup,
  OccupancyStatus,
  HousekeepingStatus,
  MaintenanceStatus,
} from "./rooms.types.js";
import {
  RoomDbRow,
  RoomTypeDbRow,
  RoomStatusHistoryDbRow,
} from "./rooms.types.js";
import {
  CreateRoomInput,
  UpdateRoomInput,
  QueryRoomsInput,
  CreateRoomTypeInput,
} from "./rooms.schemas.js";

function mapRoomTypeRow(row: RoomTypeDbRow): RoomType {
  return {
    id: row.id,
    name: row.name,
    capacity: row.capacity,
    baseRate: Number(row.base_rate ?? row.base_price),
    physicalRoomCount: row.physical_room_count ?? 0,
    overbookingAllowance: row.overbooking_allowance ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    code: row.code,
    basePrice: Number(row.base_rate ?? row.base_price),
    amenities: Array.isArray(row.amenities)
      ? row.amenities
      : JSON.parse(row.amenities || "[]"),
  };
}

function mapRoomRow(row: RoomDbRow): Room {
  const room: Room = {
    id: row.id,
    number: row.number ?? row.room_number ?? "",
    roomNumber: row.number ?? row.room_number ?? "",
    roomTypeId: row.room_type_id,
    floor: row.floor,
    building: row.building,
    occupancy: row.occupancy_status,
    occupancyStatus: row.occupancy_status,
    housekeeping: row.housekeeping_status as HousekeepingStatus,
    housekeepingStatus: row.housekeeping_status as HousekeepingStatus,
    isBlocked: row.is_blocked ?? false,
    isOutOfOrder: false,
    updatedBy: row.updated_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  if (row.type_code && row.type_name) {
    room.roomType = {
      id: row.room_type_id,
      code: row.type_code,
      name: row.type_name,
      capacity: row.type_capacity ?? 2,
      baseRate: Number(row.type_base_price),
      physicalRoomCount: row.type_capacity ?? 0,
      overbookingAllowance: 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      basePrice: Number(row.type_base_price),
      amenities: Array.isArray(row.type_amenities)
        ? row.type_amenities
        : JSON.parse(row.type_amenities || "[]"),
    };
  }

  return room;
}

function mapHistoryRow(row: RoomStatusHistoryDbRow): RoomStatusHistory {
  return {
    id: row.id,
    roomId: row.room_id,
    previousOccupancy: row.previous_occupancy ?? undefined,
    newOccupancy: row.new_occupancy ?? undefined,
    previousHousekeeping: row.previous_housekeeping ?? undefined,
    newHousekeeping: row.new_housekeeping ?? undefined,
    previousMaintenance: row.previous_maintenance ?? undefined,
    newMaintenance: row.new_maintenance ?? undefined,
    changedBy: row.changed_by ?? undefined,
    reason: row.reason ?? undefined,
    createdAt: row.created_at,
  };
}

export class RoomsRepository {
  async findRooms(
    filter: QueryRoomsInput,
    offset: number,
    limit: number,
  ): Promise<Room[]> {
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (filter.floor !== undefined) {
      conditions.push(`r.floor = $${idx++}`);
      values.push(filter.floor);
    }
    if (filter.building) {
      conditions.push(`r.building = $${idx++}`);
      values.push(filter.building);
    }
    if (filter.occupancyStatus) {
      conditions.push(`r.occupancy_status = $${idx++}`);
      values.push(filter.occupancyStatus);
    }
    if (filter.housekeepingStatus) {
      conditions.push(`r.housekeeping_status = $${idx++}`);
      values.push(filter.housekeepingStatus);
    }
    if (filter.maintenanceStatus) {
      conditions.push(`r.maintenance_status = $${idx++}`);
      values.push(filter.maintenanceStatus);
    }
    if (filter.roomTypeId) {
      conditions.push(`r.room_type_id = $${idx++}`);
      values.push(filter.roomTypeId);
    }
    if (filter.search) {
      conditions.push(`r.room_number ILIKE $${idx++}`);
      values.push(`%${filter.search}%`);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const sortField =
      filter.sortBy === "floor"
        ? "r.floor"
        : filter.sortBy === "createdAt"
          ? "r.created_at"
          : "r.room_number";
    const sortDir = filter.sortOrder?.toUpperCase() === "DESC" ? "DESC" : "ASC";

    const sql = `
      SELECT
        r.*,
        rt.code as type_code,
        rt.name as type_name,
        rt.description as type_description,
        rt.base_price as type_base_price,
        rt.capacity as type_capacity,
        rt.amenities as type_amenities
      FROM rooms r
      JOIN room_types rt ON r.room_type_id = rt.id
      ${whereClause}
      ORDER BY ${sortField} ${sortDir}
      LIMIT $${idx++} OFFSET $${idx++}
    `;

    values.push(limit, offset);
    const res = await query<RoomDbRow>(sql, values);
    return res.rows.map(mapRoomRow);
  }

  async countRooms(filter: QueryRoomsInput): Promise<number> {
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (filter.floor !== undefined) {
      conditions.push(`floor = $${idx++}`);
      values.push(filter.floor);
    }
    if (filter.building) {
      conditions.push(`building = $${idx++}`);
      values.push(filter.building);
    }
    if (filter.occupancyStatus) {
      conditions.push(`occupancy_status = $${idx++}`);
      values.push(filter.occupancyStatus);
    }
    if (filter.housekeepingStatus) {
      conditions.push(`housekeeping_status = $${idx++}`);
      values.push(filter.housekeepingStatus);
    }
    if (filter.maintenanceStatus) {
      conditions.push(`maintenance_status = $${idx++}`);
      values.push(filter.maintenanceStatus);
    }
    if (filter.roomTypeId) {
      conditions.push(`room_type_id = $${idx++}`);
      values.push(filter.roomTypeId);
    }
    if (filter.search) {
      conditions.push(`room_number ILIKE $${idx++}`);
      values.push(`%${filter.search}%`);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const sql = `SELECT COUNT(*)::int as count FROM rooms ${whereClause}`;
    const res = await query<{ count: number }>(sql, values);
    return res.rows[0]?.count ?? 0;
  }

  async findRoomById(id: string, client?: any): Promise<Room | null> {
    const sql = `
      SELECT
        r.*,
        rt.code as type_code,
        rt.name as type_name,
        rt.description as type_description,
        rt.base_price as type_base_price,
        rt.capacity as type_capacity,
        rt.amenities as type_amenities
      FROM rooms r
      JOIN room_types rt ON r.room_type_id = rt.id
      WHERE r.id = $1
    `;
    const res = client
      ? await client.query(sql, [id])
      : await query<RoomDbRow>(sql, [id]);
    if (res.rows.length === 0) return null;
    return mapRoomRow(res.rows[0]);
  }

  async findRoomByNumber(roomNumber: string): Promise<Room | null> {
    const sql = `
      SELECT
        r.*,
        rt.code as type_code,
        rt.name as type_name,
        rt.description as type_description,
        rt.base_price as type_base_price,
        rt.capacity as type_capacity,
        rt.amenities as type_amenities
      FROM rooms r
      JOIN room_types rt ON r.room_type_id = rt.id
      WHERE r.room_number = $1
    `;
    const res = await query<RoomDbRow>(sql, [roomNumber]);
    if (res.rows.length === 0) return null;
    return mapRoomRow(res.rows[0]);
  }

  async createRoom(data: CreateRoomInput): Promise<Room> {
    const sql = `
      INSERT INTO rooms (
        room_number,
        room_type_id,
        floor,
        building,
        notes
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const res = await query<RoomDbRow>(sql, [
      data.roomNumber,
      data.roomTypeId,
      data.floor,
      data.building,
      data.notes ?? null,
    ]);

    return (await this.findRoomById(res.rows[0].id))!;
  }

  async updateRoom(id: string, data: UpdateRoomInput): Promise<Room | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (data.roomTypeId !== undefined) {
      fields.push(`room_type_id = $${idx++}`);
      values.push(data.roomTypeId);
    }
    if (data.floor !== undefined) {
      fields.push(`floor = $${idx++}`);
      values.push(data.floor);
    }
    if (data.building !== undefined) {
      fields.push(`building = $${idx++}`);
      values.push(data.building);
    }
    if (data.notes !== undefined) {
      fields.push(`notes = $${idx++}`);
      values.push(data.notes);
    }

    if (fields.length === 0) {
      return this.findRoomById(id);
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const sql = `
      UPDATE rooms
      SET ${fields.join(", ")}
      WHERE id = $${idx}
      RETURNING *
    `;

    const res = await query<RoomDbRow>(sql, values);
    if (res.rows.length === 0) return null;
    return this.findRoomById(id);
  }

  async updateRoomStatusWithHistory(
    roomId: string,
    currentRoom: Room,
    updates: {
      occupancyStatus?: OccupancyStatus;
      housekeepingStatus?: HousekeepingStatus;
      maintenanceStatus?: MaintenanceStatus;
    },
    changedBy?: string,
    reason?: string,
  ): Promise<Room> {
    return withTransaction(async (client) => {
      const nextOccupancy =
        updates.occupancyStatus ?? currentRoom.occupancyStatus;
      const nextHousekeeping =
        updates.housekeepingStatus ?? currentRoom.housekeepingStatus;
      const nextMaintenance =
        updates.maintenanceStatus ?? currentRoom.maintenanceStatus;

      // Update room status
      const updateSql = `
        UPDATE rooms
        SET
          occupancy_status = $1,
          housekeeping_status = $2,
          maintenance_status = $3,
          updated_at = NOW()
        WHERE id = $4
        RETURNING *
      `;
      const updateRes = await client.query<RoomDbRow>(updateSql, [
        nextOccupancy,
        nextHousekeeping,
        nextMaintenance,
        roomId,
      ]);

      // Insert audit history record
      const historySql = `
        INSERT INTO room_status_history (
          room_id,
          previous_occupancy,
          new_occupancy,
          previous_housekeeping,
          new_housekeeping,
          previous_maintenance,
          new_maintenance,
          changed_by,
          reason
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `;
      await client.query(historySql, [
        roomId,
        updates.occupancyStatus !== undefined
          ? currentRoom.occupancyStatus
          : null,
        updates.occupancyStatus !== undefined ? nextOccupancy : null,
        updates.housekeepingStatus !== undefined
          ? currentRoom.housekeepingStatus
          : null,
        updates.housekeepingStatus !== undefined ? nextHousekeeping : null,
        updates.maintenanceStatus !== undefined
          ? currentRoom.maintenanceStatus
          : null,
        updates.maintenanceStatus !== undefined ? nextMaintenance : null,
        changedBy ?? null,
        reason ?? null,
      ]);

      return mapRoomRow(updateRes.rows[0]);
    });
  }

  async findStatusHistoryByRoomId(
    roomId: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<RoomStatusHistory[]> {
    const sql = `
      SELECT *
      FROM room_status_history
      WHERE room_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const res = await query<RoomStatusHistoryDbRow>(sql, [
      roomId,
      limit,
      offset,
    ]);
    return res.rows.map(mapHistoryRow);
  }

  async getRoomOperationalSummary(): Promise<RoomOperationalSummary> {
    const sql = `
      SELECT
        COUNT(*)::int as total_rooms,
        COUNT(CASE WHEN occupancy_status = 'vacant' THEN 1 END)::int as vacant,
        COUNT(CASE WHEN occupancy_status = 'occupied' THEN 1 END)::int as occupied,
        COUNT(CASE WHEN housekeeping_status = 'clean' THEN 1 END)::int as clean,
        COUNT(CASE WHEN housekeeping_status = 'dirty' THEN 1 END)::int as dirty,
        COUNT(CASE WHEN housekeeping_status = 'cleaning' THEN 1 END)::int as cleaning,
        COUNT(CASE WHEN housekeeping_status = 'inspected' THEN 1 END)::int as inspected,
        COUNT(CASE WHEN maintenance_status = 'operational' THEN 1 END)::int as operational,
        COUNT(CASE WHEN maintenance_status = 'under_maintenance' THEN 1 END)::int as under_maintenance,
        COUNT(CASE WHEN maintenance_status = 'out_of_service' THEN 1 END)::int as out_of_service,
        COUNT(CASE WHEN occupancy_status = 'vacant' AND housekeeping_status = 'inspected' AND maintenance_status = 'operational' THEN 1 END)::int as available_for_check_in
      FROM rooms
    `;
    const res = await query<any>(sql);
    const row = res.rows[0];

    return {
      totalRooms: row.total_rooms ?? 0,
      vacant: row.vacant ?? 0,
      occupied: row.occupied ?? 0,
      clean: row.clean ?? 0,
      dirty: row.dirty ?? 0,
      cleaning: row.cleaning ?? 0,
      inspected: row.inspected ?? 0,
      operational: row.operational ?? 0,
      underMaintenance: row.under_maintenance ?? 0,
      outOfService: row.out_of_service ?? 0,
      availableForCheckIn: row.available_for_check_in ?? 0,
    };
  }

  async findRoomsForBoard(
    filter: RoomBoardFilter = {},
  ): Promise<FloorBoardGroup[]> {
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (filter.floor !== undefined) {
      conditions.push(`r.floor = $${idx++}`);
      values.push(filter.floor);
    }
    if (filter.building) {
      conditions.push(`r.building = $${idx++}`);
      values.push(filter.building);
    }
    if (filter.occupancyStatus) {
      conditions.push(`r.occupancy_status = $${idx++}`);
      values.push(filter.occupancyStatus);
    }
    if (filter.housekeepingStatus) {
      conditions.push(`r.housekeeping_status = $${idx++}`);
      values.push(filter.housekeepingStatus);
    }
    if (filter.maintenanceStatus) {
      conditions.push(`r.maintenance_status = $${idx++}`);
      values.push(filter.maintenanceStatus);
    }
    if (filter.roomTypeId) {
      conditions.push(`r.room_type_id = $${idx++}`);
      values.push(filter.roomTypeId);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const sql = `
      SELECT
        r.*,
        rt.code as type_code,
        rt.name as type_name,
        rt.description as type_description,
        rt.base_price as type_base_price,
        rt.capacity as type_capacity,
        rt.amenities as type_amenities
      FROM rooms r
      JOIN room_types rt ON r.room_type_id = rt.id
      ${whereClause}
      ORDER BY r.floor ASC, r.room_number ASC
    `;

    const res = await query<RoomDbRow>(sql, values);
    const rooms = res.rows.map(mapRoomRow);

    // Group rooms by floor
    const floorMap = new Map<number, Room[]>();
    for (const room of rooms) {
      const floor = room.floor ?? 0;
      if (!floorMap.has(floor)) {
        floorMap.set(floor, []);
      }
      floorMap.get(floor)!.push(room);
    }

    const floors: FloorBoardGroup[] = [];
    for (const [floor, floorRooms] of floorMap.entries()) {
      floors.push({ floor, rooms: floorRooms });
    }

    return floors;
  }

  // Room Types
  async findRoomTypes(): Promise<RoomType[]> {
    const sql = "SELECT * FROM room_types ORDER BY base_price ASC";
    const res = await query<RoomTypeDbRow>(sql);
    return res.rows.map(mapRoomTypeRow);
  }

  async findRoomTypeById(id: string): Promise<RoomType | null> {
    const sql = "SELECT * FROM room_types WHERE id = $1";
    const res = await query<RoomTypeDbRow>(sql, [id]);
    if (res.rows.length === 0) return null;
    return mapRoomTypeRow(res.rows[0]);
  }

  async findRoomTypeByCode(code: string): Promise<RoomType | null> {
    const sql = "SELECT * FROM room_types WHERE code = $1";
    const res = await query<RoomTypeDbRow>(sql, [code]);
    if (res.rows.length === 0) return null;
    return mapRoomTypeRow(res.rows[0]);
  }

  async createRoomType(data: CreateRoomTypeInput): Promise<RoomType> {
    const sql = `
      INSERT INTO room_types (
        code,
        name,
        description,
        base_price,
        capacity,
        amenities
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const res = await query<RoomTypeDbRow>(sql, [
      data.code,
      data.name,
      data.description ?? null,
      data.basePrice,
      data.capacity,
      JSON.stringify(data.amenities || []),
    ]);

    return mapRoomTypeRow(res.rows[0]);
  }
}

export const roomsRepository = new RoomsRepository();
