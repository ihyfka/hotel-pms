export interface AdrReport {
  date: string;
  adr: number;
  occupied_rooms: number;
  total_revenue: number;
}

export interface ArrivalsReportItem {
  guest_name: string;
  reservation_number: string;
  room_type: string;
  allocated_room_number: string | null;
  special_requests: string | null;
}

export interface DeparturesReportItem {
  guest_name: string;
  reservation_number: string;
  room_number: string;
  total_amount: number;
  payment_status: "paid" | "unpaid";
}
