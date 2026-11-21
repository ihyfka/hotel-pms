import { z } from "zod";

export const occupancyStatusSchema = z.enum(["vacant", "occupied"]);

export const housekeepingStatusSchema = z.enum([
  "clean",
  "dirty",
  "in_progress",
  "cleaning",
  "inspected",
]);

export const createRoomTypeSchema = z.object({
  code: z
    .string()
    .min(2, "Code must be at least 2 characters")
    .max(10, "Code must be at most 10 characters")
    .toUpperCase(),
  name: z.string().min(2, "Name must be at least 2 characters").max(50),
  description: z.string().optional(),
  basePrice: z.number().positive("Base price must be greater than zero"),
  capacity: z.number().int().positive("Capacity must be at least 1 guest"),
  amenities: z.array(z.string()).default([]),
});

export const updateRoomTypeSchema = createRoomTypeSchema.partial();

export const createRoomSchema = z.object({
  roomNumber: z
    .string()
    .min(1, "Room number is required")
    .max(10, "Room number cannot exceed 10 characters")
    .regex(
      /^[A-Za-z0-9-]+$/,
      "Room number may only contain alphanumeric characters and hyphens",
    ),
  roomTypeId: z.guid("Invalid room type UUID"),
  floor: z.number().int().min(0, "Floor must be 0 or greater"),
  building: z.string().min(1).default("Main"),
  notes: z.string().max(500).optional(),
});

export const updateRoomSchema = createRoomSchema
  .partial()
  .omit({ roomNumber: true });

export const updateRoomStatusSchema = z
  .object({
    occupancyStatus: occupancyStatusSchema.optional(),
    housekeepingStatus: housekeepingStatusSchema.optional(),
    isBlocked: z.boolean().optional(),
    maintenanceStatus: z
      .enum(["operational", "under_maintenance", "out_of_service"])
      .optional(),
    reason: z.string().max(255).optional(),
    changedBy: z.string().max(100).optional(),
  })
  .refine(
    (data) =>
      data.occupancyStatus !== undefined ||
      data.housekeepingStatus !== undefined ||
      data.isBlocked !== undefined,
    {
      error:
        "At least one status dimension (occupancy, housekeeping, or maintenance) must be provided",
    },
  );

export const queryRoomsSchema = z.object({
  floor: z.coerce.number().int().optional(),
  building: z.string().optional(),
  occupancy: occupancyStatusSchema.optional(),
  occupancyStatus: occupancyStatusSchema.optional(),
  housekeeping: housekeepingStatusSchema.optional(),
  housekeepingStatus: housekeepingStatusSchema.optional(),
  isBlocked: z.coerce.boolean().optional(),
  maintenanceStatus: z
    .enum(["operational", "under_maintenance", "out_of_service"])
    .optional(),
  roomTypeId: z.guid().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  sortBy: z.enum(["roomNumber", "floor", "createdAt"]).default("roomNumber"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;
export type UpdateRoomStatusInput = z.infer<typeof updateRoomStatusSchema>;
export type CreateRoomTypeInput = z.infer<typeof createRoomTypeSchema>;
export type UpdateRoomTypeInput = z.infer<typeof updateRoomTypeSchema>;
export type QueryRoomsInput = z.infer<typeof queryRoomsSchema>;
