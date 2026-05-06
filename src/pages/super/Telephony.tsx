import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Copy, PhoneCall, RefreshCw, ServerCog, Webhook, Wifi, XCircle } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, PageBody } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { tenants } from "@/data/tenants";
import {
  fetchLiveCallConfig,
  fetchTwiMLPreview,
  fetchVoiceServiceHealth,
  isVoiceServiceConfigured,
  voiceServiceBaseUrl,
} from "@/lib/voice-service";

const defaultLocationId = import.meta.env.VITE_SUPABASE_DEMO_LOCATION_ID ?? "";

export default function Telephony() {
  const [locationId, setLocationId] = useState(defaultLocationId);
  const voiceConfigured = isVoiceServiceConfigured();

  const healthQuery = useQuery({
    enabled: voiceConfigured,
    queryFn: fetchVoiceServiceHealth,
    queryKey: ["voice-service-health"],
    refetchInterval: 60_000,
  });

  const liveCallQuery = useQuery({
    enabled: voiceConfigured,
    queryFn: () => fetchLiveCallConfig(locationId),
    queryKey: ["live-call-config", locationId],
  });

  const twimlQuery = useQuery({
    enabled: voiceConfigured,
    queryFn: () => fetchTwiMLPreview(locationId),
    queryKey: ["twiml-preview", locationId],
  });

  const refreshAll = () => {
    void healthQuery.refetch();
    void liveCallQuery.refetch();
    void twimlQuery.refetch();
  };

  const config = liveCallQuery.data;
  const readyCount = healthQuery.data?.readinessChecks?.filter((check) => check.ready).length ?? 0;
  const totalChecks = healthQuery.data?.readinessChecks?.length ?? 0;

  return (
    <>
      <PageHeader
        title="Telephony"
        description="Twilio numbers, live-call webhook, and ConversationRelay readiness"
        actions={
          <Button size="sm" variant="outline" onClick={refreshAll} disabled={!voiceConfigured || healthQuery.isFetching || liveCallQuery.isFetching}>
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${healthQuery.isFetching || liveCallQuery.isFetching ? "animate-spin" : ""}`} />
            Check service
          </Button>
        }
      />
      <PageBody>
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-5">
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <PhoneCall className="h-4 w-4 text-primary" />
                    First live call
                  </CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">Active location and Twilio webhook targets</p>
                </div>
                <Badge
                  variant="outline"
                  className={config?.ready ? "border-success/30 bg-success/10 text-success" : "border-warning/30 bg-warning/10 text-warning"}
                >
                  {config?.ready ? "Webhook ready" : voiceConfigured ? "Needs deploy URL" : "Not connected"}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                  <div className="space-y-1.5">
                    <Label htmlFor="location-id">Location ID</Label>
                    <Input
                      id="location-id"
                      className="font-mono text-xs"
                      placeholder="Supabase locations.id"
                      value={locationId}
                      onChange={(event) => setLocationId(event.target.value)}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button variant="outline" onClick={refreshAll} disabled={!voiceConfigured}>
                      Refresh
                    </Button>
                  </div>
                </div>

                <UrlRow label="Voice service" value={voiceServiceBaseUrl || "Set VITE_VOICE_SERVICE_URL"} />
                <UrlRow label="Twilio Voice webhook" value={config?.voiceWebhookUrl ?? "Unavailable"} />
                <UrlRow label="ConversationRelay websocket" value={config?.conversationRelayUrl ?? "Unavailable"} />
                <UrlRow label="Conversation ended callback" value={config?.actionUrl ?? "Unavailable"} />

                {liveCallQuery.isError && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {liveCallQuery.error instanceof Error ? liveCallQuery.error.message : "Live call config failed."}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Webhook className="h-4 w-4 text-primary" />
                  TwiML preview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="max-h-80 overflow-auto rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                  {twimlQuery.data ?? (voiceConfigured ? "Loading TwiML..." : "Set VITE_VOICE_SERVICE_URL")}
                </pre>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">AI host numbers</CardTitle></CardHeader>
              <CardContent>
                <div className="divide-y divide-border rounded-md border border-border">
                  {tenants.map((tenant) => (
                    <div key={tenant.id} className="flex items-center justify-between gap-3 p-3">
                      <div>
                        <div className="text-sm font-medium">{tenant.name}</div>
                        <div className="font-mono text-xs text-muted-foreground">{tenant.aiNumber}</div>
                      </div>
                      <Badge variant="outline" className="border-success/30 bg-success/10 text-success">Active</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-5">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ServerCog className="h-4 w-4 text-primary" />
                  Voice service
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <StatusRow label="Health" ready={Boolean(healthQuery.data?.ok)} value={healthQuery.data?.ok ? "Online" : voiceConfigured ? "Checking" : "Not connected"} />
                <StatusRow label="Production readiness" ready={Boolean(healthQuery.data?.productionReady)} value={healthQuery.data?.productionReady ? "Ready" : `${readyCount}/${totalChecks || 11} checks`} />
                <StatusRow label="Twilio signatures" ready={Boolean(healthQuery.data?.twilioSignatureRequired)} value={healthQuery.data?.twilioSignatureRequired ? "Required" : "Not required"} />
                <StatusRow label="OpenAI" ready={Boolean(healthQuery.data?.openaiConfigured)} value={healthQuery.data?.openaiConfigured ? "Configured" : "Missing"} />
                <StatusRow label="ElevenLabs" ready={Boolean(healthQuery.data?.elevenLabsConfigured)} value={healthQuery.data?.elevenLabsConfigured ? "Configured" : "Missing"} />
                <StatusRow label="Supabase context" ready={Boolean(healthQuery.data?.onboardedContextConfigured)} value={healthQuery.data?.onboardedContextConfigured ? "Configured" : "Missing"} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Wifi className="h-4 w-4 text-primary" />
                  Live call checklist
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <ChecklistRow ready={Boolean(config?.voiceWebhookUrl)} label="Webhook URL generated" />
                <ChecklistRow ready={Boolean(config?.conversationRelayUrl)} label="Websocket URL generated" />
                <ChecklistRow ready={Boolean(twimlQuery.data?.includes("<ConversationRelay"))} label="ConversationRelay TwiML renders" />
                <ChecklistRow ready={Boolean(healthQuery.data?.productionReady)} label="Required service checks pass" />
                <ChecklistRow ready={Boolean(config?.twilioSignatureRequired)} label="Twilio signatures enforced" />
              </CardContent>
            </Card>
          </div>
        </div>
      </PageBody>
    </>
  );
}

function UrlRow({ label, value }: { label: string; value: string }) {
  const canCopy = value && value !== "Unavailable" && !value.startsWith("Set ");
  return (
    <div className="rounded-md border border-border p-3">
      <div className="mb-1 text-xs font-medium text-muted-foreground">{label}</div>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-xs">{value}</code>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={!canCopy}
          onClick={() => copyToClipboard(value)}
          title={`Copy ${label}`}
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function StatusRow({ label, ready, value }: { label: string; ready: boolean; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{value}</div>
      </div>
      {ready ? <CheckCircle2 className="h-4 w-4 text-success" /> : <XCircle className="h-4 w-4 text-warning" />}
    </div>
  );
}

function ChecklistRow({ label, ready }: { label: string; ready: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
      <div className="text-sm">{label}</div>
      {ready ? <CheckCircle2 className="h-4 w-4 text-success" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}
    </div>
  );
}

async function copyToClipboard(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success("Copied");
  } catch {
    toast.error("Copy failed");
  }
}
