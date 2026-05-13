import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Mail,
  MessageCircle,
  Phone,
  Send,
  Sparkles,
  UserRound,
} from "lucide-react";
import { PageBody, PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { calls as sampleCalls, orders as sampleOrders, reservations as sampleReservations } from "@/data/mock";
import type { Call, Order, Reservation } from "@/data/mock";
import {
  buildOwnerAssistantResponse,
  ownerAssistantSuggestions,
  type OwnerAssistantResponse,
} from "@/domain/owner-assistant";
import type { StaffTask } from "@/domain/staff-tasks";
import { isPlatformAdminUser, useCurrentUser } from "@/lib/auth";
import { loadOnboardingDraft } from "@/lib/onboarding-draft";
import {
  fetchCallsFromSupabase,
  fetchOrdersFromSupabase,
  fetchReservationsFromSupabase,
  fetchStaffTasksFromSupabase,
  fetchTenantDirectoryFromSupabase,
  getActiveSupabaseLocationId,
  isSupabaseConfigured,
} from "@/lib/supabase-rest";
import { cn } from "@/lib/utils";

type OwnerChatMessage =
  | {
      id: string;
      role: "owner";
      text: string;
    }
  | {
      id: string;
      response?: OwnerAssistantResponse;
      role: "assistant";
      text: string;
    };

const emptyCalls: Call[] = [];
const emptyOrders: Order[] = [];
const emptyReservations: Reservation[] = [];
const emptyTasks: StaffTask[] = [];

export default function OwnerAssistant() {
  const user = useCurrentUser();
  const platformAdmin = isPlatformAdminUser(user);
  const activeLocationId = getActiveSupabaseLocationId();
  const liveEnabled = Boolean(isSupabaseConfigured() && activeLocationId);
  const draft = loadOnboardingDraft();
  const [question, setQuestion] = useState("");

  const callQuery = useQuery({
    enabled: liveEnabled,
    queryFn: () => fetchCallsFromSupabase(activeLocationId),
    queryKey: ["owner-assistant", "calls", activeLocationId],
    refetchInterval: 30_000,
  });
  const orderQuery = useQuery({
    enabled: liveEnabled,
    queryFn: () => fetchOrdersFromSupabase(activeLocationId),
    queryKey: ["owner-assistant", "orders", activeLocationId],
    refetchInterval: 30_000,
  });
  const reservationQuery = useQuery({
    enabled: liveEnabled,
    queryFn: () => fetchReservationsFromSupabase(activeLocationId),
    queryKey: ["owner-assistant", "reservations", activeLocationId],
    refetchInterval: 30_000,
  });
  const taskQuery = useQuery({
    enabled: liveEnabled,
    queryFn: () => fetchStaffTasksFromSupabase(activeLocationId),
    queryKey: ["owner-assistant", "tasks", activeLocationId],
    refetchInterval: 30_000,
  });
  const tenantQuery = useQuery({
    enabled: liveEnabled,
    queryFn: fetchTenantDirectoryFromSupabase,
    queryKey: ["tenant-directory", "owner-assistant", activeLocationId],
    staleTime: 60_000,
  });

  const activeTenant = tenantQuery.data?.find((tenant) => tenant.locationId === activeLocationId);
  const businessName = activeTenant?.locationName ?? String(draft.restaurantName || "your business");
  const ownerName = String(draft.ownerName || activeTenant?.ownerName || "Owner");
  const ownerPhone = String(draft.ownerPhone || draft.escalationPhone || "");
  const ownerEmail = String(draft.ownerEmail || activeTenant?.ownerEmail || draft.salesManagerEmail || "");
  const calls = useMemo(() => liveEnabled ? callQuery.data ?? emptyCalls : sampleCalls, [callQuery.data, liveEnabled]);
  const orders = useMemo(() => liveEnabled ? orderQuery.data ?? emptyOrders : sampleOrders, [liveEnabled, orderQuery.data]);
  const reservations = useMemo(
    () => liveEnabled ? reservationQuery.data ?? emptyReservations : sampleReservations,
    [liveEnabled, reservationQuery.data],
  );
  const tasks = useMemo(() => liveEnabled ? taskQuery.data ?? emptyTasks : emptyTasks, [liveEnabled, taskQuery.data]);
  const assistantContext = useMemo(
    () => ({ businessName, calls, orders, reservations, tasks }),
    [businessName, calls, orders, reservations, tasks],
  );
  const [messages, setMessages] = useState<OwnerChatMessage[]>([
    {
      id: "assistant-start",
      role: "assistant",
      text: "Ask me what happened today, what needs follow-up, what I did not know, or where the money is.",
    },
  ]);
  const hasLiveError = callQuery.isError || orderQuery.isError || reservationQuery.isError || taskQuery.isError;

  function askOwnerAssistant(nextQuestion: string) {
    const trimmed = nextQuestion.trim();
    if (!trimmed) return;

    const response = buildOwnerAssistantResponse(trimmed, assistantContext);
    setMessages((current) => [
      ...current,
      { id: `owner-${Date.now()}`, role: "owner", text: trimmed },
      {
        id: `assistant-${Date.now()}`,
        response,
        role: "assistant",
        text: response.answer,
      },
    ]);
    setQuestion("");
  }

  return (
    <>
      <PageHeader
        title="Owner Assistant"
        description="Ask SignalHost what happened, what needs attention, what it learned, and where follow-up can recover revenue."
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link to="/app/onboarding">
                Owner contacts
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/app/tasks">
                Action Center
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </>
        }
      />

      <PageBody className="space-y-5">
        {platformAdmin && activeTenant && (
          <Card className="border-warning/30 bg-warning/10 p-4 text-sm">
            <div className="font-medium text-foreground">SignalHost staff view</div>
            <p className="mt-1 text-muted-foreground">You are asking about live data for {activeTenant.locationName}.</p>
          </Card>
        )}
        {hasLiveError && (
          <Card className="border-warning/30 bg-warning/10 p-4 text-sm text-muted-foreground">
            Some live data could not load. The assistant will answer from whatever data is currently available.
          </Card>
        )}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Card className="overflow-hidden">
            <CardHeader className="border-b border-border bg-muted/20 pb-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Ask SignalHost
                  </CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Current workspace: <span className="font-medium text-foreground">{businessName}</span>
                  </p>
                </div>
                <Badge variant="outline" className={liveEnabled ? "border-success/30 bg-success/10 text-success" : "bg-muted text-muted-foreground"}>
                  {liveEnabled ? "Live data" : "Demo data"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[560px] min-h-[420px] space-y-4 overflow-y-auto p-4 md:p-5">
                {messages.map((message) => (
                  <ChatBubble key={message.id} message={message} />
                ))}
              </div>

              <div className="border-t border-border p-4 md:p-5">
                <div className="mb-3 flex flex-wrap gap-2">
                  {ownerAssistantSuggestions.slice(0, 5).map((item) => (
                    <Button key={item} type="button" size="sm" variant="outline" onClick={() => askOwnerAssistant(item)}>
                      {item}
                    </Button>
                  ))}
                </div>
                <form
                  className="flex gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    askOwnerAssistant(question);
                  }}
                >
                  <Input
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                    placeholder="Ask about urgent calls, leads, follow-ups, complaints..."
                  />
                  <Button type="submit">
                    <Send className="mr-1.5 h-3.5 w-3.5" />
                    Ask
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <UserRound className="h-4 w-4 text-primary" />
                  Trusted owner identity
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <IdentityLine icon={UserRound} label="Owner or manager" value={ownerName} />
                <IdentityLine icon={Phone} label="Trusted phone" value={ownerPhone || "Not set"} warning={!ownerPhone} />
                <IdentityLine icon={Mail} label="Trusted email" value={ownerEmail || "Not set"} warning={!ownerEmail} />
                <Separator />
                <p className="text-xs leading-5 text-muted-foreground">
                  These fields identify who can receive owner reports, escalation alerts, and future text commands like "what happened today?".
                </p>
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link to="/app/onboarding">Edit in onboarding</Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ClipboardList className="h-4 w-4 text-primary" />
                  What I can answer now
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Capability icon={CheckCircle2} label="Daily summaries" />
                <Capability icon={AlertTriangle} label="Urgent calls and complaints" />
                <Capability icon={ClipboardList} label="Open staff follow-ups" />
                <Capability icon={Phone} label="Call and chat volume" />
                <Capability icon={BookOpen} label="Knowledge gaps and suggestions" />
                <Capability icon={MessageCircle} label="Revenue opportunities" />
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4">
                <div className="text-sm font-medium">Next evolution</div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  After dashboard chat, the same assistant can work over verified owner SMS and create temporary updates when the owner says things like "we are closed tomorrow."
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </PageBody>
    </>
  );
}

