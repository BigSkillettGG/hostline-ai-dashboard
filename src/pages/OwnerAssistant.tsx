import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  History,
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
import { getBusinessMode } from "@/domain/business-updates";
import { routeOwnerCommand, type OwnerCommandRoute } from "@/domain/owner-command-router";
import type { OwnerLiveCommand } from "@/domain/owner-live-commands";
import {
  buildOwnerAssistantResponse,
  ownerAssistantSuggestions,
  type OwnerAssistantContext,
  type OwnerAssistantResponse,
} from "@/domain/owner-assistant";
import type { StaffTask } from "@/domain/staff-tasks";
import { defaultTrustedContactPermissions, trustedContactTypeFromRole } from "@/domain/trusted-contacts";
import { isPlatformAdminUser, useCurrentUser } from "@/lib/auth";
import { loadBusinessLiveState, saveBusinessLiveState } from "@/lib/business-live-updates-storage";
import { loadOnboardingDraft } from "@/lib/onboarding-draft";
import {
  createBusinessLiveUpdateInSupabase,
  applyKnowledgeSuggestionInSupabase,
  createKnowledgeSuggestionInSupabase,
  fetchCallsFromSupabase,
  fetchOwnerCommandActivityFromSupabase,
  fetchOrdersFromSupabase,
  fetchReservationsFromSupabase,
  fetchStaffTasksFromSupabase,
  fetchTenantDirectoryFromSupabase,
  getActiveSupabaseLocationId,
  isBusinessLiveUpdatesPersistenceConfigured,
  isSupabaseConfigured,
  saveBusinessLiveModeToSupabase,
  type OwnerCommandActivity,
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
const emptyOwnerActivity: OwnerCommandActivity[] = [];
const ownerCommandSuggestions = [
  "Tonight's special is lobster ravioli",
  "We're closed tomorrow for a private event",
  "Remember that the bathroom is white",
  "Set busy mode",
];

export default function OwnerAssistant() {
  const queryClient = useQueryClient();
  const user = useCurrentUser();
  const platformAdmin = isPlatformAdminUser(user);
  const activeLocationId = getActiveSupabaseLocationId();
  const liveEnabled = Boolean(isSupabaseConfigured() && activeLocationId);
  const liveUpdatesEnabled = isBusinessLiveUpdatesPersistenceConfigured();
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
  const ownerActivityQuery = useQuery({
    enabled: liveEnabled,
    queryFn: () => fetchOwnerCommandActivityFromSupabase(activeLocationId),
    queryKey: ["owner-command-activity", activeLocationId],
    refetchInterval: 30_000,
  });

  const activeTenant = tenantQuery.data?.find((tenant) => tenant.locationId === activeLocationId);
  const businessName = activeTenant?.locationName ?? String(draft.restaurantName || "your business");
  const ownerName = String(draft.ownerName || activeTenant?.ownerName || "Owner");
  const ownerPhone = String(draft.ownerPhone || draft.escalationPhone || "");
  const ownerEmail = String(draft.ownerEmail || activeTenant?.ownerEmail || draft.salesManagerEmail || "");
  const commandActor = useMemo(() => {
    const contactType = platformAdmin || !user?.restaurantMembershipRole
      ? "owner"
      : trustedContactTypeFromRole(user.restaurantMembershipRole);

    return {
      contact: {
        contactType,
        email: user?.email,
        name: user?.name ?? ownerName,
        phone: ownerPhone,
      },
      permissions: defaultTrustedContactPermissions(contactType),
    };
  }, [ownerName, ownerPhone, platformAdmin, user?.email, user?.name, user?.restaurantMembershipRole]);
  const calls = useMemo(() => liveEnabled ? callQuery.data ?? emptyCalls : sampleCalls, [callQuery.data, liveEnabled]);
  const orders = useMemo(() => liveEnabled ? orderQuery.data ?? emptyOrders : sampleOrders, [liveEnabled, orderQuery.data]);
  const reservations = useMemo(
    () => liveEnabled ? reservationQuery.data ?? emptyReservations : sampleReservations,
    [liveEnabled, reservationQuery.data],
  );
  const tasks = useMemo(() => liveEnabled ? taskQuery.data ?? emptyTasks : emptyTasks, [liveEnabled, taskQuery.data]);
  const ownerActivity = useMemo(
    () => liveEnabled ? ownerActivityQuery.data ?? emptyOwnerActivity : emptyOwnerActivity,
    [liveEnabled, ownerActivityQuery.data],
  );
  const assistantContext = useMemo(
    () => ({ businessName, calls, orders, reservations, tasks }),
    [businessName, calls, orders, reservations, tasks],
  );
  const [messages, setMessages] = useState<OwnerChatMessage[]>([
    {
      id: "assistant-start",
      role: "assistant",
      text: "Ask me what happened today, what needs follow-up, what I did not know, or tell me live updates like tonight's special.",
    },
  ]);
  const hasLiveError =
    callQuery.isError ||
    orderQuery.isError ||
    ownerActivityQuery.isError ||
    reservationQuery.isError ||
    taskQuery.isError;

  async function askOwnerAssistant(nextQuestion: string) {
    const trimmed = nextQuestion.trim();
    if (!trimmed) return;

    const commandRoute = routeOwnerCommand({
      actor: commandActor,
      channel: "dashboard",
      message: trimmed,
    });
    const response = await handleOwnerCommandRoute(commandRoute, trimmed, {
      assistantContext,
      useKnowledgeSupabase: liveEnabled,
      useLiveSupabase: liveUpdatesEnabled,
    });
    if (commandRoute.kind === "live_command") {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["business-live-state", activeLocationId] }),
        queryClient.invalidateQueries({ queryKey: ["owner-command-activity", activeLocationId] }),
      ]);
    }
    if (commandRoute.kind === "knowledge_update") {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["owner-command-activity", activeLocationId] }),
        queryClient.invalidateQueries({ queryKey: ["knowledge-suggestions"] }),
        queryClient.invalidateQueries({ queryKey: ["knowledge-suggestions", activeLocationId] }),
        queryClient.invalidateQueries({ queryKey: ["knowledge-sections"] }),
        queryClient.invalidateQueries({ queryKey: ["knowledge-sections", activeLocationId] }),
      ]);
    }
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
                  {ownerCommandSuggestions.map((item) => (
                    <Button
                      key={item}
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
                      onClick={() => askOwnerAssistant(item)}
                    >
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
                    placeholder="Ask about urgent calls, leads, or say: Tonight's special is lobster ravioli..."
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
                  <History className="h-4 w-4 text-primary" />
                  Recent owner activity
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!liveEnabled ? (
                  <p className="text-sm leading-5 text-muted-foreground">
                    Connect Supabase to show owner commands from phone, text, and email.
                  </p>
                ) : ownerActivityQuery.isLoading ? (
                  <p className="text-sm text-muted-foreground">Loading owner activity...</p>
                ) : ownerActivity.length ? (
                  ownerActivity.slice(0, 5).map((activity) => (
                    <OwnerActivityRow key={activity.id} activity={activity} />
                  ))
                ) : (
                  <p className="text-sm leading-5 text-muted-foreground">
                    No owner phone, text, or email commands have been recorded for this location yet.
                  </p>
                )}
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
                <Capability icon={Sparkles} label="Live updates and business modes" />
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4">
                <div className="text-sm font-medium">Next evolution</div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Verified owner SMS can use the same command layer next, so an owner can text "we are closed tomorrow" and brief SignalHost without opening the dashboard.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </PageBody>
    </>
  );
}

