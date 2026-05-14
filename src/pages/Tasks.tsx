import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  Clipboard,
  Clock,
  Filter,
  ListTodo,
  MessageCircle,
  Phone,
  RefreshCw,
  Search,
  Sparkles,
  ShoppingBag,
  UserCheck,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { PageBody, PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { buildCustomerRequestResolutionDraft } from "@/domain/customer-requests";
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
  isSupabaseConfigured,
  resolveCustomerRequestInSupabase,
  updateStaffTaskStatusInSupabase,
} from "@/lib/supabase-rest";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type TabKey = "active" | "all" | StaffTaskStatus;
type TypeFilter = "all" | StaffTaskType;
type PriorityFilter = "all" | StaffTaskPriority;

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
    body: "Website visitor asked for a catering quote and left a phone number. Call back with package options and minimums.",
    callId: "c_015",
    createdAt: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),
    dueAt: new Date(Date.now() + 52 * 60_000).toISOString(),
    id: "task_sample_4",
    priority: "high",
    status: "open",
    title: "Follow up on catering lead",
    type: "customer_request",
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
const taskTypeOptions: TypeFilter[] = [
  "all",
  "customer_request",
  "manager_callback",
  "reservation_review",
  "order_follow_up",
  "delivery_issue",
  "low_confidence_review",
  "general",
];

