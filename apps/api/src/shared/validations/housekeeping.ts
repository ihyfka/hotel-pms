import { z } from "zod";

export const housekeepingTaskStatusSchema = z.enum([
  "pending",
  "in_progress",
  "completed",
  "cancelled",
]);

export const housekeepingPrioritySchema = z.enum(["normal", "urgent"]);

export const createHousekeepingTaskSchema = z.object({
  roomId: z.guid("Invalid room UUID"),
  priority: housekeepingPrioritySchema.default("normal"),
  assignedTo: z.string().max(100).optional(),
  notes: z.string().optional(),
});

export const queryHousekeepingTasksSchema = z.object({
  status: housekeepingTaskStatusSchema.optional(),
  priority: housekeepingPrioritySchema.optional(),
  roomId: z.guid().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

export type CreateHousekeepingTaskInput = z.infer<
  typeof createHousekeepingTaskSchema
>;
export type QueryHousekeepingTasksInput = z.infer<
  typeof queryHousekeepingTasksSchema
>;