async function handleOwnerCommandRoute(
  route: OwnerCommandRoute,
  originalMessage: string,
  options: {
    assistantContext: OwnerAssistantContext;
    useKnowledgeSupabase: boolean;
    useLiveSupabase: boolean;
  },
): Promise<OwnerAssistantResponse> {
  if (route.kind === "report_query") {
    return buildOwnerAssistantResponse(route.question, options.assistantContext);
  }

  if (route.kind === "live_command") {
    if (route.decision === "denied") {
      return deniedOwnerCommandResponse(route.reason ?? "This contact cannot change live business updates.");
    }
    if (route.decision === "approval_required") {
      return approvalRequiredOwnerCommandResponse("I understood that live update, but this contact needs owner approval before I change what callers hear.");
    }
    return applyOwnerLiveCommand(route.command, { useSupabase: options.useLiveSupabase });
  }

  if (route.kind === "knowledge_update") {
    return applyOwnerKnowledgeCommand(route, { useSupabase: options.useKnowledgeSupabase });
  }

  if (route.kind === "denied") {
    return deniedOwnerCommandResponse(route.reason);
  }

  return unknownOwnerCommandResponse(originalMessage, route.reason);
}

async function applyOwnerKnowledgeCommand(
  route: Extract<OwnerCommandRoute, { kind: "knowledge_update" }>,
  options: { useSupabase: boolean },
): Promise<OwnerAssistantResponse> {
  if (route.decision === "denied") {
    return deniedOwnerCommandResponse(route.reason ?? "This contact cannot update permanent knowledge.");
  }

  if (!options.useSupabase) {
    return {
      answer: "I understood that as permanent knowledge, but this preview is not connected to live Supabase, so I cannot save it for future calls from here.",
      bullets: [
        route.answer,
        route.decision === "approval_required"
          ? "This would be saved as a pending owner approval item in the live app."
          : "This would be saved directly to the Knowledge Base in the live app.",
        "Connect Supabase in the deployed dashboard to make owner-taught answers available to callers.",
      ],
      confidence: "medium",
      intent: "knowledge_gaps",
      suggestedActions: ["Open Knowledge Base", "Check Supabase settings"],
      title: route.decision === "approval_required" ? "Knowledge approval needed" : "Knowledge understood",
    };
  }

  try {
    const suggestion = await createKnowledgeSuggestionInSupabase({
      body: route.body,
      priority: "normal",
      source: "owner_assistant",
      sourceQuestion: route.sourceQuestion,
      suggestedAnswer: route.answer,
      title: route.title,
    });

    if (route.decision === "approval_required") {
      return {
        answer: "I saved that as a pending knowledge update for owner approval.",
        bullets: [
          route.answer,
          route.reason ?? "A trusted contact submitted this, so it needs review before callers hear it.",
          "Open the Knowledge Base to approve, edit, or reject it.",
        ],
        confidence: "high",
        intent: "knowledge_gaps",
        suggestedActions: ["Open Knowledge Base", "Review pending updates"],
        title: "Knowledge update pending",
      };
    }

    await applyKnowledgeSuggestionInSupabase({
      body: route.body,
      id: suggestion.id,
      title: route.title,
    });

    return {
      answer: "Got it. I saved that as permanent knowledge for future customer conversations.",
      bullets: [
        route.answer,
        "Future calls, chats, texts, and emails can use this answer unless a newer live update overrides it.",
        "Saved to Supabase and applied to the Knowledge Base.",
      ],
      confidence: "high",
      intent: "knowledge_gaps",
      suggestedActions: ["Open Knowledge Base", "Ask what changed today"],
      title: "Knowledge saved",
    };
  } catch (error) {
    return ownerKnowledgeCommandErrorResponse(error);
  }
}