const taskTypeLabels: Record<StaffTaskType, string> = {
  customer_request: "Customer request",
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
  if (type === "customer_request") return "border-l-primary";
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
  const routeLocation = useLocation();
  const superConsole = routeLocation.pathname.startsWith("/super");
  const [tab, setTab] = useState<TabKey>("active");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [sampleStaffTasks, setSampleStaffTasks] = useState<StaffTask[]>(sampleTasks);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const persistenceConfigured = superConsole ? isSupabaseConfigured() : isStaffTaskPersistenceConfigured();
  const taskQuery = useQuery({
    enabled: persistenceConfigured,
    queryFn: () => fetchStaffTasksFromSupabase(superConsole ? null : undefined),
    queryKey: ["staff-tasks", "supabase", superConsole ? "all-tenants" : "active-location"],
    refetchInterval: 15_000,
  });
  const usingSupabase = Boolean(persistenceConfigured && taskQuery.isSuccess);
  const tasks = usingSupabase ? (taskQuery.data ?? emptyTasks) : superConsole ? emptyTasks : sampleStaffTasks;
  const sortedTasks = useMemo(() => [...tasks].sort(sortStaffTasks), [tasks]);
  const filteredTasks = useMemo(
    () => sortedTasks.filter((task) => {
      if (tab === "active" && !isActiveStaffTask(task)) return false;
      if (tab !== "active" && tab !== "all" && task.status !== tab) return false;
      if (typeFilter !== "all" && task.type !== typeFilter) return false;
      if (priorityFilter !== "all" && task.priority !== priorityFilter) return false;
      if (search.trim() && !taskMatchesSearch(task, search)) return false;
      return true;
    }),
    [priorityFilter, search, sortedTasks, tab, typeFilter],
  );
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
  const activeTasks = useMemo(() => sortedTasks.filter(isActiveStaffTask), [sortedTasks]);
  const urgentTasks = activeTasks.filter((task) => task.priority === "urgent" || task.priority === "high").length;
  const overdueTasks = activeTasks.filter((task) => taskDueState(task) === "overdue").length;
  const customerRequests = activeTasks.filter((task) => task.type === "customer_request").length;
  const doneToday = tasks.filter((task) => {
    if (!task.completedAt) return false;
    return new Date(task.completedAt).toDateString() === new Date().toDateString();
  }).length;
  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? filteredTasks[0] ?? null;
  const nextTask = activeTasks[0] ?? null;
  const sourceLabel = usingSupabase
    ? superConsole ? "Live all tenants" : "Live Supabase"
    : superConsole ? "Live data unavailable" : "Sample data";
  const consoleBase = superConsole ? "/super" : "/app";

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: StaffTaskStatus }) => updateStaffTaskStatusInSupabase(id, status),
  });
  const resolutionMutation = useMutation({
    mutationFn: ({ answer, task }: { answer: string; task: StaffTask }) => resolveCustomerRequestInSupabase({
      answer,
      callId: task.callId,
      customerContext: task.body,
      requestId: extractCustomerRequestId(task),
      responseChannel: "manual",
      sourceQuestion: sourceQuestionForTask(task),
      taskId: task.id,
      title: task.title,
    }),
  });

  const setTaskStatus = async (task: StaffTask, status: StaffTaskStatus) => {
    if (!usingSupabase && !superConsole) {
      setSampleStaffTasks((current) => current.map((item) => item.id === task.id ? updateTaskLocally(item, status) : item));
      toast.success(`${task.title} moved to ${status.replace(/_/g, " ")}`);
      return;
    }

    setBusyTaskId(task.id);
    try {
      await statusMutation.mutateAsync({ id: task.id, status });
      await queryClient.invalidateQueries({ queryKey: ["staff-tasks", "supabase"] });
      await queryClient.invalidateQueries({ queryKey: ["tenant-detail", "tasks"] });
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

  const dismissTask = (task: StaffTask) => {
    void setTaskStatus(task, "dismissed");
  };

  const resolveCustomerRequest = async (task: StaffTask, answer: string) => {
    if (!usingSupabase && !superConsole) {
      setSampleStaffTasks((current) => current.map((item) => item.id === task.id ? updateTaskLocally(item, "done") : item));
      toast.success("Answer saved in sample mode");
      return;
    }

    setBusyTaskId(task.id);
    try {
      await resolutionMutation.mutateAsync({ answer, task });
      await queryClient.invalidateQueries({ queryKey: ["staff-tasks", "supabase"] });
      await queryClient.invalidateQueries({ queryKey: ["knowledge-suggestions"] });
      await queryClient.invalidateQueries({ queryKey: ["knowledge-sections"] });
      await queryClient.invalidateQueries({ queryKey: ["tenant-detail", "tasks"] });
      toast.success("Answer saved, task closed, and knowledge updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Customer answer could not be saved");
    } finally {
      setBusyTaskId(null);
    }
  };

  const resetFilters = () => {
    setSearch("");
    setTypeFilter("all");
    setPriorityFilter("all");
    setTab("active");
  };

  async function copyTask(task: StaffTask) {
    const text = [
      `Task: ${task.title}`,
      `Status: ${task.status}`,
      `Priority: ${task.priority}`,
      `Type: ${taskTypeLabels[task.type]}`,
      task.assignedTo && `Assigned to: ${task.assignedTo}`,
      task.dueAt && `Due: ${dueLabel(task)}`,
      task.locationId && `Location ID: ${task.locationId}`,
      task.callId && `Call ID: ${task.callId}`,
      task.orderId && `Order ID: ${task.orderId}`,
      task.reservationId && `Reservation ID: ${task.reservationId}`,
      task.body && "",
      task.body,
    ].filter(Boolean).join("\n");

    try {
      await navigator.clipboard.writeText(text);
      toast.success("Action copied");
    } catch {
      toast.error("Could not copy action");
    }
  }

  return (
    <>
      <PageHeader
        title="Action Center"
        description={
          superConsole
            ? `${counts.active} open items across tenants / ${urgentTasks} high priority`
            : `${counts.active} active customer follow-ups / ${urgentTasks} high priority`
        }
        actions={
          <>
            <Badge
              variant="outline"
              className={
                usingSupabase
                  ? "border-success/20 bg-success/10 text-success"
                  : superConsole
                    ? "border-warning/30 bg-warning/10 text-warning"
                    : "bg-muted text-muted-foreground"
              }
            >
              {sourceLabel}
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
            Staff actions could not be loaded. {taskQuery.error instanceof Error ? taskQuery.error.message : ""}
          </Card>
        )}
        {!persistenceConfigured && (
          <Card className="border-dashed bg-muted/20 p-3 text-sm text-muted-foreground">
            {superConsole
              ? "Set Supabase frontend env vars and sign in as a platform admin to see live actions across tenants."
              : "Set VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, and VITE_SUPABASE_DEMO_LOCATION_ID to show live staff follow-ups."}
          </Card>
        )}

        {nextTask && (
          <Card className="border-primary/20 bg-primary/5 p-4">
            <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={priorityBadgeClass(nextTask.priority)}>
                    Next up
                  </Badge>
                  <span className="text-xs text-muted-foreground">{dueLabel(nextTask)}</span>
                </div>
                <div className="mt-2 text-base font-semibold">{nextTask.title}</div>
                {nextTask.body && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{nextTask.body}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => advanceTask(nextTask)} disabled={busyTaskId === nextTask.id}>
                  <ArrowRight className="mr-1.5 h-3.5 w-3.5" />
                  {staffTaskActionLabel(nextTask.status)}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setSelectedTaskId(nextTask.id)}>
                  Details
                </Button>
              </div>
            </div>
          </Card>
        )}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard icon={ListTodo} label="Active" value={counts.active.toString()} />
          <MetricCard icon={AlertTriangle} label="High priority" value={urgentTasks.toString()} />
          <MetricCard icon={Clock} label="Overdue" value={overdueTasks.toString()} />
          <MetricCard icon={MessageCircle} label="Customer requests" value={customerRequests.toString()} />
          <MetricCard icon={CheckCircle2} label="Done today" value={doneToday.toString()} />
        </div>

        <Card className="p-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <div className="relative min-w-[220px] flex-1 xl:max-w-sm">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-9 pl-8"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search action, caller, record ID..."
                  value={search}
                />
              </div>
              <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as TypeFilter)}>
                <SelectTrigger className="h-9 w-[180px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  {taskTypeOptions.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type === "all" ? "All types" : taskTypeLabels[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={(value) => setPriorityFilter(value as PriorityFilter)}>
                <SelectTrigger className="h-9 w-36">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All priorities</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" className="h-9" onClick={resetFilters}>
                <Filter className="mr-1.5 h-3.5 w-3.5" />
                Reset
              </Button>
            </div>
            <Tabs value={tab} onValueChange={(value) => setTab(value as TabKey)}>
              <TabsList className="h-auto flex-wrap justify-start">
                {tabs.map((key) => (
                  <TabsTrigger key={key} value={key}>
                    {tabLabels[key]}
                    <span className="ml-1.5 text-muted-foreground tabular-nums">{counts[key]}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </Card>

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="space-y-3">
            {filteredTasks.length === 0 && (
              <Card className="border-dashed p-10 text-center">
                <ListTodo className="mx-auto h-9 w-9 text-muted-foreground/50" />
                <p className="mt-3 text-sm font-medium">No actions in this view</p>
                <p className="text-xs text-muted-foreground">Phone calls, chats, reservations, orders, and alert failures that need a human will land here.</p>
              </Card>
            )}
            {filteredTasks.map((task) => (
              <TaskCard
                busy={busyTaskId === task.id}
                consoleBase={consoleBase}
                key={task.id}
                onAdvance={advanceTask}
                onCopy={(item) => void copyTask(item)}
                onDismiss={dismissTask}
                onSelect={(item) => setSelectedTaskId(item.id)}
                selected={selectedTask?.id === task.id}
                superConsole={superConsole}
                task={task}
              />
            ))}
          </div>

          <div className="space-y-3">
            <ActionDetail
              busy={Boolean(selectedTask && busyTaskId === selectedTask.id)}
              canResolveCustomerRequest={usingSupabase || (!superConsole && !persistenceConfigured)}
              consoleBase={consoleBase}
              onAdvance={advanceTask}
              onCopy={(item) => void copyTask(item)}
              onDismiss={dismissTask}
              onResolveCustomerRequest={(task, answer) => void resolveCustomerRequest(task, answer)}
              superConsole={superConsole}
              task={selectedTask}
            />
            <QueueStack tasks={activeTasks.slice(0, 5)} onSelect={(task) => setSelectedTaskId(task.id)} selectedTaskId={selectedTask?.id} />
          </div>
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
  consoleBase,
  onAdvance,
  onCopy,
  onDismiss,
  onSelect,
  selected,
  superConsole,
  task,
}: {
  busy: boolean;
  consoleBase: string;
  onAdvance: (task: StaffTask) => void;
  onCopy: (task: StaffTask) => void;
  onDismiss: (task: StaffTask) => void;
  onSelect: (task: StaffTask) => void;
  selected: boolean;
  superConsole: boolean;
  task: StaffTask;
}) {
  const dueState = taskDueState(task);
  const primaryIcon = task.status === "in_progress" ? Check : task.status === "open" ? UserCheck : RefreshCw;

  return (
    <Card
      className={cn(
        "cursor-pointer border-l-2 p-4 transition-colors",
        typeAccent(task.type),
        selected && "border-primary/30 bg-primary/5 ring-2 ring-primary/20",
      )}
      onClick={() => onSelect(task)}
    >
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
            {superConsole && task.locationId && (
              <Badge variant="outline" className="bg-muted text-muted-foreground">
                Tenant
              </Badge>
            )}
          </div>
          <h3 className="mt-3 text-base font-semibold">{task.title}</h3>
          {task.body && <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{task.body}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
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
          <Button size="sm" variant="outline" onClick={() => onCopy(task)}>
            <Clipboard className="mr-1.5 h-3.5 w-3.5" />
            Copy
          </Button>
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
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <MessageCircle className="h-3.5 w-3.5" />
          {sourceLabelForTask(task)}
        </span>
        <RelatedLinks consoleBase={consoleBase} superConsole={superConsole} task={task} />
      </div>
    </Card>
  );
}

function ActionDetail({
  busy,
  canResolveCustomerRequest,
  consoleBase,
  onAdvance,
  onCopy,
  onDismiss,
  onResolveCustomerRequest,
  superConsole,
  task,
}: {
  busy: boolean;
  canResolveCustomerRequest: boolean;
  consoleBase: string;
  onAdvance: (task: StaffTask) => void;
  onCopy: (task: StaffTask) => void;
  onDismiss: (task: StaffTask) => void;
  onResolveCustomerRequest: (task: StaffTask, answer: string) => void;
  superConsole: boolean;
  task: StaffTask | null;
}) {
  if (!task) {
    return (
      <Card className="p-4">
        <div className="flex h-48 flex-col items-center justify-center text-center">
          <ListTodo className="h-8 w-8 text-muted-foreground/50" />
          <div className="mt-3 text-sm font-medium">No action selected</div>
          <p className="mt-1 text-xs text-muted-foreground">Pick an item to see the staff workflow.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={priorityBadgeClass(task.priority)}>{task.priority}</Badge>
            <Badge variant="outline" className={statusBadgeClass(task.status)}>{task.status.replace(/_/g, " ")}</Badge>
          </div>
          <h2 className="mt-3 text-base font-semibold">{task.title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{taskTypeLabels[task.type]}</p>
        </div>
        <Button size="icon" variant="outline" onClick={() => onCopy(task)} title="Copy action">
          <Clipboard className="h-4 w-4" />
        </Button>
      </div>

      <Separator className="my-4" />

      <div className="space-y-4">
        <DetailSection label="Recommended next step" value={recommendedAction(task)} />
        {task.body && <DetailSection label="Context the AI host captured" value={task.body} />}
        {(task.type === "customer_request" || task.type === "low_confidence_review") && (
          <CustomerAnswerPanel
            busy={busy}
            canResolve={canResolveCustomerRequest}
            key={task.id}
            onResolve={(answer) => onResolveCustomerRequest(task, answer)}
            task={task}
          />
        )}
        <div className="grid gap-2 text-sm">
          <DetailRow label="Assigned to" value={task.assignedTo || "Unassigned"} />
          <DetailRow label="Due" value={dueLabel(task)} />
          <DetailRow label="Created" value={formatTime(task.createdAt)} />
          {task.completedAt && <DetailRow label="Closed" value={formatTime(task.completedAt)} />}
          {superConsole && task.locationId && <DetailRow label="Location ID" value={task.locationId} mono />}
        </div>
        <div>
          <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">Linked records</div>
          <div className="flex flex-wrap gap-2">
            <RelatedLinks consoleBase={consoleBase} superConsole={superConsole} task={task} />
            {!task.callId && !task.orderId && !task.reservationId && !task.locationId && (
              <span className="text-xs text-muted-foreground">No linked record yet.</span>
            )}
          </div>
        </div>
      </div>

      <Separator className="my-4" />

      <div className="flex flex-wrap gap-2">
        {task.status !== "done" && (
          <Button size="sm" onClick={() => onAdvance(task)} disabled={busy}>
            <ArrowRight className="mr-1.5 h-3.5 w-3.5" />
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
    </Card>
  );
}

function CustomerAnswerPanel({
  busy,
  canResolve,
  onResolve,
  task,
}: {
  busy: boolean;
  canResolve: boolean;
  onResolve: (answer: string) => void;
  task: StaffTask;
}) {
  const [answer, setAnswer] = useState("");
  const draft = answer.trim()
    ? buildCustomerRequestResolutionDraft({
        answer,
        callId: task.callId,
        customerContext: task.body,
        sourceQuestion: sourceQuestionForTask(task),
        title: task.title,
      })
    : null;
  const requestId = extractCustomerRequestId(task);
  const canSubmit = canResolve && Boolean(answer.trim()) && !busy;

  return (
    <div className="rounded-md border border-primary/20 bg-primary/5 p-3">
      <div className="flex items-start gap-2">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Sparkles className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">Answer customer and teach SignalHost</div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Use this when staff knows the right answer. It closes the action, drafts the customer response, and adds an approved knowledge entry for future calls.
          </p>
        </div>
      </div>
      <Textarea
        className="mt-3 min-h-24 bg-background"
        onChange={(event) => setAnswer(event.target.value)}
        placeholder="Example: The bathroom is white."
        value={answer}
      />
      {draft && (
        <div className="mt-3 space-y-2 rounded-md border border-border bg-background p-3 text-xs">
          <div>
            <div className="font-medium uppercase text-muted-foreground">Customer reply draft</div>
            <p className="mt-1 leading-relaxed">{draft.customerMessage}</p>
          </div>
          <div>
            <div className="font-medium uppercase text-muted-foreground">Saved knowledge</div>
            <p className="mt-1 leading-relaxed">{draft.knowledgeTitle}</p>
          </div>
        </div>
      )}
      {!requestId && (
        <p className="mt-2 text-xs text-muted-foreground">
          Older actions may not have a customer request ID yet. The knowledge update will still be saved.
        </p>
      )}
      <Button className="mt-3 w-full" disabled={!canSubmit} onClick={() => onResolve(answer)} size="sm">
        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
        {busy ? "Saving..." : "Save answer and teach SignalHost"}
      </Button>
    </div>
  );
}

function QueueStack({
  onSelect,
  selectedTaskId,
  tasks,
}: {
  onSelect: (task: StaffTask) => void;
  selectedTaskId?: string;
  tasks: StaffTask[];
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
          <UserCheck className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-semibold">Work queue</div>
          <div className="text-xs text-muted-foreground">Highest priority active items</div>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {tasks.map((task, index) => (
          <button
            className={cn(
              "w-full rounded-md border border-border p-3 text-left transition-colors hover:bg-muted/40",
              selectedTaskId === task.id && "border-primary/30 bg-primary/5",
            )}
            key={task.id}
            onClick={() => onSelect(task)}
            type="button"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[11px] font-medium text-muted-foreground">#{index + 1} / {dueLabel(task)}</div>
                <div className="mt-1 line-clamp-2 text-sm font-medium">{task.title}</div>
              </div>
              <Badge variant="outline" className={`text-[10px] ${priorityBadgeClass(task.priority)}`}>
                {task.priority}
              </Badge>
            </div>
          </button>
        ))}
        {tasks.length === 0 && (
          <div className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            Nothing needs staff attention right now.
          </div>
        )}
      </div>
    </Card>
  );
}

function PrimaryActionIcon({ icon: Icon }: { icon: LucideIcon }) {
  return <Icon className="mr-1.5 h-3.5 w-3.5" />;
}

function RelatedLinks({
  consoleBase,
  superConsole,
  task,
}: {
  consoleBase: string;
  superConsole: boolean;
  task: StaffTask;
}) {
  return (
    <>
      {superConsole && <RelatedLink icon={Building2} label={task.locationId} to={task.locationId ? `/super/tenants/${task.locationId}` : ""} />}
      <RelatedLink icon={Phone} label={task.callId} to={`${consoleBase}/calls`} />
      {!superConsole && <RelatedLink icon={ShoppingBag} label={task.orderId} to="/app/orders" />}
      {!superConsole && <RelatedLink icon={CalendarDays} label={task.reservationId} to="/app/reservations" />}
    </>
  );
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
  if (!label || !to) return null;

  return (
    <Link
      className="inline-flex h-6 items-center gap-1 rounded-full border border-border bg-background px-2 text-[11px] text-muted-foreground hover:text-foreground"
      onClick={(event) => event.stopPropagation()}
      to={to}
    >
      <Icon className="h-3 w-3" />
      {label}
    </Link>
  );
}

function DetailSection({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase text-muted-foreground">{label}</div>
      <p className="mt-1 text-sm leading-relaxed">{value}</p>
    </div>
  );
}

function DetailRow({ label, mono = false, value }: { label: string; mono?: boolean; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-border px-3 py-2">
      <span className="text-xs font-medium uppercase text-muted-foreground">{label}</span>
      <span className={cn("min-w-0 truncate text-right text-sm", mono && "font-mono text-xs")} title={value}>
        {value}
      </span>
    </div>
  );
}

function sourceLabelForTask(task: StaffTask) {
  if (task.type === "customer_request") return "Customer request";
  if (task.callId) return "Call or chat";
  if (task.orderId) return "Order";
  if (task.reservationId) return "Reservation";
  return "Manual action";
}

function recommendedAction(task: StaffTask) {
  if (task.status === "done") return "This item is closed. Reopen it only if staff still needs to take action.";
  if (task.status === "dismissed") return "This item was dismissed. Restore it if the customer still needs a response.";
  if (task.type === "customer_request") return "Answer the customer, save the approved answer for future calls, then close the request.";
  if (task.type === "manager_callback") return "Have the manager or owner call the customer back and record the outcome in your normal staff notes.";
  if (task.type === "reservation_review") return "Confirm availability in the reservation book or platform, then follow up with the guest.";
  if (task.type === "order_follow_up") return "Check the order record, confirm the kitchen or counter update, then close the action.";
  if (task.type === "delivery_issue") return "Resolve the operational handoff first, then verify the guest or kitchen is no longer blocked.";
  if (task.type === "low_confidence_review") return "Open the call transcript, decide the right answer, and add a tuning note if the AI host needs better knowledge.";
  return "Handle the request, then mark done when no customer or staff follow-up remains.";
}

function extractCustomerRequestId(task: StaffTask) {
  const match = task.body?.match(/Customer request ID:\s*([0-9a-f-]{36})/i);
  return match?.[1];
}

function sourceQuestionForTask(task: StaffTask) {
  return extractTaskBodyLine(task.body, "Summary")
    ?? extractTaskBodyLine(task.body, "Question")
    ?? task.body?.split("\n").find((line) => line.trim().length > 12)?.trim()
    ?? task.title;
}

function extractTaskBodyLine(body: string | undefined, label: string) {
  if (!body) return undefined;
  const expression = new RegExp(`^${label}:\\s*(.+)$`, "im");
  return body.match(expression)?.[1]?.trim();
}

function taskMatchesSearch(task: StaffTask, rawSearch: string) {
  const query = rawSearch.trim().toLowerCase();
  if (!query) return true;

  return [
    task.assignedTo,
    task.body,
    task.callId,
    task.id,
    task.locationId,
    task.orderId,
    task.priority,
    task.reservationId,
    task.status,
    task.title,
    task.type,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(query);
}
