import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  ListTodo,
  Phone,
  RefreshCw,
  ShoppingBag,
  UserCheck,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { PageBody, PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  isActiveStaffTask,
  nextStaffTaskStatus,
  sortStaffTasks,
  staffTaskActionLabel,
  type StaffTask,
  type StaffTaskPriority,
  type StaffTaskStatus,
  type StaffTaskType,
} from "@/domain/staff-tasks";
import { formatTime } from "@/lib/format";
import {
  fetchStaffTasksFromSupabase,
  isStaffTaskPersistenceConfigured,
  updateStaffTaskStatusInSupabase,
} from "@/lib/supabase-rest";
import { toast } from "sonner";

type TabKey = "active" | "all" | StaffTaskStatus;

const sampleTasks: StaffTask[] = [
  {
    assignedTo: "Manager on duty",
    body: "Kitchen printer did not acknowledge the phone order alert. Confirm the ticket reached the kitchen before prep falls behind.",
    callId: "c_018",
    createdAt: new Date(Date.now() - 11 * 60_000).toISOString(),
    dueAt: new Date(Date.now() + 4 * 60_000).toISOString(),
    id: "task_sample_1",
    orderId: "o_014",
    priority: "urgent",
    status: "open",
    title: "Fix failed kitchen handoff",
    type: "delivery_issue",
  },
  {
    assignedTo: "Host stand",
    body: "Caller requested a 7:30 PM Mother's Day table for six. Confirm availability before texting the guest back.",
    callId: "c_017",
    createdAt: new Date(Date.now() - 26 * 60_000).toISOString(),
    dueAt: new Date(Date.now() + 28 * 60_000).toISOString(),
    id: "task_sample_2",
    priority: "high",
    reservationId: "r_009",
    status: "in_progress",
    title: "Confirm special-day reservation",
    type: "reservation_review",
  },
  {
    assignedTo: "Maria",
    body: "Guest said their pickup was missing two salads and asked for a manager.",
    callId: "c_016",
    createdAt: new Date(Date.now() - 48 * 60_000).toISOString(),
    dueAt: new Date(Date.now() - 18 * 60_000).toISOString(),
    id: "task_sample_3",
    priority: "urgent",
    status: "open",
    title: "Call back complaint guest",
    type: "manager_callback",
  },
  {
    body: "The AI captured a catering question with low confidence. Review the transcript and decide whether staff should call back.",
    callId: "c_015",
    createdAt: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),
    id: "task_sample_4",
    priority: "normal",
    status: "open",
    title: "Review low-confidence catering call",
    type: "low_confidence_review",
  },
  {
    assignedTo: "Counter",
    body: "Pickup guest called to move pickup from 6:15 to 6:45.",
    callId: "c_014",
    completedAt: new Date(Date.now() - 22 * 60_000).toISOString(),
    createdAt: new Date(Date.now() - 74 * 60_000).toISOString(),
    id: "task_sample_5",
    orderId: "o_013",
    priority: "normal",
    status: "done",
    title: "Update pickup ETA",
    type: "order_follow_up",
  },
];
const emptyTasks: StaffTask[] = [];

const tabLabels: Record<TabKey, string> = {
  active: "Active",
  all: "All",
  dismissed: "Dismissed",
  done: "Done",
  in_progress: "In progress",
  open: "Open",
};
const tabs: TabKey[] = ["active", "open", "in_progress", "done", "dismissed", "all"];

const taskTypeLabels: Record<StaffTaskType, string> = {
  delivery_issue: "Delivery issue",
  general: "General",
  low_confidence_review: "Low confidence",
  manager_callback: "Manager callback",
  order_follow_up: "Order follow-up",
  reservation_review: "Reservation review",
};

function priorityBadgeClass(priority: StaffTaskPriority) {
  if (priority === "urgent") return "border-destructive/20 bg-destructive/10 text-destructive";
  if (priority === "high") return "border-warning/30 bg-warning/10 text-warning";
  if (priority === "low") return "bg-muted text-muted-foreground";
  return "border-info/20 bg-info/10 text-info";
}

