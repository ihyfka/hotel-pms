import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { roomsService } from "../../src/modules/rooms/rooms.service.js";
import { Room, RoomType } from "../../src/modules/rooms/rooms.types.js";

describe("Rooms API Endpoints (/api/v1)", () => {
  const sampleRoomType: RoomType = {
    id: "11111111-1111-1111-1111-111111111111",
    code: "DBL",
    name: "Standard Double",
    basePrice: 130,
    capacity: 2,
    amenities: ["WiFi", "TV"],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const sampleRoom: Room = {
    id: "22222222-2222-2222-2222-222222222222",
    roomNumber: "101",
    roomTypeId: sampleRoomType.id,
    floor: 1,
    building: "Main",
    occupancyStatus: "vacant",
    housekeepingStatus: "inspected",
    maintenanceStatus: "operational",
    createdAt: new Date(),
    updatedAt: new Date(),
    roomType: sampleRoomType,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("GET /health", () => {
    it("returns healthy status", async () => {
      const res = await request(app).get("/health");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("healthy");
    });
  });

  describe("GET /api/v1/rooms", () => {
    it("returns paginated list of rooms", async () => {
      vi.spyOn(roomsService, "listRooms").mockResolvedValue({
        data: [sampleRoom],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
        },
      });

      const res = await request(app).get("/api/v1/rooms?page=1&limit=20");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.pagination.total).toBe(1);
    });

    it("rejects invalid query parameters", async () => {
      const res = await request(app).get(
        "/api/v1/rooms?occupancyStatus=invalid_status",
      );
      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("GET /api/v1/rooms/board", () => {
    it("returns room status board data", async () => {
      vi.spyOn(roomsService, "getRoomBoard").mockResolvedValue({
        summary: {
          totalRooms: 1,
          vacant: 1,
          occupied: 0,
          clean: 0,
          dirty: 0,
          cleaning: 0,
          inspected: 1,
          operational: 1,
          underMaintenance: 0,
          outOfService: 0,
          availableForCheckIn: 1,
        },
        floors: [
          {
            floor: 1,
            rooms: [sampleRoom],
          },
        ],
      });

      const res = await request(app).get("/api/v1/rooms/board");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.summary.totalRooms).toBe(1);
      expect(res.body.data.floors).toHaveLength(1);
    });
  });

  describe("GET /api/v1/rooms/:id", () => {
    it("returns room details", async () => {
      vi.spyOn(roomsService, "getRoomById").mockResolvedValue(sampleRoom);

      const res = await request(app).get(`/api/v1/rooms/${sampleRoom.id}`);
      expect(res.status).toBe(200);
      expect(res.body.data.roomNumber).toBe("101");
    });
  });

  describe("POST /api/v1/rooms", () => {
    it("creates a room with valid payload", async () => {
      vi.spyOn(roomsService, "createRoom").mockResolvedValue(sampleRoom);

      const res = await request(app).post("/api/v1/rooms").send({
        roomNumber: "101",
        roomTypeId: sampleRoomType.id,
        floor: 1,
        building: "Main",
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.roomNumber).toBe("101");
    });

    it("rejects room creation with missing required fields", async () => {
      const res = await request(app).post("/api/v1/rooms").send({
        floor: 1,
      });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });
  });

  describe("PATCH /api/v1/rooms/:id/status", () => {
    it("updates room status dimension and returns updated room", async () => {
      const updatedRoom: Room = {
        ...sampleRoom,
        occupancyStatus: "occupied",
      };
      vi.spyOn(roomsService, "updateRoomStatus").mockResolvedValue(updatedRoom);

      const res = await request(app)
        .patch(`/api/v1/rooms/${sampleRoom.id}/status`)
        .send({
          occupancyStatus: "occupied",
          reason: "Guest check-in",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.occupancyStatus).toBe("occupied");
    });

    it("rejects status update with no dimensions specified", async () => {
      const res = await request(app)
        .patch(`/api/v1/rooms/${sampleRoom.id}/status`)
        .send({
          reason: "Just a note with no status changes",
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });
  });

  describe("GET /api/v1/room-types", () => {
    it("returns list of room types", async () => {
      vi.spyOn(roomsService, "listRoomTypes").mockResolvedValue([
        sampleRoomType,
      ]);

      const res = await request(app).get("/api/v1/room-types");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].code).toBe("DBL");
    });
  });
});
