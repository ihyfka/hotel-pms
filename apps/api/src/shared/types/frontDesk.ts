export interface CheckInResult {
  reservationId: string;
  roomId: string;
  roomNumber: string;
  status: string;
}

export interface CheckOutResult {
  reservationId: string;
  roomId: string;
  status: string;
  housekeepingTaskId: string;
}

export interface WalkInResult {
  guestId: string;
  reservationId: string;
  reservationNumber: string;
  roomId: string;
  roomNumber: string;
  status: string;
}
