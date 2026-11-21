export type HousekeepingTaskStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "cancelled";
export type HousekeepingTaskPriority = "normal" | "urgent";

export interface HousekeepingTask {
  id: string;
  roomId: string;
  status: HousekeepingTaskStatus;
  priority: HousekeepingTaskPriority;
  assignedTo?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
