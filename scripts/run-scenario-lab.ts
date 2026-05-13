import {
  extractScenarioTestMessages,
  getScenarioTestChannel,
  reviewScenarioReplies,
  voiceScenarios,
  type ScenarioChannel,
  type ScenarioPriority,
  type ScenarioReplyReviewTurn,
  type ScenarioVertical,
  type VoiceScenario,
} from "../src/domain/scenario-lab";

interface AgentTestReplyResult {
  actions?: Array<{ type?: string; [key: string]: unknown }>;
  reply?: string;
  transcript?: Array<{ at?: string; role: "assistant" | "user"; text: string }>;
}

interface RunnerOptions {
  baseUrl?: string;
  channel?: ScenarioChannel;
  json: boolean;
  list: boolean;
  locationId?: string;
  priority?: ScenarioPriority;
  scenarioIds: string[];
  strict: boolean;
  vertical?: ScenarioVertical;
}

interface ScenarioRunReport {
  channel: ScenarioChannel;
  id: string;
  issues: string[];
  priority: ScenarioPriority;
  title: string;
  turns: ScenarioReplyReviewTurn[];
  vertical: ScenarioVertical;
}

const options = parseArgs(process.argv.slice(2));

if (options.list) {
  for (const scenario of voiceScenarios) {
    console.log(`${scenario.id.padEnd(34)} ${scenario.priority.padEnd(8)} ${scenario.channel.padEnd(12)} ${scenario.title}`);
  }
  process.exit(0);
}

const baseUrl = (options.baseUrl ?? process.env.VOICE_SERVICE_URL ?? process.env.VITE_VOICE_SERVICE_URL ?? "").replace(/\/$/, "");
if (!baseUrl) {
  console.error("Usage: npm run scenario:lab -- --url https://hostline-voice.onrender.com [--location-id <uuid>]");
  console.error("Auth: set SIGNALHOST_INTERNAL_API_KEY, HOSTLINE_INTERNAL_API_KEY, or SUPABASE_ACCESS_TOKEN.");
  process.exit(1);
}

const selectedScenarios = selectScenarios(options);
if (!selectedScenarios.length) {
  console.error("No scenarios matched those filters. Run with --list to see scenario ids.");
  process.exit(1);
}

const headers = buildHeaders();
if (!headers.Authorization && !headers["x-signalhost-api-key"]) {
  console.warn("Warning: no admin auth header found. Set SIGNALHOST_INTERNAL_API_KEY or SUPABASE_ACCESS_TOKEN if the voice service rejects this request.");
}

const reports: ScenarioRunReport[] = [];
for (const scenario of selectedScenarios) {
  reports.push(await runScenario({ baseUrl, headers, locationId: options.locationId, scenario }));
}

if (options.json) {
  console.log(JSON.stringify({ reports }, null, 2));
} else {
  printReports(reports);
}

const issueCount = reports.reduce((total, report) => total + report.issues.length, 0);
if (options.strict && issueCount) {
  process.exit(2);
}

function parseArgs(args: string[]): RunnerOptions {
  const parsed: RunnerOptions = {
    json: false,
    list: false,
    scenarioIds: [],
    strict: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];

    if (arg === "--url") {
      parsed.baseUrl = next;
      index += 1;
    } else if (arg === "--location-id") {
      parsed.locationId = next;
      index += 1;
    } else if (arg === "--scenario") {
      parsed.scenarioIds.push(...splitList(next));
      index += 1;
    } else if (arg === "--priority") {
      parsed.priority = next as ScenarioPriority;
      index += 1;
    } else if (arg === "--vertical") {
      parsed.vertical = next as ScenarioVertical;
      index += 1;
    } else if (arg === "--channel") {
      parsed.channel = next as ScenarioChannel;
      index += 1;
    } else if (arg === "--json") {
      parsed.json = true;
    } else if (arg === "--strict") {
      parsed.strict = true;
    } else if (arg === "--list") {
      parsed.list = true;
    } else if (!arg.startsWith("--") && !parsed.baseUrl) {
      parsed.baseUrl = arg;
    }
  }

  return parsed;
}

