import { z } from "zod";

export const checkInSchema = z.object({
  reservationId: z.guid("Invalid reservation UUID"),
  roomId: z.guid("Invalid room UUID").optional(),
});

export const checkOutSchema = z.object({
  reservationId: z.guid("Invalid reservation UUID"),
});

export const walkInSchema = z.object({
  guest: z.object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    email: z.email("Invalid email address"),
    phone: z.string().optional(),
  }),
  roomTypeId: z.guid("Invalid room type UUID"),
  roomId: z.guid("Invalid room UUID").optional(),
  checkInDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  checkOutDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  adultCount: z.number().int().min(1).default(1),
  childCount: z.number().int().min(0).default(0),
  specialRequests: z.string().max(500).optional(),
});

export type CheckInInput = z.infer<typeof checkInSchema>;
export type CheckOutInput = z.infer<typeof checkOutSchema>;
export type WalkInInput = z.infer<typeof walkInSchema>;