function statusBadgeClass(status: StaffTaskStatus) {
  if (status === "open") return "border-info/20 bg-info/10 text-info";
  if (status === "in_progress") return "border-warning/30 bg-warning/10 text-warning";
  if (status === "done") return "border-success/20 bg-success/10 text-success";
  return "bg-muted text-muted-foreground";
}

function typeAccent(type: StaffTaskType) {
  if (type === "delivery_issue") return "border-l-destructive";
  if (type === "manager_callback") return "border-l-warning";
  if (type === "reservation_review") return "border-l-success";
  if (type === "order_follow_up") return "border-l-primary";
  if (type === "low_confidence_review") return "border-l-info";
  return "border-l-muted-foreground/40";
}

function taskDueState(task: StaffTask) {
  if (!task.dueAt || !isActiveStaffTask(task)) return "none";

  const minutesUntilDue = Math.round((new Date(task.dueAt).getTime() - Date.now()) / 60000);
  if (minutesUntilDue < 0) return "overdue";
  if (minutesUntilDue <= 30) return "soon";
  return "later";
}

function dueLabel(task: StaffTask) {
  if (!task.dueAt) return "No due time";

  const minutesUntilDue = Math.round((new Date(task.dueAt).getTime() - Date.now()) / 60000);
  if (minutesUntilDue < 0) return `${Math.abs(minutesUntilDue)}m overdue`;
  if (minutesUntilDue === 0) return "Due now";
  if (minutesUntilDue < 60) return `Due in ${minutesUntilDue}m`;

  const hours = Math.round(minutesUntilDue / 60);
  return `Due in ${hours}h`;
}

function updateTaskLocally(task: StaffTask, status: StaffTaskStatus): StaffTask {
  const completedAt = status === "done" || status === "dismissed" ? new Date().toISOString() : undefined;

  return {
    ...task,
    completedAt,
    status,
  };
}

