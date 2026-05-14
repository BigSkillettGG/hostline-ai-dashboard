import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Copy,
  FileText,
  MessageSquare,
  PhoneCall,
  RefreshCw,
  Search,
  Send,
  Sparkles,
} from "lucide-react";
import { PageBody, PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Call, CallFeedback, CallFeedbackCategory } from "@/data/mock";
import {
  createCallFeedbackInSupabase,
  createStaffTaskInSupabase,
  fetchCallFeedbackFromSupabase,
  fetchCallsFromSupabase,
  fetchTenantDirectoryFromSupabase,
  isSupabaseConfigured,
  updateCallStatusInSupabase,
} from "@/lib/supabase-rest";
import { formatDuration, formatTime } from "@/lib/format";
import { toast } from "sonner";

const reviewOptions: Array<{ description: string; label: string; value: CallFeedbackCategory }> = [
  { description: "SignalHost did exactly what we want.", label: "Good answer", value: "good_answer" },
  { description: "Factually wrong or misleading.", label: "Wrong answer", value: "wrong_answer" },
  { description: "Technically okay, but unnatural.", label: "Awkward", value: "awkward" },
  { description: "Tenant knowledge is missing.", label: "Missing knowledge", value: "missing_knowledge" },
  { description: "This should have gone to staff.", label: "Should escalate", value: "should_have_escalated" },
  { description: "Anything else worth tuning.", label: "Other", value: "other" },
];

const reviewLabelByCategory = reviewOptions.reduce<Record<CallFeedbackCategory, string>>((acc, option) => {
  acc[option.value] = option.label;
  return acc;
}, {} as Record<CallFeedbackCategory, string>);

type QueueFilter = "all" | "needs_review" | "low_confidence" | "bad_close" | "escalated" | "complaint";

interface QaCall {
  call: Call;
  reasons: string[];
  riskScore: number;
}

