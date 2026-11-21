import { z } from "zod";

export const createAllocationSchema = z.object({
  reservationId: z.guid("Invalid reservation UUID"),
  roomId: z.guid("Invalid room UUID"),
  assignedBy: z.string().optional(),
  notes: z.string().max(500).optional(),
});

export type CreateAllocationInput = z.infer<typeof createAllocationSchema>;
