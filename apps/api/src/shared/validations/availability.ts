import { z } from "zod";

export const availabilityQuerySchema = z.object({
  check_in: z.string().min(1, "check_in is required"),
  check_out: z.string().min(1, "check_out is required"),
});

export type AvailabilityQueryInput = z.infer<typeof availabilityQuerySchema>;