function ChatBubble({ message }: { message: OwnerChatMessage }) {
  const isOwner = message.role === "owner";

  return (
    <div className={cn("flex", isOwner ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[820px] rounded-md border p-4", isOwner ? "border-primary/25 bg-primary text-primary-foreground" : "border-border bg-card")}>
        <div className="mb-1 text-xs font-medium uppercase opacity-70">{isOwner ? "Owner" : "SignalHost"}</div>
        <p className="text-sm leading-6">{message.text}</p>
        {!isOwner && message.response && (
          <div className="mt-3 space-y-3">
            <div className="text-sm font-semibold">{message.response.title}</div>
            <ul className="space-y-2">
              {message.response.bullets.map((bullet) => (
                <li key={bullet} className="flex gap-2 text-sm leading-5 text-muted-foreground">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2 pt-1">
              {message.response.suggestedActions.map((action) => (
                <Badge key={action} variant="secondary" className="text-[10px]">{action}</Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function IdentityLine({
  icon: Icon,
  label,
  value,
  warning,
}: {
  icon: typeof UserRound;
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-border p-3">
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", warning ? "text-warning" : "text-primary")} />
      <div className="min-w-0">
        <div className="text-xs font-medium uppercase text-muted-foreground">{label}</div>
        <div className={cn("mt-0.5 truncate text-sm font-medium", warning && "text-warning")}>{value}</div>
      </div>
    </div>
  );
}

function Capability({ icon: Icon, label }: { icon: typeof CheckCircle2; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border p-2.5">
      <Icon className="h-4 w-4 text-primary" />
      <span>{label}</span>
    </div>
  );
}
