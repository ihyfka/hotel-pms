import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "../../src/app.js";
import { env } from "../../src/config/env.js";
import { availabilityService } from "../../src/modules/availability/availability.service.js";
import { reservationsService } from "../../src/modules/reservations/reservations.service.js";
import { allocationsService } from "../../src/modules/allocations/allocations.service.js";
import { frontDeskService } from "../../src/modules/frontDesk/frontDesk.service.js";
import { paymentsService } from "../../src/modules/payments/payments.service.js";
import { reportsService } from "../../src/modules/reports/reports.service.js";

function createToken(role: string = "admin") {
  return jwt.sign(
    { id: "user-1", email: "user@hotel.com", role },
    env.JWT_SECRET,
  );
}

describe("Hotel PMS Modules 3–9 API Integration Tests", () => {
  const adminToken = createToken("admin");
  const frontDeskToken = createToken("front_desk");

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // MODULE 3: Availability
  describe("Module 3: Availability (/api/v1/availability)", () => {
    it("is public and returns availability array for valid date range", async () => {
      vi.spyOn(availabilityService, "getAvailability").mockResolvedValue([
        {
          room_type_id: "rt-1",
          code: "DLX",
          name: "Deluxe Suite",
          base_price: 150,
          capacity: 2,
          amenities: ["WiFi"],
          available_count: 5,
          total_nights: 3,
          total_price: 450,
        },
      ]);

      const res = await request(app).get(
        "/api/v1/availability?check_in=2026-12-01&check_out=2026-12-04",
      );
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0].code).toBe("DLX");
      expect(res.body[0].total_price).toBe(450);
    });

    it("returns 400 MISSING_DATES when check_in or check_out is missing", async () => {
      const res = await request(app).get("/api/v1/availability");
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("MISSING_DATES");
    });

    it("returns 422 INVALID_DATE_FORMAT when date is malformed", async () => {
      const res = await request(app).get(
        "/api/v1/availability?check_in=bad-date&check_out=2026-12-04",
      );
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("INVALID_DATE_FORMAT");
    });
  });

  // MODULE 4: Reservations
  describe("Module 4: Reservations (/api/v1/reservations)", () => {
    const sampleReservation = {
      id: "55555555-5555-5555-5555-555555555555",
      reservationNumber: "RSV-TEST1234",
      guestId: "11111111-1111-1111-1111-111111111111",
      roomTypeId: "22222222-2222-2222-2222-222222222222",
      checkInDate: "2026-12-01",
      checkOutDate: "2026-12-04",
      status: "confirmed" as const,
      adultCount: 2,
      childCount: 0,
      totalAmount: 450,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("creates a reservation with valid payload (staff)", async () => {
      vi.spyOn(reservationsService, "createReservation").mockResolvedValue(
        sampleReservation,
      );

      const res = await request(app)
        .post("/api/v1/reservations")
        .set("Authorization", `Bearer ${frontDeskToken}`)
        .send({
          guestId: sampleReservation.guestId,
          roomTypeId: sampleReservation.roomTypeId,
          checkInDate: "2026-12-01",
          checkOutDate: "2026-12-04",
          adultCount: 2,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.reservationNumber).toBe("RSV-TEST1234");
    });

    it("lists reservations with pagination", async () => {
      vi.spyOn(reservationsService, "listReservations").mockResolvedValue({
        data: [sampleReservation],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });

      const res = await request(app)
        .get("/api/v1/reservations?page=1&limit=20")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it("confirms a pending reservation", async () => {
      vi.spyOn(reservationsService, "confirmReservation").mockResolvedValue(
        sampleReservation,
      );

      const res = await request(app)
        .post(`/api/v1/reservations/${sampleReservation.id}/confirm`)
        .set("Authorization", `Bearer ${frontDeskToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("confirmed");
    });

    it("cancels a reservation", async () => {
      vi.spyOn(reservationsService, "cancelReservation").mockResolvedValue({
        ...sampleReservation,
        status: "cancelled",
      });

      const res = await request(app)
        .post(`/api/v1/reservations/${sampleReservation.id}/cancel`)
        .set("Authorization", `Bearer ${frontDeskToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("cancelled");
    });
  });

  // MODULE 5: Room Allocation
  describe("Module 5: Room Allocation (/api/v1/allocations)", () => {
    const sampleAllocation = {
      id: "alloc-1",
      reservationId: "55555555-5555-5555-5555-555555555555",
      roomId: "33333333-3333-3333-3333-333333333333",
      assignedRangeStart: new Date("2026-12-01T14:00:00Z"),
      assignedRangeEnd: new Date("2026-12-04T11:00:00Z"),
      status: "active" as const,
      assignedAt: new Date(),
    };

    it("allocates room to reservation", async () => {
      vi.spyOn(allocationsService, "allocateRoom").mockResolvedValue(
        sampleAllocation,
      );

      const res = await request(app)
        .post("/api/v1/allocations")
        .set("Authorization", `Bearer ${frontDeskToken}`)
        .send({
          reservationId: sampleAllocation.reservationId,
          roomId: sampleAllocation.roomId,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("active");
    });

    it("cancels an allocation", async () => {
      vi.spyOn(allocationsService, "cancelAllocation").mockResolvedValue({
        ...sampleAllocation,
        status: "cancelled",
      });

      const res = await request(app)
        .post(`/api/v1/allocations/${sampleAllocation.id}/cancel`)
        .set("Authorization", `Bearer ${frontDeskToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("cancelled");
    });
  });

  // MODULE 7: Front Desk
  describe("Module 7: Front Desk (/api/v1/front-desk)", () => {
    it("checks in a reservation", async () => {
      vi.spyOn(frontDeskService, "checkIn").mockResolvedValue({
        reservationId: "55555555-5555-5555-5555-555555555555",
        roomId: "33333333-3333-3333-3333-333333333333",
        roomNumber: "101",
        status: "checked_in",
      });

      const res = await request(app)
        .post("/api/v1/front-desk/check-in")
        .set("Authorization", `Bearer ${frontDeskToken}`)
        .send({
          reservationId: "55555555-5555-5555-5555-555555555555",
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("checked_in");
    });

    it("checks out a reservation", async () => {
      vi.spyOn(frontDeskService, "checkOut").mockResolvedValue({
        reservationId: "55555555-5555-5555-5555-555555555555",
        roomId: "33333333-3333-3333-3333-333333333333",
        status: "checked_out",
        housekeepingTaskId: "task-new-1",
      });

      const res = await request(app)
        .post("/api/v1/front-desk/check-out")
        .set("Authorization", `Bearer ${frontDeskToken}`)
        .send({
          reservationId: "55555555-5555-5555-5555-555555555555",
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("checked_out");
      expect(res.body.data.housekeepingTaskId).toBe("task-new-1");
    });

    it("performs walk-in registration and check-in", async () => {
      vi.spyOn(frontDeskService, "walkIn").mockResolvedValue({
        guestId: "11111111-1111-1111-1111-111111111111",
        reservationId: "55555555-5555-5555-5555-555555555555",
        reservationNumber: "RSV-WALK1234",
        roomId: "33333333-3333-3333-3333-333333333333",
        roomNumber: "101",
        status: "checked_in",
      });

      const res = await request(app)
        .post("/api/v1/front-desk/walk-in")
        .set("Authorization", `Bearer ${frontDeskToken}`)
        .send({
          guest: {
            firstName: "Alex",
            lastName: "Taylor",
            email: "alex@example.com",
          },
          roomTypeId: "22222222-2222-2222-2222-222222222222",
        });

      expect(res.status).toBe(201);
      expect(res.body.data.reservationNumber).toBe("RSV-WALK1234");
      expect(res.body.data.status).toBe("checked_in");
    });
  });

  // MODULE 8: Payments
  describe("Module 8: Payments (/api/v1/payments)", () => {
    const samplePayment = {
      id: "pay-1",
      reservationId: "55555555-5555-5555-5555-555555555555",
      amount: 300,
      method: "card" as const,
      status: "completed" as const,
      recordedBy: "front_desk",
      paidAt: new Date(),
      createdAt: new Date(),
    };

    it("records a payment", async () => {
      vi.spyOn(paymentsService, "createPayment").mockResolvedValue(
        samplePayment,
      );

      const res = await request(app)
        .post("/api/v1/payments")
        .set("Authorization", `Bearer ${frontDeskToken}`)
        .send({
          reservationId: samplePayment.reservationId,
          amount: 300,
          method: "card",
        });

      expect(res.status).toBe(201);
      expect(res.body.data.amount).toBe(300);
    });

    it("fetches payment for a reservation", async () => {
      vi.spyOn(paymentsService, "getPaymentByReservationId").mockResolvedValue(
        samplePayment,
      );

      const res = await request(app)
        .get(`/api/v1/payments/reservation/${samplePayment.reservationId}`)
        .set("Authorization", `Bearer ${frontDeskToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe("pay-1");
    });
  });

  // MODULE 9: Reports
  describe("Module 9: Reports (/api/v1/reports)", () => {
    it("returns ADR report for admin", async () => {
      vi.spyOn(reportsService, "getAdr").mockResolvedValue({
        date: "2026-11-15",
        adr: 175.5,
        occupied_rooms: 10,
        total_revenue: 1755,
      });

      const res = await request(app)
        .get("/api/v1/reports/adr?date=2026-11-15")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.adr).toBe(175.5);
    });

    it("rejects reports access for non-admin with 403 FORBIDDEN", async () => {
      const res = await request(app)
        .get("/api/v1/reports/adr")
        .set("Authorization", `Bearer ${frontDeskToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("returns arrivals list for admin", async () => {
      vi.spyOn(reportsService, "getArrivals").mockResolvedValue([
        {
          guest_name: "John Doe",
          reservation_number: "RSV-001",
          room_type: "King Suite",
          allocated_room_number: "101",
          special_requests: null,
        },
      ]);

      const res = await request(app)
        .get("/api/v1/reports/arrivals?date=2026-11-15")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it("returns departures list for admin", async () => {
      vi.spyOn(reportsService, "getDepartures").mockResolvedValue([
        {
          guest_name: "Jane Smith",
          reservation_number: "RSV-002",
          room_number: "202",
          total_amount: 350,
          payment_status: "paid",
        },
      ]);

      const res = await request(app)
        .get("/api/v1/reports/departures?date=2026-11-15")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data[0].payment_status).toBe("paid");
    });
  });
});
