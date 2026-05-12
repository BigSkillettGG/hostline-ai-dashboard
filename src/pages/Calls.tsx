import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader, PageBody } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { calls as sampleCalls, type Call, type CallFeedback, type CallFeedbackCategory } from "@/data/mock";
import { formatTime, formatDuration } from "@/lib/format";
import { Search, Download, Play, FileText, MessageSquare, UserCheck, Send, Phone, Filter, RefreshCw, AlertTriangle, Mail, Sparkles, ThumbsUp, BookOpen, CheckCircle2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  createCallFeedbackInSupabase,
  fetchCallFeedbackFromSupabase,
  fetchCallsFromSupabase,
  isCallFeedbackPersistenceConfigured,
  isSupabaseConfigured,
} from "@/lib/supabase-rest";

const intentColor: Record<string, string> = {
  order: "bg-primary/10 text-primary border-primary/20",
  reservation: "bg-warning/15 text-warning border-warning/20",
  faq: "bg-info/10 text-info border-info/20",
  hours: "bg-info/10 text-info border-info/20",
  complaint: "bg-destructive/10 text-destructive border-destructive/20",
  sales: "bg-warning/15 text-warning border-warning/20",
  other: "bg-muted text-muted-foreground border-border",
};
const statusColor: Record<string, string> = {
  resolved: "bg-success/15 text-success border-success/20",
  reviewed: "bg-muted text-muted-foreground border-border",
  needs_review: "bg-destructive/10 text-destructive border-destructive/20",
  new: "bg-info/10 text-info border-info/20",
};
const reviewOptions: Array<{ description: string; label: string; value: CallFeedbackCategory }> = [
  { description: "Vera nailed it. Keep this behavior.", label: "Good answer", value: "good_answer" },
  { description: "Factually wrong or misleading.", label: "Wrong answer", value: "wrong_answer" },
  { description: "Technically okay, but sounded clunky.", label: "Awkward", value: "awkward" },
  { description: "Restaurant knowledge is missing.", label: "Missing knowledge", value: "missing_knowledge" },
  { description: "Staff should have handled this.", label: "Should escalate", value: "should_have_escalated" },
  { description: "Something else to tune.", label: "Other", value: "other" },
];
const reviewLabelByCategory = reviewOptions.reduce<Record<CallFeedbackCategory, string>>((acc, option) => {
  acc[option.value] = option.label;
  return acc;
}, {} as Record<CallFeedbackCategory, string>);

