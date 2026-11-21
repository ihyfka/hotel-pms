import pg from "pg";
import { query } from "../../config/database.js";

export class FrontDeskRepository {
  async updateReservationStatus(
    reservationId: string,
    status: string,
    client: pg.PoolClient,
  ) {
    await client.query(
      `UPDATE reservations SET status = $1, updated_at = NOW() WHERE id = $2`,
      [status, reservationId],
    );
  }

  async updateAllocationStatus(
    allocationId: string,
    status: string,
    client: pg.PoolClient,
  ) {
    await client.query(
      `UPDATE room_allocations SET status = $1 WHERE id = $2`,
      [status, allocationId],
    );
  }

  async updateRoomStatuses(
    roomId: string,
    updates: {
      occupancyStatus?: string;
      housekeepingStatus?: string;
      maintenanceStatus?: string;
    },
    client: pg.PoolClient,
  ) {
    const sets: string[] = ["updated_at = NOW()"];
    const params: any[] = [roomId];
    let idx = 2;

    if (updates.occupancyStatus) {
      sets.push(`occupancy_status = $${idx++}`);
      params.push(updates.occupancyStatus);
    }
    if (updates.housekeepingStatus) {
      sets.push(`housekeeping_status = $${idx++}`);
      params.push(updates.housekeepingStatus);
    }
    if (updates.maintenanceStatus) {
      sets.push(`maintenance_status = $${idx++}`);
      params.push(updates.maintenanceStatus);
    }

    await client.query(
      `UPDATE rooms SET ${sets.join(", ")} WHERE id = $1`,
      params,
    );
  }

  async recordRoomStatusHistory(
    data: {
      roomId: string;
      prevOccupancy?: string;
      newOccupancy?: string;
      prevHousekeeping?: string;
      newHousekeeping?: string;
      prevMaintenance?: string;
      newMaintenance?: string;
      changedBy?: string;
      reason?: string;
    },
    client: pg.PoolClient,
  ) {
    await client.query(
      `INSERT INTO room_status_history (
        room_id,
        previous_occupancy,
        new_occupancy,
        previous_housekeeping,
        new_housekeeping,
        previous_maintenance,
        new_maintenance,
        changed_by,
        reason
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        data.roomId,
        data.prevOccupancy ?? null,
        data.newOccupancy ?? null,
        data.prevHousekeeping ?? null,
        data.newHousekeeping ?? null,
        data.prevMaintenance ?? null,
        data.newMaintenance ?? null,
        data.changedBy ?? "front_desk",
        data.reason ?? null,
      ],
    );
  }

  async createHousekeepingTask(
    roomId: string,
    priority: string = "normal",
    notes: string = "Auto-created on check-out",
    client: pg.PoolClient,
  ): Promise<string> {
    const res = await client.query<{ id: string }>(
      `INSERT INTO housekeeping_tasks (room_id, priority, notes, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING id`,
      [roomId, priority, notes],
    );
    return res.rows[0].id;
  }
}

export const frontDeskRepository = new FrontDeskRepository();
