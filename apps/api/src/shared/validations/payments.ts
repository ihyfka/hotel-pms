import { z } from "zod";

export const paymentMethodSchema = z.enum([
  "card",
  "cash",
  "transfer",
  "other",
]);
export const paymentStatusSchema = z.enum([
  "pending",
  "succeeded",
  "failed",
  "refunded",
]);

export const createPaymentSchema = z.object({
  reservationId: z.guid("Invalid reservation UUID"),
  amount: z.number().positive("Payment amount must be greater than zero"),
  method: paymentMethodSchema,
  reference: z.string().max(100).optional(),
  notes: z.string().optional(),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