async function applyOwnerLiveCommand(
  command: OwnerLiveCommand,
  options: { useSupabase: boolean },
): Promise<OwnerAssistantResponse> {
  const current = loadBusinessLiveState();

  if (command.kind === "set_mode") {
    let savedMode = command.mode;
    try {
      if (options.useSupabase) {
        savedMode = await saveBusinessLiveModeToSupabase(command.mode);
      }
    } catch (error) {
      return ownerLiveCommandErrorResponse(error, "business mode");
    }

    const next = saveBusinessLiveState({
      mode: savedMode,
      updates: current.updates,
    });
    const mode = getBusinessMode(next.mode);

    return {
      answer: command.confirmation,
      bullets: [
        `${mode.label} mode is active.`,
        mode.operatorCue,
        options.useSupabase
          ? "Saved to Supabase for live runtime use."
          : "Saved locally for this dashboard preview.",
      ],
      confidence: "high",
      intent: "live_update",
      suggestedActions: ["Open Knowledge Base", "Ask for today's summary"],
      title: "Business mode updated",
    };
  }

  let savedUpdate = command.update;
  try {
    if (options.useSupabase) {
      savedUpdate = await createBusinessLiveUpdateInSupabase(command.update);
    }
  } catch (error) {
    return ownerLiveCommandErrorResponse(error, "live update");
  }

  const next = saveBusinessLiveState({
    mode: current.mode,
    updates: [savedUpdate, ...current.updates.filter((update) => update.id !== savedUpdate.id)],
  });

  return {
    answer: command.confirmation,
    bullets: [
      savedUpdate.body,
      savedUpdate.expiresAt ? `Expires ${formatOwnerUpdateExpiration(savedUpdate.expiresAt)}.` : "Active until cleared.",
      options.useSupabase ? "Saved to Supabase for live runtime use." : "Saved locally for this dashboard preview.",
      `${next.updates.length} live update${next.updates.length === 1 ? "" : "s"} saved for this workspace.`,
    ],
    confidence: "high",
    intent: "live_update",
    suggestedActions: ["Open Knowledge Base", "Ask what changed today"],
    title: "Live update created",
  };
}