export default function Calls() {
  const [selected, setSelected] = useState<Call | null>(null);
  const [intent, setIntent] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [reviewCategory, setReviewCategory] = useState<CallFeedbackCategory>("good_answer");
  const [reviewNote, setReviewNote] = useState("");
  const [suggestedAnswer, setSuggestedAnswer] = useState("");
  const [addToKnowledge, setAddToKnowledge] = useState(false);
  const [localFeedback, setLocalFeedback] = useState<Record<string, CallFeedback[]>>({});
  const queryClient = useQueryClient();
  const supabaseConfigured = isSupabaseConfigured();
  const feedbackConfigured = isCallFeedbackPersistenceConfigured();
  const selectedCallId = selected?.id;
  const callQuery = useQuery({
    enabled: supabaseConfigured,
    queryFn: fetchCallsFromSupabase,
    queryKey: ["calls", "supabase"],
    refetchInterval: 30_000,
  });
  const feedbackQuery = useQuery({
    enabled: feedbackConfigured && Boolean(selectedCallId),
    queryFn: () => fetchCallFeedbackFromSupabase(selectedCallId!),
    queryKey: ["call-feedback", selectedCallId],
  });
  const feedbackMutation = useMutation({
    mutationFn: createCallFeedbackInSupabase,
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not save feedback");
    },
    onSuccess: (savedFeedback) => {
      resetFeedbackForm();
      void queryClient.invalidateQueries({ queryKey: ["call-feedback", savedFeedback.callId] });
      toast.success(savedFeedback.addedToKnowledge ? "Feedback saved and added to the knowledge base" : "Feedback saved");
    },
  });
  const usingSupabase = Boolean(supabaseConfigured && callQuery.isSuccess);
  const calls = usingSupabase ? callQuery.data : sampleCalls;
  const selectedFeedback = selected
    ? feedbackConfigured
      ? feedbackQuery.data ?? []
      : localFeedback[selected.id] ?? []
    : [];

  const filtered = calls.filter(c => {
    if (intent !== "all" && c.intent !== intent) return false;
    if (status !== "all" && c.status !== status) return false;
    if (search && !c.caller.toLowerCase().includes(search.toLowerCase()) && !c.phone.includes(search)) return false;
    return true;
  });
  const reviewCanSave = Boolean(selected && (reviewCategory === "good_answer" || reviewNote.trim() || suggestedAnswer.trim()));

  function resetFeedbackForm() {
    setReviewCategory("good_answer");
    setReviewNote("");
    setSuggestedAnswer("");
    setAddToKnowledge(false);
  }

  function saveFeedback() {
    if (!selected || !reviewCanSave) return;

    const input = {
      addToKnowledge,
      callId: selected.id,
      category: reviewCategory,
      note: reviewNote,
      suggestedAnswer,
    };

    if (feedbackConfigured) {
      feedbackMutation.mutate(input);
      return;
    }

    const localEntry: CallFeedback = {
      addedToKnowledge: addToKnowledge,
      callId: selected.id,
      category: reviewCategory,
      createdAt: new Date().toISOString(),
      id: crypto.randomUUID(),
      note: reviewNote.trim() || undefined,
      suggestedAnswer: suggestedAnswer.trim() || undefined,
    };
    setLocalFeedback((current) => ({
      ...current,
      [selected.id]: [localEntry, ...(current[selected.id] ?? [])],
    }));
    resetFeedbackForm();
    toast.success(addToKnowledge ? "Demo feedback saved with a knowledge-base note" : "Demo feedback saved");
  }

  return (
    <>
      <PageHeader
        title="Calls"
        description={`${filtered.length} calls in the last 24 hours`}
        actions={
          <>
            <Badge variant="outline" className={usingSupabase ? "border-success/20 bg-success/10 text-success" : "bg-muted text-muted-foreground"}>
              {usingSupabase ? "Live Supabase" : "Sample data"}
            </Badge>
            {supabaseConfigured && (
              <Button variant="outline" size="sm" onClick={() => callQuery.refetch()} disabled={callQuery.isFetching}>
                <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${callQuery.isFetching ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            )}
            <Button variant="outline" size="sm"><Download className="mr-1.5 h-3.5 w-3.5" />Export</Button>
          </>
        }
      />
      <PageBody className="space-y-4">
        {callQuery.isError && (
          <Card className="border-warning/30 bg-warning/10 p-3 text-sm text-muted-foreground">
            Supabase calls could not be loaded, so this page is showing sample data. {callQuery.error instanceof Error ? callQuery.error.message : ""}
          </Card>
        )}
        {!supabaseConfigured && (
          <Card className="border-dashed bg-muted/20 p-3 text-sm text-muted-foreground">
            Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to show real calls from Supabase.
          </Card>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search caller or phone…" className="h-9 pl-8" />
          </div>
          <Select value={intent} onValueChange={setIntent}>
            <SelectTrigger className="h-9 w-36"><SelectValue placeholder="Intent" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All intents</SelectItem>
              <SelectItem value="order">Order</SelectItem>
              <SelectItem value="reservation">Reservation</SelectItem>
              <SelectItem value="complaint">Complaint</SelectItem>
              <SelectItem value="sales">Sales / Vendor</SelectItem>
              <SelectItem value="faq">FAQ</SelectItem>
              <SelectItem value="hours">Hours</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9 w-36"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="needs_review">Needs review</SelectItem>
              <SelectItem value="reviewed">Reviewed</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-9"><Filter className="mr-1.5 h-3.5 w-3.5" />More filters</Button>
        </div>

        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>Caller</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Intent</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead className="w-32">Confidence</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="py-12 text-center">
                  <Phone className="mx-auto h-8 w-8 text-muted-foreground/50" />
                  <p className="mt-2 text-sm font-medium">No calls match these filters</p>
                  <p className="text-xs text-muted-foreground">Try adjusting your filters above</p>
                </TableCell></TableRow>
              )}
              {filtered.map(c => (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => setSelected(c)}>
                  <TableCell>
                    <div className="font-medium">{c.caller}</div>
                    <div className="text-xs text-muted-foreground tabular-nums">{c.phone}</div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground tabular-nums">{formatTime(c.time)}</TableCell>
                  <TableCell className="text-sm tabular-nums">{formatDuration(c.duration)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={intentColor[c.intent]}>{c.intent}</Badge>
                  </TableCell>
                  <TableCell className="text-sm capitalize">{c.outcome.replace(/_/g, " ")}</TableCell>
                  <TableCell>
                    {c.confidence > 0 ? (
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                          <div className={`h-full rounded-full ${c.confidence >= 80 ? "bg-success" : c.confidence >= 60 ? "bg-warning" : "bg-destructive"}`} style={{ width: `${c.confidence}%` }} />
                        </div>
                        <span className="text-xs tabular-nums text-muted-foreground">{c.confidence}%</span>
                      </div>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusColor[c.status]}>{c.status.replace(/_/g, " ")}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </PageBody>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {selected.caller}
                  <Badge variant="outline" className={intentColor[selected.intent]}>{selected.intent}</Badge>
                </SheetTitle>
                <div className="text-sm text-muted-foreground tabular-nums">
                  {selected.phone} · {formatTime(selected.time)} · {formatDuration(selected.duration)}
                </div>
              </SheetHeader>

              {selected.escalation && (
                <Card className={`mt-4 p-4 border-l-4 ${selected.escalation.type === "complaint" ? "border-l-destructive bg-destructive/5" : "border-l-warning bg-warning/5"}`}>
                  <div className="flex items-start gap-2">
                    <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${selected.escalation.type === "complaint" ? "text-destructive" : "text-warning"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold capitalize">
                          {selected.escalation.type === "complaint" ? "Customer complaint" : "Sales / vendor call"}
                        </span>
                        {selected.escalation.severity && (
                          <Badge variant="outline" className="text-[10px] capitalize">{selected.escalation.severity} severity</Badge>
                        )}
                        <Badge variant="outline" className={selected.escalation.status === "callback_made" ? "bg-success/15 text-success border-success/20" : "bg-warning/15 text-warning border-warning/20"}>
                          {selected.escalation.status.replace(/_/g, " ")}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm">{selected.escalation.summary}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">Alerted {formatTime(selected.escalation.alertedAt)}</span>
                        <span>To: {selected.escalation.alertedTo.join(", ")}</span>
                        <span className="inline-flex items-center gap-1">
                          {selected.escalation.channels.includes("sms") && <><Send className="h-3 w-3" />SMS</>}
                          {selected.escalation.channels.includes("email") && <><Mail className="ml-1 h-3 w-3" />Email</>}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {selected.escalation.status !== "callback_made" && (
                          <Button size="sm" onClick={() => toast.success("Callback marked complete")}>
                            <UserCheck className="mr-1.5 h-3.5 w-3.5" />Mark callback made
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => toast.success("Alert re-sent to manager")}>
                          <Send className="mr-1.5 h-3.5 w-3.5" />Re-send alert
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              )}

              <Tabs defaultValue="transcript" className="mt-5">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="transcript">Transcript</TabsTrigger>
                  <TabsTrigger value="summary">Summary</TabsTrigger>
                  <TabsTrigger value="extracted">Extracted</TabsTrigger>
                  <TabsTrigger value="review">Review</TabsTrigger>
                  <TabsTrigger value="followup">Follow-up</TabsTrigger>
                </TabsList>

                <TabsContent value="transcript" className="mt-4 space-y-3">
                  <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-3">
                    {selected.recordingUrl ? (
                      <Button size="sm" variant="outline" asChild className="h-8">
                        <a href={selected.recordingUrl} target="_blank" rel="noreferrer">
                          <Play className="mr-1.5 h-3.5 w-3.5" />Recording
                        </a>
                      </Button>
                    ) : (
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8 rounded-full"
                        disabled
                        title="Recording not available"
                      >
                        <Play className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <div className="flex-1 h-8 flex items-center gap-0.5">
                      {Array.from({ length: 40 }).map((_, i) => (
                        <div key={i} className="w-0.5 rounded-full bg-primary/40" style={{ height: `${20 + Math.sin(i) * 10 + (i % 5) * 4}%` }} />
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums">{formatDuration(selected.duration)}</span>
                  </div>
                  {selected.transcript.length === 0 && (
                    <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                      <FileText className="mx-auto h-6 w-6 opacity-50" />
                      <p className="mt-2">Transcript not available for this call.</p>
                    </div>
                  )}
                  {selected.transcript.map((t, i) => (
                    <div key={i} className={`flex gap-3 ${t.speaker === "agent" ? "" : "flex-row-reverse"}`}>
                      <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${t.speaker === "agent" ? "bg-muted" : "bg-primary text-primary-foreground"}`}>
                        <div className={`text-[10px] mb-0.5 ${t.speaker === "agent" ? "text-muted-foreground" : "text-primary-foreground/70"}`}>
                          {t.speaker === "agent" ? "Vera (AI)" : t.speaker === "staff" ? "Staff" : selected.caller} · {t.t}
                        </div>
                        {t.text}
                      </div>
                    </div>
                  ))}
                </TabsContent>

                <TabsContent value="summary" className="mt-4">
                  <Card className="p-4">
                    <div className="flex items-start gap-2">
                      <MessageSquare className="mt-0.5 h-4 w-4 text-primary shrink-0" />
                      <div>
                        <div className="text-xs font-medium text-muted-foreground">AI summary</div>
                        <p className="mt-1 text-sm">{selected.summary}</p>
                      </div>
                    </div>
                  </Card>
                </TabsContent>

                <TabsContent value="extracted" className="mt-4">
                  {selected.orderId && (
                    <Card className="p-4">
                      <div className="text-xs font-medium text-muted-foreground">Extracted order</div>
                      <div className="mt-1 text-sm font-medium">Pickup order linked → {selected.orderId}</div>
                      <Button variant="outline" size="sm" className="mt-3">View order</Button>
                    </Card>
                  )}
                  {selected.reservationId && (
                    <Card className="p-4">
                      <div className="text-xs font-medium text-muted-foreground">Extracted reservation</div>
                      <div className="mt-1 text-sm font-medium">Reservation linked → {selected.reservationId}</div>
                      <Button variant="outline" size="sm" className="mt-3">View reservation</Button>
                    </Card>
                  )}
                  {!selected.orderId && !selected.reservationId && (
                    <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                      No structured data was extracted from this call.
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="review" className="mt-4 space-y-4">
                  <Card className="p-4">
                    <div className="mb-3 flex items-start gap-2">
                      <Sparkles className="mt-0.5 h-4 w-4 text-primary" />
                      <div>
                        <div className="text-sm font-semibold">Tune Vera from this call</div>
                        <p className="text-xs text-muted-foreground">
                          Capture what went well, what sounded odd, and what Vera should know next time.
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      {reviewOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setReviewCategory(option.value)}
                          className={`rounded-md border p-3 text-left transition-colors ${
                            reviewCategory === option.value
                              ? "border-primary bg-primary/10 text-foreground"
                              : "border-border bg-background hover:bg-muted/40"
                          }`}
                        >
                          <div className="flex items-center gap-2 text-sm font-medium">
                            {option.value === "good_answer" ? <ThumbsUp className="h-3.5 w-3.5" /> : <MessageSquare className="h-3.5 w-3.5" />}
                            {option.label}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">{option.description}</div>
                        </button>
                      ))}
                    </div>

                    <div className="mt-4 space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground">What happened?</Label>
                      <Textarea
                        value={reviewNote}
                        onChange={(event) => setReviewNote(event.target.value)}
                        placeholder="Example: Caller asked about patio heaters and Vera did not know the answer."
                        rows={3}
                      />
                    </div>

                    <div className="mt-3 space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground">Preferred answer or behavior</Label>
                      <Textarea
                        value={suggestedAnswer}
                        onChange={(event) => setSuggestedAnswer(event.target.value)}
                        placeholder="Example: Yes, the patio has heaters, but seating depends on weather."
                        rows={3}
                      />
                    </div>

                    <div className="mt-3 flex items-start gap-2 rounded-md border border-border bg-muted/30 p-3">
                      <Checkbox
                        checked={addToKnowledge}
                        id="add-to-knowledge"
                        onCheckedChange={(checked) => setAddToKnowledge(checked === true)}
                      />
                      <div className="space-y-1">
                        <Label htmlFor="add-to-knowledge" className="text-sm font-medium">Add this to the knowledge base</Label>
                        <p className="text-xs text-muted-foreground">
                          Use this when the answer should become restaurant knowledge, not just a review note.
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex justify-end">
                      <Button size="sm" onClick={saveFeedback} disabled={!reviewCanSave || feedbackMutation.isPending}>
                        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                        {feedbackMutation.isPending ? "Saving..." : "Save feedback"}
                      </Button>
                    </div>
                  </Card>

                  <Card className="p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="text-sm font-semibold">Review history</div>
                      <Badge variant="secondary" className="text-[10px]">{selectedFeedback.length}</Badge>
                    </div>
                    {feedbackQuery.isFetching && feedbackConfigured && (
                      <div className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                        Loading feedback...
                      </div>
                    )}
                    {!feedbackQuery.isFetching && selectedFeedback.length === 0 && (
                      <div className="rounded-md border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
                        <BookOpen className="mx-auto h-5 w-5 opacity-50" />
                        <p className="mt-2">No tuning notes yet for this call.</p>
                      </div>
                    )}
                    <div className="space-y-2">
                      {selectedFeedback.map((feedback) => (
                        <div key={feedback.id} className="rounded-md border border-border p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <Badge variant="outline">{reviewLabelByCategory[feedback.category]}</Badge>
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {feedback.createdAt ? formatTime(feedback.createdAt) : "Just now"}
                            </span>
                          </div>
                          {feedback.note && <p className="mt-2 text-sm">{feedback.note}</p>}
                          {feedback.suggestedAnswer && (
                            <p className="mt-2 rounded-md bg-muted/40 p-2 text-sm text-muted-foreground">
                              {feedback.suggestedAnswer}
                            </p>
                          )}
                          {feedback.addedToKnowledge && (
                            <div className="mt-2 inline-flex items-center gap-1 text-xs text-primary">
                              <BookOpen className="h-3 w-3" />Added to knowledge base
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </Card>
                </TabsContent>

                <TabsContent value="followup" className="mt-4 space-y-3">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Assign to</label>
                    <Select defaultValue="alex">
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="maria">Maria Lombardi</SelectItem>
                        <SelectItem value="alex">Alex Tran</SelectItem>
                        <SelectItem value="jordan">Jordan Smith</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Internal note</label>
                    <Textarea placeholder="Add a note for the team…" rows={3} />
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button size="sm" onClick={() => toast.success("Marked as resolved")}><UserCheck className="mr-1.5 h-3.5 w-3.5" />Mark resolved</Button>
                    <Button size="sm" variant="outline" onClick={() => toast.success("SMS sent to caller")}><Send className="mr-1.5 h-3.5 w-3.5" />Send SMS</Button>
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
