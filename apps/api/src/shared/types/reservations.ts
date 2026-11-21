import type { RoomType } from "./rooms.js";

export type ReservationStatus =
  | "pending"
  | "pending_payment"
  | "confirmed"
  | "checked_in"
  | "checked_out"
  | "cancelled"
  | "no_show"
  | "expired"
  | "payment_received_no_room";

export type ReservationSource = "walk_in" | "website" | "ota";

export interface Guest {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  idNumber: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  firstName?: string;
  lastName?: string;
}

export interface Reservation {
  id: string;
  reservationNumber?: string;
  guestId: string;
  roomTypeId: string;
  source: ReservationSource;
  checkInDate: string;
  checkOutDate: string;
  adultCount: number;
  childCount: number;
  specialRequests: string | null;
  status: ReservationStatus;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  paymentReference: string | null;
  expiresAt: Date | null;
  confirmedAt: Date | null;
  checkedInAt: Date | null;
  checkedOutAt: Date | null;
  cancelledAt: Date | null;
  cancellationReason: string | null;
  noShowAt: Date | null;
  refundAmount: number | null;
  refundedAt: Date | null;
  refundedBy: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  guest?: Guest;
  roomType?: RoomType;
}
