import { describe, expect, it } from "vitest";
import {
  isActiveStaffTask,
  nextStaffTaskStatus,
  normalizeStaffTaskPriority,
  normalizeStaffTaskStatus,
  normalizeStaffTaskType,
  sortStaffTasks,
  type StaffTask,
} from "./staff-tasks";

const baseTask: StaffTask = {
  createdAt: "2026-05-06T16:00:00.000Z",
  id: "task_1",
  priority: "normal",
  status: "open",
  title: "Call guest back",
  type: "manager_callback",
};

describe("staff tasks", () => {
  it("normalizes persisted task fields", () => {
    expect(normalizeStaffTaskStatus("in_progress")).toBe("in_progress");
    expect(normalizeStaffTaskStatus("stuck")).toBe("open");
    expect(normalizeStaffTaskPriority("urgent")).toBe("urgent");
    expect(normalizeStaffTaskPriority("medium")).toBe("normal");
    expect(normalizeStaffTaskType("customer_request")).toBe("customer_request");
    expect(normalizeStaffTaskType("reservation_review")).toBe("reservation_review");
    expect(normalizeStaffTaskType("mystery")).toBe("general");
  });

  it("knows which tasks still need staff attention", () => {
    expect(isActiveStaffTask({ status: "open" })).toBe(true);
    expect(isActiveStaffTask({ status: "in_progress" })).toBe(true);
    expect(isActiveStaffTask({ status: "done" })).toBe(false);
  });

  it("advances open tasks through the staff workflow", () => {
    expect(nextStaffTaskStatus("open")).toBe("in_progress");
    expect(nextStaffTaskStatus("in_progress")).toBe("done");
    expect(nextStaffTaskStatus("done")).toBeNull();
  });

  it("sorts active urgent and due-soon work first", () => {
    const sorted = [
      { ...baseTask, id: "done", priority: "urgent" as const, status: "done" as const },
      { ...baseTask, dueAt: "2026-05-06T16:45:00.000Z", id: "normal_due", priority: "normal" as const },
      { ...baseTask, dueAt: "2026-05-06T17:00:00.000Z", id: "urgent", priority: "urgent" as const },
      { ...baseTask, id: "in_progress", priority: "high" as const, status: "in_progress" as const },
    ].sort(sortStaffTasks);

    expect(sorted.map((task) => task.id)).toEqual(["in_progress", "urgent", "normal_due", "done"]);
  });
});
