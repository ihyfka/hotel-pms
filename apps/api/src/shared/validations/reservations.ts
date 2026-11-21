import { z } from "zod";

export const reservationStatusSchema = z.enum([
  "pending_payment",
  "confirmed",
  "checked_in",
  "checked_out",
  "cancelled",
  "no_show",
  "expired",
  "payment_received_no_room",
]);

export const createReservationSchema = z
  .object({
    guestId: z.guid("Invalid guest UUID"),
    roomTypeId: z.guid("Invalid room type UUID"),
    checkInDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Check-in date must be YYYY-MM-DD"),
    checkOutDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Check-out date must be YYYY-MM-DD"),
    adultCount: z
      .number()
      .int()
      .min(1, "At least 1 adult is required")
      .default(1),
    childCount: z.number().int().min(0).default(0),
    specialRequests: z.string().max(500).optional(),
    totalAmount: z.number().positive().optional(),
  })
  .refine((data) => new Date(data.checkOutDate) > new Date(data.checkInDate), {
    error: "Check-out date must be strictly after check-in date",
    path: ["checkOutDate"],
  });

export const updateReservationSchema = z.object({
  adultCount: z.number().int().min(1).optional(),
  childCount: z.number().int().min(0).optional(),
  specialRequests: z.string().max(500).optional(),
});

export const queryReservationsSchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  status: reservationStatusSchema.optional(),
  guestId: z.guid().optional(),
  roomTypeId: z.guid().optional(),
  checkInDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  checkOutDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export const allocateRoomSchema = z.object({
  reservationId: z.guid("Invalid reservation UUID"),
  roomId: z.guid("Invalid room UUID"),
  assignedBy: z.string().optional(),
  notes: z.string().max(500).optional(),
});

export type CreateReservationInput = z.infer<typeof createReservationSchema>;
export type UpdateReservationInput = z.infer<typeof updateReservationSchema>;
export type QueryReservationsInput = z.infer<typeof queryReservationsSchema>;
export type AllocateRoomInput = z.infer<typeof allocateRoomSchema>;
