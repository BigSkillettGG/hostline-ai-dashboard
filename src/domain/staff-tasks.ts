export type StaffTaskPriority = "low" | "normal" | "high" | "urgent";
export type StaffTaskStatus = "open" | "in_progress" | "done" | "dismissed";
export type StaffTaskType =
  | "delivery_issue"
  | "general"
  | "low_confidence_review"
  | "manager_callback"
  | "order_follow_up"
  | "reservation_review";

export interface StaffTask {
  assignedTo?: string;
  body?: string;
  callId?: string;
  completedAt?: string;
  createdAt: string;
  dueAt?: string;
  id: string;
  orderId?: string;
  priority: StaffTaskPriority;
  reservationId?: string;
  status: StaffTaskStatus;
  title: string;
  type: StaffTaskType;
}

const taskStatuses: StaffTaskStatus[] = ["open", "in_progress", "done", "dismissed"];
const taskPriorities: StaffTaskPriority[] = ["low", "normal", "high", "urgent"];
const taskTypes: StaffTaskType[] = [
  "delivery_issue",
  "general",
  "low_confidence_review",
  "manager_callback",
  "order_follow_up",
  "reservation_review",
];

const statusRank: Record<StaffTaskStatus, number> = {
  in_progress: 0,
  open: 1,
  done: 2,
  dismissed: 3,
};

const priorityRank: Record<StaffTaskPriority, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

export function normalizeStaffTaskStatus(value: unknown): StaffTaskStatus {
  return normalizeEnum(value, taskStatuses, "open");
}

export function normalizeStaffTaskPriority(value: unknown): StaffTaskPriority {
  return normalizeEnum(value, taskPriorities, "normal");
}

export function normalizeStaffTaskType(value: unknown): StaffTaskType {
  return normalizeEnum(value, taskTypes, "general");
}

export function isActiveStaffTask(task: Pick<StaffTask, "status">) {
  return task.status === "open" || task.status === "in_progress";
}

export function nextStaffTaskStatus(status: StaffTaskStatus): StaffTaskStatus | null {
  if (status === "open") return "in_progress";
  if (status === "in_progress") return "done";
  return null;
}

export function staffTaskActionLabel(status: StaffTaskStatus) {
  if (status === "open") return "Start";
  if (status === "in_progress") return "Mark done";
  if (status === "done") return "Reopen";
  return "Restore";
}

export function sortStaffTasks(first: StaffTask, second: StaffTask) {
  const statusDelta = statusRank[first.status] - statusRank[second.status];
  if (statusDelta) return statusDelta;

  const priorityDelta = priorityRank[first.priority] - priorityRank[second.priority];
  if (priorityDelta) return priorityDelta;

  const firstDue = first.dueAt ? new Date(first.dueAt).getTime() : Number.POSITIVE_INFINITY;
  const secondDue = second.dueAt ? new Date(second.dueAt).getTime() : Number.POSITIVE_INFINITY;
  if (firstDue !== secondDue) return firstDue - secondDue;

  return new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime();
}

function normalizeEnum<T extends string>(value: unknown, allowedValues: T[], fallback: T): T {
  return allowedValues.includes(value as T) ? (value as T) : fallback;
}