export default function Tasks() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabKey>("active");
  const [sampleStaffTasks, setSampleStaffTasks] = useState<StaffTask[]>(sampleTasks);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const persistenceConfigured = isStaffTaskPersistenceConfigured();
  const taskQuery = useQuery({
    enabled: persistenceConfigured,
    queryFn: fetchStaffTasksFromSupabase,
    queryKey: ["staff-tasks", "supabase"],
    refetchInterval: 15_000,
  });
  const usingSupabase = Boolean(persistenceConfigured && taskQuery.isSuccess);
  const tasks = usingSupabase ? (taskQuery.data ?? emptyTasks) : sampleStaffTasks;
  const sortedTasks = useMemo(() => [...tasks].sort(sortStaffTasks), [tasks]);
  const filteredTasks = sortedTasks.filter((task) => {
    if (tab === "active") return isActiveStaffTask(task);
    if (tab === "all") return true;
    return task.status === tab;
  });
  const counts = useMemo(
    () => ({
      active: tasks.filter(isActiveStaffTask).length,
      all: tasks.length,
      dismissed: tasks.filter((task) => task.status === "dismissed").length,
      done: tasks.filter((task) => task.status === "done").length,
      in_progress: tasks.filter((task) => task.status === "in_progress").length,
      open: tasks.filter((task) => task.status === "open").length,
    }),
    [tasks],
  );
  const activeTasks = tasks.filter(isActiveStaffTask);
  const urgentTasks = activeTasks.filter((task) => task.priority === "urgent" || task.priority === "high").length;
  const overdueTasks = activeTasks.filter((task) => taskDueState(task) === "overdue").length;
  const doneToday = tasks.filter((task) => {
    if (!task.completedAt) return false;
    return new Date(task.completedAt).toDateString() === new Date().toDateString();
  }).length;

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: StaffTaskStatus }) => updateStaffTaskStatusInSupabase(id, status),
  });

  const setTaskStatus = async (task: StaffTask, status: StaffTaskStatus) => {
    if (!usingSupabase) {
      setSampleStaffTasks((current) => current.map((item) => item.id === task.id ? updateTaskLocally(item, status) : item));
      toast.success(`${task.title} moved to ${status.replace(/_/g, " ")}`);
      return;
    }

    setBusyTaskId(task.id);
    try {
      await statusMutation.mutateAsync({ id: task.id, status });
      await queryClient.invalidateQueries({ queryKey: ["staff-tasks", "supabase"] });
      toast.success(`${task.title} moved to ${status.replace(/_/g, " ")}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Staff task update failed");
    } finally {
      setBusyTaskId(null);
    }
  };

  const advanceTask = (task: StaffTask) => {
    void setTaskStatus(task, nextStaffTaskStatus(task.status) ?? "open");
  };

  return (
    <>
      <PageHeader
        title="Tasks"
        description={`${counts.active} active staff follow-ups / ${urgentTasks} high priority`}
        actions={
          <>
            <Badge variant="outline" className={usingSupabase ? "border-success/20 bg-success/10 text-success" : "bg-muted text-muted-foreground"}>
              {usingSupabase ? "Live Supabase" : "Sample data"}
            </Badge>
            {overdueTasks > 0 && (
              <Badge variant="outline" className="border-destructive/20 bg-destructive/10 text-destructive">
                {overdueTasks} overdue
              </Badge>
            )}
            {persistenceConfigured && (
              <Button size="sm" variant="outline" onClick={() => taskQuery.refetch()} disabled={taskQuery.isFetching}>
                <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${taskQuery.isFetching ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            )}
          </>
        }
      />
      <PageBody className="space-y-4">
        {taskQuery.isError && (
          <Card className="border-warning/30 bg-warning/10 p-3 text-sm text-muted-foreground">
            Supabase staff tasks could not be loaded, so this page is showing sample data. {taskQuery.error instanceof Error ? taskQuery.error.message : ""}
          </Card>
        )}
        {!persistenceConfigured && (
          <Card className="border-dashed bg-muted/20 p-3 text-sm text-muted-foreground">
            Set VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, and VITE_SUPABASE_DEMO_LOCATION_ID to show live staff follow-ups.
          </Card>
        )}

        <div className="grid gap-3 md:grid-cols-4">
          <MetricCard icon={ListTodo} label="Active" value={counts.active.toString()} />
          <MetricCard icon={AlertTriangle} label="High priority" value={urgentTasks.toString()} />
          <MetricCard icon={Clock} label="Overdue" value={overdueTasks.toString()} />
          <MetricCard icon={CheckCircle2} label="Done today" value={doneToday.toString()} />
        </div>

        <Tabs value={tab} onValueChange={(value) => setTab(value as TabKey)}>
          <TabsList>
            {tabs.map((key) => (
              <TabsTrigger key={key} value={key}>
                {tabLabels[key]}
                <span className="ml-1.5 text-muted-foreground tabular-nums">{counts[key]}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-3">
            {filteredTasks.length === 0 && (
              <Card className="border-dashed p-10 text-center">
                <ListTodo className="mx-auto h-9 w-9 text-muted-foreground/50" />
                <p className="mt-3 text-sm font-medium">No tasks in this view</p>
                <p className="text-xs text-muted-foreground">Staff follow-ups from calls, orders, reservations, and alert failures will land here.</p>
              </Card>
            )}
            {filteredTasks.map((task) => (
              <TaskCard
                busy={busyTaskId === task.id}
                key={task.id}
                onAdvance={advanceTask}
                onDismiss={(item) => void setTaskStatus(item, "dismissed")}
                task={task}
              />
            ))}
          </div>

          <Card className="h-fit p-4">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                <UserCheck className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-semibold">Service desk view</div>
                <div className="text-xs text-muted-foreground">What staff should handle next</div>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {sortedTasks.filter(isActiveStaffTask).slice(0, 4).map((task) => (
                <div key={task.id} className="rounded-md border border-border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{task.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{taskTypeLabels[task.type]}</div>
                    </div>
                    <Badge variant="outline" className={`text-[10px] ${priorityBadgeClass(task.priority)}`}>
                      {task.priority}
                    </Badge>
                  </div>
                  <div className={`mt-2 text-xs ${taskDueState(task) === "overdue" ? "text-destructive" : "text-muted-foreground"}`}>
                    {dueLabel(task)}
                  </div>
                </div>
              ))}
              {activeTasks.length === 0 && (
                <div className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                  Nothing needs staff attention right now.
                </div>
              )}
            </div>
          </Card>
        </div>
      </PageBody>
    </>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <Card className="flex items-center gap-3 p-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-lg font-semibold tabular-nums">{value}</div>
      </div>
    </Card>
  );
}

function TaskCard({
  busy,
  onAdvance,
  onDismiss,
  task,
}: {
  busy: boolean;
  onAdvance: (task: StaffTask) => void;
  onDismiss: (task: StaffTask) => void;
  task: StaffTask;
}) {
  const dueState = taskDueState(task);
  const primaryIcon = task.status === "in_progress" ? Check : task.status === "open" ? UserCheck : RefreshCw;

  return (
    <Card className={`border-l-2 ${typeAccent(task.type)} p-4`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={statusBadgeClass(task.status)}>
              {task.status.replace(/_/g, " ")}
            </Badge>
            <Badge variant="outline" className={priorityBadgeClass(task.priority)}>
              {task.priority}
            </Badge>
            <Badge variant="secondary">{taskTypeLabels[task.type]}</Badge>
          </div>
          <h3 className="mt-3 text-base font-semibold">{task.title}</h3>
          {task.body && <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{task.body}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {task.status !== "done" && (
            <Button size="sm" onClick={() => onAdvance(task)} disabled={busy}>
              <PrimaryActionIcon icon={primaryIcon} />
              {busy ? "Updating..." : staffTaskActionLabel(task.status)}
            </Button>
          )}
          {isActiveStaffTask(task) && (
            <Button size="sm" variant="outline" onClick={() => onDismiss(task)} disabled={busy}>
              <XCircle className="mr-1.5 h-3.5 w-3.5" />
              Dismiss
            </Button>
          )}
          {task.status === "done" && (
            <Button size="sm" variant="outline" onClick={() => onAdvance(task)} disabled={busy}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Reopen
            </Button>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          Created {formatTime(task.createdAt)}
        </span>
        <Badge
          variant="outline"
          className={
            dueState === "overdue"
              ? "border-destructive/20 bg-destructive/10 text-destructive"
              : dueState === "soon"
                ? "border-warning/30 bg-warning/10 text-warning"
                : "bg-muted text-muted-foreground"
          }
        >
          {dueLabel(task)}
        </Badge>
        {task.assignedTo && (
          <Badge variant="outline" className="bg-muted text-muted-foreground">
            {task.assignedTo}
          </Badge>
        )}
        <RelatedLink icon={Phone} label={task.callId} to="/app/calls" />
        <RelatedLink icon={ShoppingBag} label={task.orderId} to="/app/orders" />
        <RelatedLink icon={CalendarDays} label={task.reservationId} to="/app/reservations" />
      </div>
    </Card>
  );
}

function PrimaryActionIcon({ icon: Icon }: { icon: LucideIcon }) {
  return <Icon className="mr-1.5 h-3.5 w-3.5" />;
}

function RelatedLink({
  icon: Icon,
  label,
  to,
}: {
  icon: LucideIcon;
  label?: string;
  to: string;
}) {
  if (!label) return null;

  return (
    <Link
      className="inline-flex h-6 items-center gap-1 rounded-full border border-border bg-background px-2 text-[11px] text-muted-foreground hover:text-foreground"
      to={to}
    >
      <Icon className="h-3 w-3" />
      {label}
    </Link>
  );
}
