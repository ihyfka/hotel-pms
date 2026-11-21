import { Payment, PaymentMethod, PaymentStatus } from "@hotel-pms/types";

export type { Payment, PaymentMethod, PaymentStatus };

export interface PaymentDbRow {
  id: string;
  reservation_id: string;
  amount: string | number;
  method: PaymentMethod;
  status: PaymentStatus;
  reference: string;
  notes: string | null;
  recorded_by: string;
  paid_at: Date;
  created_at: Date;
}