function selectScenarios(options: RunnerOptions) {
  return voiceScenarios.filter((scenario) => {
    if (options.scenarioIds.length && !options.scenarioIds.includes(scenario.id)) return false;
    if (options.priority && scenario.priority !== options.priority) return false;
    if (options.vertical && scenario.vertical !== options.vertical && scenario.vertical !== "all") return false;
    if (options.channel && scenario.channel !== options.channel && scenario.channel !== "both") return false;
    return true;
  });
}

async function runScenario({
  baseUrl,
  headers,
  locationId,
  scenario,
}: {
  baseUrl: string;
  headers: Record<string, string>;
  locationId?: string;
  scenario: VoiceScenario;
}): Promise<ScenarioRunReport> {
  const messages = extractScenarioTestMessages(scenario);
  const turns: ScenarioReplyReviewTurn[] = [];
  let transcript: AgentTestReplyResult["transcript"] = [];

  for (const message of messages) {
    const result = await postAgentTestReply({
      baseUrl,
      body: {
        channel: getScenarioTestChannel(scenario),
        locationId,
        message,
        scenarioId: scenario.id,
        transcript,
      },
      headers,
    });
    const reply = result.reply ?? "";
    turns.push({
      actions: result.actions,
      callerMessage: message,
      reply,
    });
    transcript = result.transcript ?? [
      ...(transcript ?? []),
      { role: "user", text: message },
      { role: "assistant", text: reply },
    ];
  }

  return {
    channel: scenario.channel,
    id: scenario.id,
    issues: reviewScenarioReplies(scenario, turns),
    priority: scenario.priority,
    title: scenario.title,
    turns,
    vertical: scenario.vertical,
  };
}

async function postAgentTestReply({
  baseUrl,
  body,
  headers,
}: {
  baseUrl: string;
  body: Record<string, unknown>;
  headers: Record<string, string>;
}) {
  const response = await fetch(`${baseUrl}/agent/test-reply`, {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    method: "POST",
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`/agent/test-reply returned ${response.status}: ${text.slice(0, 300)}`);
  }
  return JSON.parse(text) as AgentTestReplyResult;
}

function buildHeaders() {
  const internalApiKey = process.env.SIGNALHOST_INTERNAL_API_KEY ?? process.env.HOSTLINE_INTERNAL_API_KEY;
  const supabaseAccessToken = process.env.SUPABASE_ACCESS_TOKEN;
  if (internalApiKey) return { "x-signalhost-api-key": internalApiKey };
  if (supabaseAccessToken) return { Authorization: `Bearer ${supabaseAccessToken}` };
  return {};
}

function printReports(reports: ScenarioRunReport[]) {
  for (const report of reports) {
    const marker = report.issues.length ? "REVIEW" : "OK";
    console.log("");
    console.log(`${marker} ${report.title} (${report.id})`);
    console.log(`Priority: ${report.priority} | Channel: ${report.channel} | Vertical: ${report.vertical}`);

    for (const [index, turn] of report.turns.entries()) {
      console.log(`  ${index + 1}. Caller: ${turn.callerMessage}`);
      console.log(`     Vera: ${singleLine(turn.reply)}`);
      if (turn.actions?.length) {
        console.log(`     Actions: ${turn.actions.map((action) => action.type ?? "action").join(", ")}`);
      }
    }

    if (report.issues.length) {
      console.log("  Review:");
      for (const issue of report.issues) {
        console.log(`   - ${issue}`);
      }
    }
  }

  const issueCount = reports.reduce((total, report) => total + report.issues.length, 0);
  console.log("");
  console.log(`Scenario Lab complete: ${reports.length} scenarios, ${issueCount} review flags.`);
}

function splitList(value?: string) {
  return value?.split(",").map((item) => item.trim()).filter(Boolean) ?? [];
}

function singleLine(value: string) {
  return value.replace(/\s+/g, " ").trim();
}
