export type PaymentMethod = "card" | "cash" | "transfer" | "other";
export type PaymentStatus = "pending" | "succeeded" | "failed" | "refunded";

export interface Payment {
  id: string;
  reservationId: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  reference: string;
  notes?: string;
  recordedBy: string;
  paidAt: Date;
  createdAt: Date;
}