function ownerLiveCommandErrorResponse(error: unknown, label: string): OwnerAssistantResponse {
  return {
    answer: `I understood that ${label} command, but I could not save it to the live database.`,
    bullets: [
      error instanceof Error ? error.message : "Unknown save error.",
      "The Knowledge Base can still use local preview updates if the live tables are not migrated yet.",
    ],
    confidence: "medium",
    intent: "live_update",
    suggestedActions: ["Open Knowledge Base", "Check Supabase migration"],
    title: "Live update not saved",
  };
}

function ownerKnowledgeCommandErrorResponse(error: unknown): OwnerAssistantResponse {
  return {
    answer: "I understood that knowledge update, but I could not save it to the live database.",
    bullets: [
      error instanceof Error ? error.message : "Unknown save error.",
      "The Knowledge Base migration and Supabase environment variables may need to be checked.",
    ],
    confidence: "medium",
    intent: "knowledge_gaps",
    suggestedActions: ["Open Knowledge Base", "Check Supabase settings"],
    title: "Knowledge not saved",
  };
}

function approvalRequiredOwnerCommandResponse(answer: string): OwnerAssistantResponse {
  return {
    answer,
    bullets: [
      "I did not change live caller behavior yet.",
      "An owner can approve this from the dashboard before it becomes active.",
    ],
    confidence: "medium",
    intent: "live_update",
    suggestedActions: ["Open Knowledge Base", "Review trusted contacts"],
    title: "Owner approval required",
  };
}

function deniedOwnerCommandResponse(reason: string): OwnerAssistantResponse {
  return {
    answer: "I cannot run that owner command from this contact.",
    bullets: [reason, "Ask an owner to update trusted-contact permissions if this person should have access."],
    confidence: "medium",
    intent: "unknown",
    suggestedActions: ["Review trusted contacts", "Open Team settings"],
    title: "Command not allowed",
  };
}

function unknownOwnerCommandResponse(message: string, reason: string): OwnerAssistantResponse {
  return {
    answer: "I am not sure whether that is a report question, a live update, or a permanent knowledge update.",
    bullets: [
      reason,
      `I heard: "${message}"`,
      "Try asking a report question like 'Any urgent calls today?' or teaching a fact like 'Remember that the patio has heaters.'",
    ],
    confidence: "medium",
    intent: "unknown",
    suggestedActions: ["Ask today's summary", "Open Knowledge Base"],
    title: "Command unclear",
  };
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

function OwnerActivityRow({ activity }: { activity: OwnerCommandActivity }) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium">{activity.title}</div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {activity.body || "No message body captured."}
          </p>
        </div>
        <Badge variant="outline" className="shrink-0 text-[10px] uppercase">
          {activity.channel}
        </Badge>
      </div>
      <div className="mt-2 text-[11px] uppercase tracking-wide text-muted-foreground">
        {formatOwnerActivityTime(activity.createdAt)} - {activity.direction}
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

function formatOwnerUpdateExpiration(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      month: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatOwnerActivityTime(value: string) {
  if (!value) return "Recently";
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
      month: "short",
      day: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
}