export default function CallQA() {
  const queryClient = useQueryClient();
  const supabaseConfigured = isSupabaseConfigured();
  const [filter, setFilter] = useState<QueueFilter>("needs_review");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reviewCategory, setReviewCategory] = useState<CallFeedbackCategory>("awkward");
  const [reviewNote, setReviewNote] = useState("");
  const [suggestedAnswer, setSuggestedAnswer] = useState("");
  const [addToKnowledge, setAddToKnowledge] = useState(true);

  const callsQuery = useQuery({
    enabled: supabaseConfigured,
    queryFn: () => fetchCallsFromSupabase(null),
    queryKey: ["qa", "calls", "all"],
    refetchInterval: 30_000,
  });
  const tenantQuery = useQuery({
    enabled: supabaseConfigured,
    queryFn: fetchTenantDirectoryFromSupabase,
    queryKey: ["tenant-directory"],
    refetchInterval: 60_000,
  });

  const queue = useMemo(() => {
    const calls = callsQuery.data ?? [];
    return calls
      .map((call) => ({ call, reasons: qaReasonsForCall(call), riskScore: qaRiskScore(call) }))
      .filter((item) => item.reasons.length || filter === "all")
      .sort((first, second) => second.riskScore - first.riskScore || +new Date(second.call.time) - +new Date(first.call.time));
  }, [callsQuery.data, filter]);
  const filteredQueue = queue.filter((item) => {
    if (!matchesQueueFilter(item, filter)) return false;
    if (!search.trim()) return true;
    const needle = search.toLowerCase();
    return [
      item.call.caller,
      item.call.phone,
      item.call.summary,
      item.call.intent,
      item.call.locationId ?? "",
      tenantName(item.call.locationId, tenantQuery.data),
    ].some((value) => value.toLowerCase().includes(needle));
  });
  const selected = filteredQueue.find((item) => item.call.id === selectedId) ?? filteredQueue[0] ?? null;
  const selectedCall = selected?.call ?? null;
  const selectedLocationId = selectedCall?.locationId;

  const feedbackQuery = useQuery({
    enabled: supabaseConfigured && Boolean(selectedCall?.id),
    queryFn: () => fetchCallFeedbackFromSupabase(selectedCall!.id),
    queryKey: ["call-feedback", selectedCall?.id],
  });
  const saveFeedbackMutation = useMutation({
    mutationFn: () => {
      if (!selectedCall?.locationId) throw new Error("This call is missing a location ID.");
      return createCallFeedbackInSupabase(
        {
          addToKnowledge,
          callId: selectedCall.id,
          category: reviewCategory,
          note: reviewNote,
          suggestedAnswer,
        },
        selectedCall.locationId,
      );
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not save QA feedback");
    },
    onSuccess: async (feedback) => {
      setReviewNote("");
      setSuggestedAnswer("");
      setAddToKnowledge(false);
      await queryClient.invalidateQueries({ queryKey: ["call-feedback", feedback.callId] });
      toast.success(feedback.addedToKnowledge ? "QA note saved for knowledge approval" : "QA note saved");
    },
  });
  const statusMutation = useMutation({
    mutationFn: () => {
      if (!selectedCall) throw new Error("No selected call.");
      return updateCallStatusInSupabase({ callId: selectedCall.id, status: "reviewed" });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not mark reviewed");
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["qa", "calls", "all"] });
      toast.success("Call marked reviewed");
    },
  });
  const taskMutation = useMutation({
    mutationFn: () => {
      if (!selectedCall?.locationId) throw new Error("This call is missing a location ID.");
      return createStaffTaskInSupabase(
        {
          body: buildStaffTaskBody(selectedCall, reviewNote, suggestedAnswer),
          callId: selectedCall.id,
          priority: selected.riskScore >= 80 ? "urgent" : selected.riskScore >= 55 ? "high" : "normal",
          title: `Review ${selectedCall.intent} call from ${selectedCall.caller}`,
          type: selectedCall.confidence < 60 ? "low_confidence_review" : "customer_request",
        },
        selectedCall.locationId,
      );
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not create staff task");
    },
    onSuccess: () => {
      toast.success("Staff task created");
    },
  });

  const tenantRows = tenantQuery.data ?? [];
  const totalCalls = callsQuery.data?.length ?? 0;
  const badCloseCount = queue.filter((item) => item.reasons.includes("Bad close-out")).length;
  const lowConfidenceCount = queue.filter((item) => item.reasons.includes("Low confidence")).length;
  const escalatedCount = queue.filter((item) => item.reasons.includes("Escalated")).length;
  const feedbackHistory = feedbackQuery.data ?? [];

  function saveQuickFeedback(category: CallFeedbackCategory) {
    setReviewCategory(category);
    if (!reviewNote.trim()) setReviewNote(defaultNoteForCategory(category, selectedCall));
  }

  async function copySelectedTranscript() {
    if (!selectedCall) return;
    try {
      await navigator.clipboard.writeText(buildTranscriptText(selectedCall, tenantName(selectedCall.locationId, tenantRows)));
      toast.success("Transcript copied");
    } catch {
      toast.error("Could not copy transcript");
    }
  }

  return (
    <>
      <PageHeader
        title="QA Queue"
        description="Find rough calls, save tuning notes, add knowledge, and create follow-up work"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={supabaseConfigured ? "border-success/30 bg-success/10 text-success" : "border-warning/30 bg-warning/10 text-warning"}>
              {supabaseConfigured ? "Live Supabase" : "Not connected"}
            </Badge>
            {supabaseConfigured && (
              <Button variant="outline" size="sm" onClick={() => void callsQuery.refetch()} disabled={callsQuery.isFetching}>
                <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${callsQuery.isFetching ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            )}
          </div>
        }
      />
      <PageBody className="space-y-5">
        {!supabaseConfigured && (
          <Card className="border-warning/30 bg-warning/10 p-4 text-sm text-warning">
            Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to use the live QA queue.
          </Card>
        )}
        {callsQuery.isError && (
          <Card className="border-warning/30 bg-warning/10 p-4 text-sm text-muted-foreground">
            Live calls could not be loaded. {callsQuery.error instanceof Error ? callsQuery.error.message : ""}
          </Card>
        )}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MiniStat icon={PhoneCall} label="Calls loaded" value={totalCalls.toLocaleString()} />
          <MiniStat icon={AlertTriangle} label="QA candidates" value={queue.length.toLocaleString()} tone={queue.length ? "warning" : "success"} />
          <MiniStat icon={MessageSquare} label="Bad close-outs" value={badCloseCount.toLocaleString()} tone={badCloseCount ? "warning" : "success"} />
          <MiniStat icon={Sparkles} label="Low confidence" value={lowConfidenceCount.toLocaleString()} tone={lowConfidenceCount ? "warning" : "success"} />
          <MiniStat icon={Send} label="Escalated" value={escalatedCount.toLocaleString()} />
        </div>

        <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ClipboardList className="h-4 w-4 text-primary" />
                    Review queue
                  </CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">Prioritized by risk, then most recent call.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input className="h-9 w-56 pl-8" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search calls..." />
                  </div>
                  <Select value={filter} onValueChange={(value) => setFilter(value as QueueFilter)}>
                    <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="needs_review">Needs review</SelectItem>
                      <SelectItem value="low_confidence">Low confidence</SelectItem>
                      <SelectItem value="bad_close">Bad close-out</SelectItem>
                      <SelectItem value="escalated">Escalated</SelectItem>
                      <SelectItem value="complaint">Complaints</SelectItem>
                      <SelectItem value="all">All calls</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredQueue.length === 0 ? (
                <EmptyState text="No calls match this QA filter yet." />
              ) : (
                <div className="max-h-[720px] space-y-2 overflow-y-auto pr-1">
                  {filteredQueue.map((item) => (
                    <button
                      key={item.call.id}
                      type="button"
                      onClick={() => setSelectedId(item.call.id)}
                      className={`w-full rounded-md border p-3 text-left transition-colors ${
                        selectedCall?.id === item.call.id
                          ? "border-primary bg-primary/10"
                          : "border-border bg-card hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{item.call.caller}</span>
                            <Badge variant="outline" className={intentBadgeClass(item.call.intent)}>{item.call.intent}</Badge>
                            <Badge variant="outline" className={riskBadgeClass(item.riskScore)}>{item.riskScore}</Badge>
                          </div>
                          <div className="mt-1 truncate text-xs text-muted-foreground">
                            {tenantName(item.call.locationId, tenantRows)} - {item.call.phone}
                          </div>
                        </div>
                        <div className="shrink-0 text-xs text-muted-foreground tabular-nums">{formatTime(item.call.time)}</div>
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{item.call.summary}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {item.reasons.map((reason) => (
                          <Badge key={reason} variant="secondary" className="text-[10px]">{reason}</Badge>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-4 w-4 text-primary" />
                  Call review
                </CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  {selectedCall ? `${tenantName(selectedCall.locationId, tenantRows)} - ${selectedCall.phone}` : "Select a call to review."}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {selectedLocationId && (
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/super/tenants/${selectedLocationId}`}>Tenant</Link>
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={copySelectedTranscript} disabled={!selectedCall}>
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  Copy
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {!selectedCall ? (
                <EmptyState text="No selected call." />
              ) : (
                <div className="space-y-5">
                  <div className="grid gap-2 sm:grid-cols-4">
                    <Fact label="Intent" value={selectedCall.intent} />
                    <Fact label="Outcome" value={selectedCall.outcome.replace(/_/g, " ")} />
                    <Fact label="Confidence" value={`${selectedCall.confidence}%`} />
                    <Fact label="Duration" value={formatDuration(selectedCall.duration)} />
                  </div>

                  <div className="rounded-md border border-border p-3">
                    <div className="text-xs font-medium uppercase text-muted-foreground">SignalHost summary</div>
                    <p className="mt-1 text-sm">{selectedCall.summary}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {selected.reasons.map((reason) => (
                        <Badge key={reason} variant="outline" className="text-[10px]">{reason}</Badge>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-md border border-border">
                    <div className="flex items-center justify-between border-b border-border px-3 py-2">
                      <div className="text-sm font-semibold">Transcript</div>
                      {selectedCall.recordingUrl && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={selectedCall.recordingUrl} target="_blank" rel="noreferrer">Recording</a>
                        </Button>
                      )}
                    </div>
                    <div className="max-h-72 space-y-3 overflow-y-auto p-3">
                      {selectedCall.transcript.length === 0 ? (
                        <EmptyState text="Transcript not available yet." />
                      ) : (
                        selectedCall.transcript.map((turn, index) => (
                          <div key={`${turn.t}-${index}`} className={`flex ${turn.speaker === "agent" ? "justify-start" : "justify-end"}`}>
                            <div className={`max-w-[82%] rounded-md px-3 py-2 text-sm ${turn.speaker === "agent" ? "bg-muted" : "bg-primary text-primary-foreground"}`}>
                              <div className={`mb-1 text-[10px] ${turn.speaker === "agent" ? "text-muted-foreground" : "text-primary-foreground/75"}`}>
                                {turn.speaker === "agent" ? "SignalHost" : turn.speaker === "staff" ? "Staff" : "Caller"} - {turn.t}
                              </div>
                              {turn.text}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-md border border-border p-4">
                    <div className="flex items-start gap-2">
                      <Sparkles className="mt-0.5 h-4 w-4 text-primary" />
                      <div>
                        <div className="text-sm font-semibold">Tune from this call</div>
                        <p className="text-xs text-muted-foreground">Save what happened, what SignalHost should do, and whether this becomes permanent tenant knowledge.</p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      {reviewOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => saveQuickFeedback(option.value)}
                          className={`rounded-md border p-3 text-left transition-colors ${
                            reviewCategory === option.value
                              ? "border-primary bg-primary/10"
                              : "border-border bg-background hover:bg-muted/40"
                          }`}
                        >
                          <div className="text-sm font-medium">{option.label}</div>
                          <div className="mt-1 text-xs text-muted-foreground">{option.description}</div>
                        </button>
                      ))}
                    </div>

                    <div className="mt-4 space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground">What happened?</Label>
                      <Textarea value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} rows={3} placeholder="Example: Caller said they were done, but SignalHost did not close the call cleanly." />
                    </div>

                    <div className="mt-3 space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground">Preferred answer or behavior</Label>
                      <Textarea value={suggestedAnswer} onChange={(event) => setSuggestedAnswer(event.target.value)} rows={3} placeholder="Example: Ask if there is anything else, then say thanks for calling and goodbye." />
                    </div>

                    <div className="mt-3 flex items-start gap-2 rounded-md border border-border bg-muted/30 p-3">
                      <Checkbox checked={addToKnowledge} id="qa-add-knowledge" onCheckedChange={(checked) => setAddToKnowledge(checked === true)} />
                      <div>
                        <Label htmlFor="qa-add-knowledge" className="text-sm font-medium">Queue this as a knowledge update</Label>
                        <p className="text-xs text-muted-foreground">Use this for permanent facts or preferred behavior. It will wait for owner approval before shaping SignalHost.</p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap justify-end gap-2">
                      <Button variant="outline" onClick={() => taskMutation.mutate()} disabled={taskMutation.isPending || !selectedCall.locationId}>
                        <ClipboardList className="mr-1.5 h-3.5 w-3.5" />
                        {taskMutation.isPending ? "Creating..." : "Create staff task"}
                      </Button>
                      <Button variant="outline" onClick={() => statusMutation.mutate()} disabled={statusMutation.isPending}>
                        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                        {statusMutation.isPending ? "Updating..." : "Mark reviewed"}
                      </Button>
                      <Button onClick={() => saveFeedbackMutation.mutate()} disabled={saveFeedbackMutation.isPending || (!reviewNote.trim() && !suggestedAnswer.trim() && reviewCategory !== "good_answer")}>
                        <BookOpen className="mr-1.5 h-3.5 w-3.5" />
                        {saveFeedbackMutation.isPending ? "Saving..." : "Save QA note"}
                      </Button>
                    </div>
                  </div>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Review history</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {feedbackQuery.isLoading ? (
                        <EmptyState text="Loading QA notes..." />
                      ) : feedbackHistory.length === 0 ? (
                        <EmptyState text="No QA notes yet for this call." />
                      ) : (
                        feedbackHistory.map((feedback) => <FeedbackRow key={feedback.id} feedback={feedback} />)
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </PageBody>
    </>
  );
}

function MiniStat({
  icon: Icon,
  label,
  tone = "default",
  value,
}: {
  icon: typeof PhoneCall;
  label: string;
  tone?: "default" | "warning" | "success";
  value: string;
}) {
  const toneClass =
    tone === "success"
      ? "bg-success/10 text-success"
      : tone === "warning"
        ? "bg-warning/15 text-warning"
        : "bg-primary/10 text-primary";

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-medium uppercase text-muted-foreground">{label}</div>
            <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
          </div>
          <div className={`flex h-8 w-8 items-center justify-center rounded-md ${toneClass}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="text-[11px] font-medium uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 truncate text-sm font-medium capitalize">{value}</div>
    </div>
  );
}

function FeedbackRow({ feedback }: { feedback: CallFeedback }) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge variant="outline">{reviewLabelByCategory[feedback.category]}</Badge>
        <span className="text-xs text-muted-foreground">{feedback.createdAt ? formatTime(feedback.createdAt) : "Just now"}</span>
      </div>
      {feedback.note && <p className="mt-2 text-sm">{feedback.note}</p>}
      {feedback.suggestedAnswer && <p className="mt-2 rounded-md bg-muted/40 p-2 text-sm text-muted-foreground">{feedback.suggestedAnswer}</p>}
      {feedback.addedToKnowledge && (
        <div className="mt-2 inline-flex items-center gap-1 text-xs text-primary">
          <BookOpen className="h-3 w-3" />
          Queued for knowledge approval
        </div>
      )}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{text}</div>;
}

function qaReasonsForCall(call: Call) {
  const reasons: string[] = [];
  if (call.status === "needs_review") reasons.push("Needs review");
  if (call.confidence > 0 && call.confidence < 70) reasons.push("Low confidence");
  if (call.intent === "complaint") reasons.push("Complaint");
  if (call.outcome === "escalated" || call.outcome === "manager_alerted") reasons.push("Escalated");
  if (call.outcome === "unknown") reasons.push("Unknown outcome");
  if (looksLikeBadCloseOut(call)) reasons.push("Bad close-out");
  if (!call.transcript.length) reasons.push("No transcript");
  return [...new Set(reasons)];
}

function qaRiskScore(call: Call) {
  let score = 0;
  if (call.status === "needs_review") score += 24;
  if (call.confidence > 0 && call.confidence < 70) score += 22;
  if (call.confidence > 0 && call.confidence < 50) score += 12;
  if (call.intent === "complaint") score += 20;
  if (call.outcome === "escalated" || call.outcome === "manager_alerted") score += 16;
  if (call.outcome === "unknown") score += 12;
  if (looksLikeBadCloseOut(call)) score += 18;
  if (!call.transcript.length) score += 8;
  return Math.min(100, score);
}

function looksLikeBadCloseOut(call: Call) {
  const lastTurn = call.transcript.at(-1);
  if (!lastTurn) return false;
  if (lastTurn.speaker === "caller") return true;
  if (lastTurn.speaker !== "agent") return false;
  const text = lastTurn.text.toLowerCase();
  if (/(goodbye|bye|thanks for calling|thank you for calling|anything else|anything i can help)/i.test(text)) return false;
  return call.duration > 30 && !/(confirmed|all set|ready|sent|booked)/i.test(text);
}

function matchesQueueFilter(item: QaCall, filter: QueueFilter) {
  if (filter === "all") return true;
  if (filter === "needs_review") return item.reasons.length > 0;
  if (filter === "low_confidence") return item.reasons.includes("Low confidence");
  if (filter === "bad_close") return item.reasons.includes("Bad close-out");
  if (filter === "escalated") return item.reasons.includes("Escalated");
  if (filter === "complaint") return item.reasons.includes("Complaint");
  return true;
}

function tenantName(locationId: string | undefined, tenants: Array<{ locationId: string; locationName: string }>) {
  if (!locationId) return "Unknown tenant";
  return tenants.find((tenant) => tenant.locationId === locationId)?.locationName ?? locationId;
}

function buildTranscriptText(call: Call, tenant: string) {
  const transcript = call.transcript.length
    ? call.transcript.map((turn) => `${turn.speaker === "agent" ? "SignalHost" : turn.speaker === "staff" ? "Staff" : "Caller"}: ${turn.text}`).join("\n")
    : "Transcript not available.";
  return [
    `Tenant: ${tenant}`,
    `Call ID: ${call.id}`,
    `Caller: ${call.caller}`,
    `Phone: ${call.phone}`,
    `Time: ${formatTime(call.time)}`,
    `Duration: ${formatDuration(call.duration)}`,
    `Intent: ${call.intent}`,
    `Outcome: ${call.outcome}`,
    `Status: ${call.status}`,
    `Confidence: ${call.confidence}%`,
    `Summary: ${call.summary}`,
    "",
    transcript,
  ].join("\n");
}

function buildStaffTaskBody(call: Call, note: string, suggestedAnswer: string) {
  return [
    `QA review requested for call ${call.id}.`,
    `Summary: ${call.summary}`,
    note.trim() ? `QA note: ${note.trim()}` : undefined,
    suggestedAnswer.trim() ? `Preferred behavior: ${suggestedAnswer.trim()}` : undefined,
  ].filter((item): item is string => Boolean(item)).join("\n\n");
}

function defaultNoteForCategory(category: CallFeedbackCategory, call: Call | null) {
  if (!call) return "";
  if (category === "awkward") return "The answer was technically acceptable, but it sounded stiff or unnatural.";
  if (category === "wrong_answer") return "The answer was incorrect or misleading.";
  if (category === "missing_knowledge") return "SignalHost did not have enough tenant knowledge to answer confidently.";
  if (category === "should_have_escalated") return "This should have been escalated to staff instead of answered directly.";
  if (category === "good_answer") return "This call is a good example of the behavior we want to keep.";
  return `Review needed for ${call.intent} call.`;
}

function intentBadgeClass(intent: string) {
  if (intent === "order") return "border-primary/20 bg-primary/10 text-primary";
  if (intent === "reservation") return "border-warning/30 bg-warning/10 text-warning";
  if (intent === "complaint") return "border-destructive/30 bg-destructive/10 text-destructive";
  if (intent === "sales") return "border-warning/30 bg-warning/10 text-warning";
  return "border-border bg-muted text-muted-foreground";
}

function riskBadgeClass(score: number) {
  if (score >= 70) return "border-destructive/30 bg-destructive/10 text-destructive";
  if (score >= 40) return "border-warning/30 bg-warning/10 text-warning";
  return "border-success/30 bg-success/10 text-success";
}
