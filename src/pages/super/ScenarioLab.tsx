import { useMemo, useState } from "react";
import { PageBody, PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  buildScenarioReport,
  defaultScenarioTestMessage,
  extractScenarioTestMessages,
  getScenarioNextTestMessage,
  getScenarioTestChannel,
  summarizeScenarioRuns,
  voiceScenarios,
  type ScenarioChannel,
  type ScenarioPriority,
  type ScenarioRunState,
  type ScenarioStatus,
  type ScenarioVertical,
  type VoiceScenario,
} from "@/domain/scenario-lab";
import {
  fetchAgentTestReply,
  isVoiceServiceConfigured,
  type AgentTestAction,
  type AgentTestTurn,
} from "@/lib/voice-service";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clipboard,
  FileText,
  ListChecks,
  Loader2,
  MessageSquare,
  PhoneCall,
  RefreshCw,
  Search,
  Send,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

type ScenarioFilter = "all" | ScenarioStatus;
type ChannelFilter = "all" | ScenarioChannel;
type VerticalFilter = "all" | ScenarioVertical;

const storageKey = "signalhost.scenarioLab.v1";

export default function ScenarioLab() {
  const [runs, setRuns] = useState<Record<string, ScenarioRunState>>(() => loadScenarioRuns());
  const [statusFilter, setStatusFilter] = useState<ScenarioFilter>("all");
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("all");
  const [verticalFilter, setVerticalFilter] = useState<VerticalFilter>("all");
  const [search, setSearch] = useState("");
  const summary = summarizeScenarioRuns(voiceScenarios, runs);

  const filteredScenarios = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return voiceScenarios.filter((scenario) => {
      const status = runs[scenario.id]?.status ?? "untested";
      if (statusFilter !== "all" && status !== statusFilter) return false;
      if (channelFilter !== "all" && scenario.channel !== channelFilter && scenario.channel !== "both") return false;
      if (verticalFilter !== "all" && scenario.vertical !== verticalFilter && scenario.vertical !== "all") return false;
      if (!needle) return true;
      return [
        scenario.title,
        scenario.callerScript.join(" "),
        scenario.expectedBehavior.join(" "),
        scenario.tags.join(" "),
        runs[scenario.id]?.notes ?? "",
      ].some((value) => value.toLowerCase().includes(needle));
    });
  }, [channelFilter, runs, search, statusFilter, verticalFilter]);

  const updateRun = (scenarioId: string, patch: Partial<ScenarioRunState>) => {
    setRuns((current) => {
      const next = {
        ...current,
        [scenarioId]: {
          lastRunAt: new Date().toISOString(),
          notes: current[scenarioId]?.notes,
          status: "untested",
          ...current[scenarioId],
          ...patch,
        },
      };
      saveScenarioRuns(next);
      return next;
    });
  };

  const clearRuns = () => {
    setRuns({});
    saveScenarioRuns({});
    toast.success("Scenario results reset");
  };

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(buildScenarioReport(voiceScenarios, runs));
      toast.success("Scenario report copied");
    } catch {
      toast.error("Could not copy report");
    }
  };

  return (
    <>
      <PageHeader
        title="Scenario Lab"
        description="Repeatable call and chat tests for the behaviors we cannot afford to regress"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={copyReport}>
              <FileText className="mr-1.5 h-3.5 w-3.5" />
              Copy report
            </Button>
            <Button variant="outline" size="sm" onClick={clearRuns}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Reset
            </Button>
          </div>
        }
      />
      <PageBody className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MiniStat icon={ListChecks} label="Scenarios" value={summary.total} />
          <MiniStat icon={CheckCircle2} label="Passed" value={summary.passed} tone="success" />
          <MiniStat icon={XCircle} label="Needs work" value={summary.needs_work} tone={summary.needs_work ? "danger" : "default"} />
          <MiniStat icon={AlertTriangle} label="Open critical" value={summary.openCritical} tone={summary.openCritical ? "warning" : "success"} />
          <MiniStat icon={MessageSquare} label="Untested" value={summary.untested} />
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ListChecks className="h-4 w-4 text-primary" />
                  Test run
                </CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  Use these after deploys, prompt changes, and voice tuning. Results are saved locally in this browser.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input className="h-9 w-64 pl-8" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search scenarios..." />
                </div>
                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as ScenarioFilter)}>
                  <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="untested">Untested</SelectItem>
                    <SelectItem value="passed">Passed</SelectItem>
                    <SelectItem value="needs_work">Needs work</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={channelFilter} onValueChange={(value) => setChannelFilter(value as ChannelFilter)}>
                  <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All channels</SelectItem>
                    <SelectItem value="phone">Phone</SelectItem>
                    <SelectItem value="website_chat">Website chat</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={verticalFilter} onValueChange={(value) => setVerticalFilter(value as VerticalFilter)}>
                  <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All verticals</SelectItem>
                    <SelectItem value="restaurants">Restaurants</SelectItem>
                    <SelectItem value="home_services">Home services</SelectItem>
                    <SelectItem value="salons">Salons</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredScenarios.length === 0 ? (
              <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                No scenarios match those filters.
              </div>
            ) : (
              <div className="grid gap-4 xl:grid-cols-2">
                {filteredScenarios.map((scenario) => (
                  <ScenarioCard
                    key={scenario.id}
                    run={runs[scenario.id]}
                    scenario={scenario}
                    onUpdate={(patch) => updateRun(scenario.id, patch)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}

function ScenarioCard({
  onUpdate,
  run,
  scenario,
}: {
  onUpdate: (patch: Partial<ScenarioRunState>) => void;
  run?: ScenarioRunState;
  scenario: VoiceScenario;
}) {
  const status = run?.status ?? "untested";
  const voiceConfigured = isVoiceServiceConfigured();
  const [testMessage, setTestMessage] = useState(() => defaultScenarioTestMessage(scenario));
  const [testTranscript, setTestTranscript] = useState<AgentTestTurn[]>([]);
  const [testReply, setTestReply] = useState("");
  const [testActions, setTestActions] = useState<AgentTestAction[]>([]);
  const [isTesting, setIsTesting] = useState(false);
  const scriptPromptCount = extractScenarioTestMessages(scenario).length;
  const completedUserTurns = testTranscript.filter((turn) => turn.role === "user").length;
  const nextScriptPrompt = getScenarioNextTestMessage(scenario, completedUserTurns);

  const copyScript = async () => {
    try {
      await navigator.clipboard.writeText(buildScenarioScript(scenario));
      toast.success("Scenario script copied");
    } catch {
      toast.error("Could not copy script");
    }
  };

  const runAgentTest = async () => {
    const message = testMessage.trim();
    if (!message) return;

    setIsTesting(true);
    try {
      const result = await fetchAgentTestReply({
        channel: getScenarioTestChannel(scenario),
        message,
        scenarioId: scenario.id,
        transcript: testTranscript,
      });
      setTestReply(result.reply);
      setTestActions(result.actions);
      setTestTranscript(result.transcript);
      toast.success("Vera reply tested");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not test Vera's reply");
    } finally {
      setIsTesting(false);
    }
  };

  const appendTestToNotes = () => {
    const actionSummary = testActions.length ? `\nActions: ${testActions.map(labelAgentTestAction).join(", ")}` : "";
    const note = `\n\nBrain test\nCaller: ${testMessage}\nVera: ${testReply}${actionSummary}`.trim();
    onUpdate({ notes: [run?.notes?.trim(), note].filter(Boolean).join("\n\n") });
    toast.success("Test result added to notes");
  };

  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={priorityClass(scenario.priority)}>{scenario.priority}</Badge>
            <Badge variant="secondary" className="text-[10px]">{channelLabel(scenario.channel)}</Badge>
            <Badge variant="outline" className={statusClass(status)}>{status.replace(/_/g, " ")}</Badge>
          </div>
          <h3 className="mt-2 text-base font-semibold">{scenario.title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{scenario.tags.join(" / ")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={copyScript}>
          <Clipboard className="mr-1.5 h-3.5 w-3.5" />
          Copy
        </Button>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <ScenarioBlock title="Caller script" items={scenario.callerScript} />
        <ScenarioBlock title="Expected behavior" items={scenario.expectedBehavior} />
      </div>

      <div className="mt-4 rounded-md border border-primary/15 bg-primary/5 p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Bot className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div>
              <div className="text-[11px] font-medium uppercase text-muted-foreground">Brain test</div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Send one turn to the live voice service without creating real orders, texts, or callbacks.
              </p>
            </div>
            <Textarea
              value={testMessage}
              onChange={(event) => setTestMessage(event.target.value)}
              rows={2}
              placeholder="Type what the caller or website visitor says..."
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                onClick={runAgentTest}
                disabled={!voiceConfigured || isTesting || !testMessage.trim()}
              >
                {isTesting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5" />}
                Test reply
              </Button>
              {testTranscript.length ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setTestTranscript([]);
                    setTestReply("");
                    setTestActions([]);
                  }}
                >
                  Reset chat
                </Button>
              ) : null}
              {nextScriptPrompt && nextScriptPrompt !== testMessage ? (
                <Button size="sm" variant="outline" onClick={() => setTestMessage(nextScriptPrompt)}>
                  Next script prompt
                </Button>
              ) : null}
              {scriptPromptCount ? (
                <span className="text-xs text-muted-foreground">
                  {Math.min(completedUserTurns + 1, scriptPromptCount)} of {scriptPromptCount}
                </span>
              ) : null}
              {!voiceConfigured ? (
                <span className="text-xs text-muted-foreground">Set VITE_VOICE_SERVICE_URL to enable this.</span>
              ) : null}
            </div>
            {testReply ? (
              <div className="rounded-md border border-border bg-background p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[11px] font-medium uppercase text-muted-foreground">Vera would say</div>
                    <p className="mt-1 text-sm">{testReply}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={appendTestToNotes}>
                    Add to notes
                  </Button>
                </div>
                {testActions.length ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {testActions.map((action, index) => (
                      <Badge key={`${action.type}-${index}`} variant="outline" className="bg-muted/50 text-[10px]">
                        {labelAgentTestAction(action)}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-md bg-muted/40 p-3">
        <div className="mb-2 text-[11px] font-medium uppercase text-muted-foreground">Listen for</div>
        <div className="flex flex-wrap gap-1.5">
          {scenario.listenFor.map((item) => (
            <Badge key={item} variant="outline" className="bg-background text-[10px]">{item}</Badge>
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <div className="text-[11px] font-medium uppercase text-muted-foreground">Run notes</div>
        <Textarea
          value={run?.notes ?? ""}
          onChange={(event) => onUpdate({ notes: event.target.value })}
          placeholder="What happened on the test call?"
          rows={3}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <Button size="sm" variant={status === "passed" ? "default" : "outline"} onClick={() => onUpdate({ status: "passed" })}>
            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
            Pass
          </Button>
          <Button size="sm" variant={status === "needs_work" ? "destructive" : "outline"} onClick={() => onUpdate({ status: "needs_work" })}>
            <XCircle className="mr-1.5 h-3.5 w-3.5" />
            Needs work
          </Button>
        </div>
        <div className="text-xs text-muted-foreground">
          {run?.lastRunAt ? `Last run ${formatRunTime(run.lastRunAt)}` : "Not run yet"}
        </div>
      </div>
    </div>
  );
}

function ScenarioBlock({ items, title }: { items: string[]; title: string }) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="mb-2 text-[11px] font-medium uppercase text-muted-foreground">{title}</div>
      <ol className="space-y-1 text-sm">
        {items.map((item, index) => (
          <li key={`${item}-${index}`} className="flex gap-2">
            <span className="text-xs tabular-nums text-muted-foreground">{index + 1}.</span>
            <span>{item}</span>
          </li>
        ))}
      </ol>
    </div>
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
  tone?: "danger" | "default" | "success" | "warning";
  value: number;
}) {
  const toneClass =
    tone === "success"
      ? "bg-success/10 text-success"
      : tone === "warning"
        ? "bg-warning/15 text-warning"
        : tone === "danger"
          ? "bg-destructive/10 text-destructive"
          : "bg-primary/10 text-primary";

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-medium uppercase text-muted-foreground">{label}</div>
            <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
          </div>
          <div className={cn("flex h-8 w-8 items-center justify-center rounded-md", toneClass)}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function buildScenarioScript(scenario: VoiceScenario) {
  return [
    scenario.title,
    "",
    "Caller script:",
    ...scenario.callerScript.map((item, index) => `${index + 1}. ${item}`),
    "",
    "Expected behavior:",
    ...scenario.expectedBehavior.map((item, index) => `${index + 1}. ${item}`),
    "",
    `Listen for: ${scenario.listenFor.join(", ")}`,
  ].join("\n");
}

function labelAgentTestAction(action: AgentTestAction) {
  if (action.type === "business_link") return `link: ${action.link.label}`;
  if (action.type === "guest_confirmation") return `text: ${action.kind}`;
  if (action.type === "customer_request") return `request: ${action.requestType}`;
  if (action.type === "staff_callback") return `staff callback: ${action.kind}`;
  if (action.type === "reservation_request") return "reservation request";
  if (action.type === "order_capture") return `order capture: ${action.itemCount}`;
  if (action.type === "pickup_order") return "pickup order";
  if (action.type === "finish_call") return "finish call";
  return "action";
}

function loadScenarioRuns() {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) ?? "{}") as Record<string, ScenarioRunState>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveScenarioRuns(runs: Record<string, ScenarioRunState>) {
  localStorage.setItem(storageKey, JSON.stringify(runs));
}

function priorityClass(priority: ScenarioPriority) {
  if (priority === "critical") return "border-destructive/30 bg-destructive/10 text-destructive";
  if (priority === "high") return "border-warning/30 bg-warning/10 text-warning";
  return "border-border bg-muted text-muted-foreground";
}

function statusClass(status: ScenarioStatus) {
  if (status === "passed") return "border-success/30 bg-success/10 text-success";
  if (status === "needs_work") return "border-destructive/30 bg-destructive/10 text-destructive";
  return "border-border bg-muted text-muted-foreground";
}

function channelLabel(channel: ScenarioChannel) {
  if (channel === "website_chat") return "website chat";
  return channel;
}

function formatRunTime(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      month: "short",
    }).format(new Date(value));
  } catch {
    return "recently";
  }
}
