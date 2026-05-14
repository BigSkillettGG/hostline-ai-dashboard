import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  ClipboardCheck,
  Copy,
  MailCheck,
  MessageSquareText,
  PhoneCall,
  RefreshCw,
  ServerCog,
  TimerReset,
  Trash2,
  Webhook,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader, PageBody } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buildFirstCallReadiness, type FirstCallReadinessStep } from "@/domain/first-call-readiness";
import { buildPilotReadiness, type PilotReadinessStep } from "@/domain/pilot-readiness";
import {
  fetchCallFeedbackFromSupabase,
  fetchCallsFromSupabase,
  fetchPhoneNumbersFromSupabase,
  isSupabaseConfigured,
  type PhoneNumberRecord,
} from "@/lib/supabase-rest";
import {
  fetchLiveCallConfig,
  attachExistingVoicePhoneNumber,
  fetchEmailReadiness,
  fetchOpenAIRealtimeLiveCallConfig,
  fetchOpenAIRealtimePreflight,
  fetchTwiMLPreview,
  fetchVoiceServiceHealth,
  isVoiceServiceConfigured,
  releaseVoicePhoneNumber,
  voiceServiceBaseUrl,
} from "@/lib/voice-service";

const defaultLocationId = import.meta.env.VITE_SUPABASE_DEMO_LOCATION_ID ?? "";

export default function Telephony() {
  const queryClient = useQueryClient();
  const [locationId, setLocationId] = useState(defaultLocationId);
  const [attachPhoneNumber, setAttachPhoneNumber] = useState("");
  const [attachProviderSid, setAttachProviderSid] = useState("");
  const voiceConfigured = isVoiceServiceConfigured();
  const supabaseConfigured = isSupabaseConfigured();

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

  const realtimeConfigQuery = useQuery({
    enabled: voiceConfigured,
    queryFn: () => fetchOpenAIRealtimeLiveCallConfig(locationId),
    queryKey: ["openai-realtime-live-call-config", locationId],
  });

  const realtimePreflightQuery = useQuery({
    enabled: voiceConfigured,
    queryFn: () => fetchOpenAIRealtimePreflight(locationId),
    queryKey: ["openai-realtime-preflight", locationId],
  });

  const twimlQuery = useQuery({
    enabled: voiceConfigured,
    queryFn: () => fetchTwiMLPreview(locationId),
    queryKey: ["twiml-preview", locationId],
  });

  const emailReadinessQuery = useQuery({
    enabled: voiceConfigured,
    queryFn: () => fetchEmailReadiness(locationId),
    queryKey: ["email-readiness", locationId],
  });

  const phoneNumbersQuery = useQuery({
    enabled: supabaseConfigured && Boolean(locationId.trim()),
    queryFn: () => fetchPhoneNumbersFromSupabase(locationId),
    queryKey: ["phone-numbers", locationId],
  });

  const pilotCallsQuery = useQuery({
    enabled: supabaseConfigured && Boolean(locationId.trim()),
    queryFn: () => fetchCallsFromSupabase(locationId),
    queryKey: ["pilot-readiness-calls", locationId],
    refetchInterval: 30_000,
  });
  const latestPilotCall = pilotCallsQuery.data?.[0];
  const pilotFeedbackQuery = useQuery({
    enabled: supabaseConfigured && Boolean(latestPilotCall?.id),
    queryFn: () => fetchCallFeedbackFromSupabase(latestPilotCall!.id),
    queryKey: ["pilot-readiness-feedback", latestPilotCall?.id],
  });

  const releaseMutation = useMutation({
    mutationFn: releaseVoicePhoneNumber,
    onSuccess: async () => {
      toast.success("Number released");
      await queryClient.invalidateQueries({ queryKey: ["phone-numbers"] });
      await queryClient.invalidateQueries({ queryKey: ["voice-service-health"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not release number");
    },
  });

  const attachMutation = useMutation({
    mutationFn: attachExistingVoicePhoneNumber,
    onSuccess: async () => {
      toast.success("SignalHost number attached");
      setAttachPhoneNumber("");
      setAttachProviderSid("");
      await queryClient.invalidateQueries({ queryKey: ["phone-numbers"] });
      await queryClient.invalidateQueries({ queryKey: ["pilot-readiness-calls"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not attach number");
    },
  });

  const refreshAll = () => {
    void healthQuery.refetch();
    void emailReadinessQuery.refetch();
    void liveCallQuery.refetch();
    void realtimeConfigQuery.refetch();
    void realtimePreflightQuery.refetch();
    void twimlQuery.refetch();
    void phoneNumbersQuery.refetch();
    if (locationId.trim()) void pilotCallsQuery.refetch();
    if (latestPilotCall?.id) void pilotFeedbackQuery.refetch();
  };

  const config = liveCallQuery.data;
  const readyCount = healthQuery.data?.readinessChecks?.filter((check) => check.ready).length ?? 0;
  const totalChecks = healthQuery.data?.readinessChecks?.length ?? 0;
  const firstCallReadiness = buildFirstCallReadiness({
    health: healthQuery.data,
    liveCallConfig: config,
    locationId,
    openAIRealtimeConfig: realtimeConfigQuery.data,
    twimlPreview: twimlQuery.data,
    voiceConfigured,
  });
  const sharedSmsWebhookUrl = voiceServiceBaseUrl ? `${voiceServiceBaseUrl}/twilio/sms` : "Set VITE_VOICE_SERVICE_URL";
  const expiredTrialReleaseUrl = voiceServiceBaseUrl ? `${voiceServiceBaseUrl}/telephony/release-expired-trials` : "Set VITE_VOICE_SERVICE_URL";
  const emailReadiness = emailReadinessQuery.data;
  const pilotReadiness = buildPilotReadiness({
    calls: pilotCallsQuery.data ?? [],
    emailReadiness,
    feedback: pilotFeedbackQuery.data ?? [],
    health: healthQuery.data,
    locationId,
    phoneNumbers: phoneNumbersQuery.data ?? [],
    realtimeConfig: realtimeConfigQuery.data,
    realtimePreflight: realtimePreflightQuery.data,
    supabaseConfigured,
    voiceConfigured,
  });

  const releaseNumber = (record: PhoneNumberRecord) => {
    if (!record.providerSid) {
      toast.error("This number is missing its Twilio provider SID.");
      return;
    }
    const confirmed = window.confirm(`Release ${record.phoneNumber}? This gives the Twilio number back and callers will no longer reach this location through it.`);
    if (!confirmed) return;

    releaseMutation.mutate({
      id: record.id,
      locationId,
      phoneNumber: record.phoneNumber,
      providerSid: record.providerSid,
      releaseReason: "manual_dashboard_release",
    });
  };

  const attachExistingNumber = () => {
    const phoneNumber = attachPhoneNumber.trim();
    if (!phoneNumber) {
      toast.error("Enter the Twilio phone number first.");
      return;
    }
    attachMutation.mutate({
      locationId,
      phoneNumber,
      providerSid: attachProviderSid.trim() || undefined,
    });
  };

  return (
    <>
      <PageHeader
        title="Telephony"
        description="OpenAI Realtime SIP, Twilio numbers, and live-call logging readiness"
        actions={
          <Button size="sm" variant="outline" onClick={refreshAll} disabled={!voiceConfigured || healthQuery.isFetching || liveCallQuery.isFetching || realtimeConfigQuery.isFetching}>
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${healthQuery.isFetching || liveCallQuery.isFetching || realtimeConfigQuery.isFetching ? "animate-spin" : ""}`} />
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
                  <p className="mt-1 text-xs text-muted-foreground">Active location, OpenAI SIP webhook, and fallback Twilio targets</p>
                </div>
                <Badge
                  variant="outline"
                  className={realtimeConfigQuery.data?.ready ? "border-success/30 bg-success/10 text-success" : "border-warning/30 bg-warning/10 text-warning"}
                >
                  {realtimeConfigQuery.data?.ready ? "Realtime ready" : voiceConfigured ? "Needs deploy URL" : "Not connected"}
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
                <UrlRow label="OpenAI Realtime webhook" value={realtimeConfigQuery.data?.webhookUrl ?? "Unavailable"} />
                <UrlRow label="OpenAI SIP URI" value={realtimeConfigQuery.data?.sipUri ?? "Set OPENAI_PROJECT_ID or use the OpenAI project SIP URI"} />
                <UrlRow label="Fallback Twilio Voice webhook" value={config?.voiceWebhookUrl ?? "Unavailable"} />

                {liveCallQuery.isError && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {liveCallQuery.error instanceof Error ? liveCallQuery.error.message : "Live call config failed."}
                  </div>
                )}
                {realtimeConfigQuery.isError && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {realtimeConfigQuery.error instanceof Error ? realtimeConfigQuery.error.message : "OpenAI Realtime config failed."}
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
              <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <PhoneCall className="h-4 w-4 text-primary" />
                    Number lifecycle
                  </CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">Trial timing, forwarding status, and release controls for this location.</p>
                </div>
                <Badge variant="outline" className={phoneNumbersQuery.data?.length ? "border-success/30 bg-success/10 text-success" : "bg-muted text-muted-foreground"}>
                  {phoneNumbersQuery.data?.length ? `${phoneNumbersQuery.data.length} number${phoneNumbersQuery.data.length === 1 ? "" : "s"}` : "No live rows"}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                {phoneNumbersQuery.isError && (
                  <div className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
                    {phoneNumbersQuery.error instanceof Error ? phoneNumbersQuery.error.message : "Phone numbers could not be loaded."}
                  </div>
                )}
                <div className="rounded-md border border-border bg-muted/20 p-3">
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                    <div className="space-y-1.5">
                      <Label htmlFor="attach-phone-number">Attach existing Twilio number</Label>
                      <Input
                        id="attach-phone-number"
                        placeholder="+1 617 555 0100"
                        value={attachPhoneNumber}
                        onChange={(event) => setAttachPhoneNumber(event.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="attach-provider-sid">Twilio SID optional</Label>
                      <Input
                        id="attach-provider-sid"
                        className="font-mono text-xs"
                        placeholder="PN..."
                        value={attachProviderSid}
                        onChange={(event) => setAttachProviderSid(event.target.value)}
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        variant="outline"
                        onClick={attachExistingNumber}
                        disabled={!voiceConfigured || !locationId.trim() || attachMutation.isPending}
                      >
                        {attachMutation.isPending ? <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <ClipboardCheck className="mr-1.5 h-3.5 w-3.5" />}
                        Attach
                      </Button>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Use this when the number already exists in Twilio/OpenAI SIP and only needs to be saved for dashboard readiness.
                  </p>
                </div>
                {(phoneNumbersQuery.data ?? []).map((record) => (
                  <PhoneNumberLifecycleRow
                    key={record.id}
                    busy={releaseMutation.isPending}
                    onRelease={releaseNumber}
                    record={record}
                  />
                ))}
                {!phoneNumbersQuery.isLoading && !(phoneNumbersQuery.data ?? []).length && (
                  <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                    No provisioned SignalHost number is saved for this location yet.
                  </div>
                )}
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
                <StatusRow label="OpenAI voice" ready={Boolean(healthQuery.data?.openAIVoiceConfigured ?? healthQuery.data?.openaiConfigured)} value={(healthQuery.data?.openAIVoiceConfigured ?? healthQuery.data?.openaiConfigured) ? "Configured" : "Missing"} />
                <StatusRow label="OpenAI Realtime SIP" ready={Boolean(healthQuery.data?.openAIRealtimeSipConfigured || realtimePreflightQuery.data?.ready)} value={realtimePreflightQuery.data?.ready ? "Preflight ready" : healthQuery.data?.openAIRealtimeSipConfigured ? "Configured" : "Missing"} />
                <StatusRow label="Supabase context" ready={Boolean(healthQuery.data?.onboardedContextConfigured)} value={healthQuery.data?.onboardedContextConfigured ? "Configured" : "Missing"} />
                <StatusRow label="Shared SMS routing" ready={Boolean(healthQuery.data?.sharedSmsRoutingConfigured)} value={healthQuery.data?.sharedSmsRoutingConfigured ? "Configured" : "Needs sender + Supabase"} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <MessageSquareText className="h-4 w-4 text-primary" />
                  Shared texting
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <StatusRow
                  label="Routing mode"
                  ready={Boolean(healthQuery.data?.sharedSmsRoutingConfigured)}
                  value={healthQuery.data?.sharedSmsRoutingConfigured ? "One sender, thread-routed replies" : "Not fully configured"}
                />
                <UrlRow label="Twilio Messaging webhook" value={sharedSmsWebhookUrl} />
                <div className="rounded-md border border-border p-3 text-xs text-muted-foreground">
                  In Twilio, set the shared texting number or Messaging Service inbound message webhook to this URL using HTTP POST.
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <MailCheck className="h-4 w-4 text-primary" />
                    Agent email
                  </CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">Resend receiving, owner-command routing, and email replies.</p>
                </div>
                <Badge
                  variant="outline"
                  className={emailReadiness?.ready ? "border-success/30 bg-success/10 text-success" : "border-warning/30 bg-warning/10 text-warning"}
                >
                  {emailReadiness?.ready ? "Ready" : voiceConfigured ? "Needs setup" : "Not connected"}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                <UrlRow label="Resend inbound webhook" value={emailReadiness?.webhookUrl ?? (voiceConfigured ? "Unavailable" : "Set VITE_VOICE_SERVICE_URL")} />
                <UrlRow label="Receiving domain" value={emailReadiness?.receivingDomain ?? "agents.signalhost.ai"} />
                <UrlRow label="Fallback agent inbox" value={emailReadiness?.fallbackInboundAddress ?? "Set OWNER_EMAIL_INBOUND_ADDRESS"} />
                <UrlRow label="Outbound from" value={emailReadiness?.outboundFrom ?? "Set EMAIL_FROM"} />

                <div className="grid gap-2">
                  {(emailReadiness?.checks ?? []).map((check) => (
                    <StatusRow key={check.id} label={check.label} ready={check.ready} value={check.ready ? "Configured" : check.detail} />
                  ))}
                </div>

                <div className="rounded-md border border-border p-3 text-xs text-muted-foreground">
                  <div className="mb-2 font-medium text-foreground">Activation steps</div>
                  <ol className="list-decimal space-y-1 pl-4">
                    {(emailReadiness?.setupSteps ?? [
                      "Set VITE_VOICE_SERVICE_URL so the dashboard can load email readiness.",
                    ]).map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                </div>

                {emailReadinessQuery.isError && (
                  <div className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
                    {emailReadinessQuery.error instanceof Error ? emailReadinessQuery.error.message : "Email readiness could not be loaded."}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TimerReset className="h-4 w-4 text-primary" />
                  Trial cleanup
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <UrlRow label="Expired-trial release endpoint" value={expiredTrialReleaseUrl} />
                <div className="rounded-md border border-border p-3 text-xs text-muted-foreground">
                  This endpoint is intentionally internal-key protected. Use it from Render cron or a manual ops call with <code className="font-mono">x-signalhost-api-key</code>. Send <code className="font-mono">{`{"dryRun":true}`}</code> first to preview releases. Active, trialing, past-due, checkout-started, and incomplete Stripe accounts are skipped.
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ClipboardCheck className="h-4 w-4 text-primary" />
                  Pilot readiness
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                  <div>
                    <div className="text-sm font-medium">
                      {pilotReadiness.requiredReadyCount}/{pilotReadiness.requiredTotal} pilot checks
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{pilotReadiness.nextAction}</div>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      pilotReadiness.ready
                        ? "border-success/30 bg-success/10 text-success"
                        : "border-warning/30 bg-warning/10 text-warning"
                    }
                  >
                    {pilotReadiness.ready ? "Ready to pilot" : "Needs setup"}
                  </Badge>
                </div>

                <div className="grid gap-2">
                  {pilotReadiness.steps.map((step) => (
                    <PilotReadinessRow key={step.id} step={step} />
                  ))}
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/super/calls">Review live calls</Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/super/qa">Open QA loop</Link>
                  </Button>
                </div>

                {pilotCallsQuery.isError && (
                  <div className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
                    {pilotCallsQuery.error instanceof Error ? pilotCallsQuery.error.message : "Pilot calls could not be loaded."}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ClipboardCheck className="h-4 w-4 text-primary" />
                  First-call route checks
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                  <div>
                    <div className="text-sm font-medium">
                      {firstCallReadiness.readyCount}/{firstCallReadiness.totalCount} automatic checks
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{firstCallReadiness.nextAction}</div>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      firstCallReadiness.autoReady
                        ? "border-success/30 bg-success/10 text-success"
                        : "border-warning/30 bg-warning/10 text-warning"
                    }
                  >
                    {firstCallReadiness.autoReady ? "Ready for routing" : `${firstCallReadiness.missingCount} missing`}
                  </Badge>
                </div>

                <div className="space-y-2">
                  {firstCallReadiness.steps.map((step) => (
                    <ReadinessRow key={step.id} step={step} />
                  ))}
                </div>

                <div className="border-t border-border pt-3">
                  <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">Manual setup</div>
                  <div className="space-y-2">
                    {firstCallReadiness.manualSteps.map((step) => (
                      <ReadinessRow key={step.id} step={step} />
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </PageBody>
    </>
  );
}

function PhoneNumberLifecycleRow({
  busy,
  onRelease,
  record,
}: {
  busy: boolean;
  onRelease: (record: PhoneNumberRecord) => void;
  record: PhoneNumberRecord;
}) {
  const released = record.status === "released" || Boolean(record.releasedAt);
  const trialState = phoneTrialState(record);

  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-mono text-sm font-semibold">{record.phoneNumber}</div>
            <Badge variant="outline" className={phoneStatusClass(record.status)}>
              {record.status}
            </Badge>
            <Badge variant="outline" className={trialState.className}>
              {trialState.label}
            </Badge>
          </div>
          <div className="mt-2 grid gap-1 text-xs text-muted-foreground md:grid-cols-2">
            <span>Forwarding: {record.forwardingStatus.replace(/_/g, " ")}</span>
            <span>Main line: {record.restaurantMainLine || "Not set"}</span>
            <span>Trial ends: {formatDateTime(record.trialEndsAt)}</span>
            <span>Grace ends: {formatDateTime(record.trialGraceEndsAt)}</span>
            <span>Provider SID: {record.providerSid || "Missing"}</span>
            <span>Released: {formatDateTime(record.releasedAt)}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            disabled={!record.voiceWebhookUrl}
            onClick={() => record.voiceWebhookUrl && copyToClipboard(record.voiceWebhookUrl)}
            size="sm"
            variant="outline"
          >
            <Copy className="mr-1.5 h-3.5 w-3.5" />
            Voice URL
          </Button>
          <Button
            disabled={released || busy || !record.providerSid}
            onClick={() => onRelease(record)}
            size="sm"
            variant="outline"
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Release
          </Button>
        </div>
      </div>
      {released && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 p-2 text-xs text-warning">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Released numbers no longer receive calls. Reason: {record.releaseReason || "not recorded"}.
        </div>
      )}
    </div>
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

function ReadinessRow({ step }: { step: FirstCallReadinessStep }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-border px-3 py-2">
      <div className="min-w-0">
        <div className="text-sm font-medium">{step.label}</div>
        <div className="mt-0.5 break-words text-xs text-muted-foreground">{step.detail}</div>
      </div>
      {step.status === "ready" ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
      ) : step.status === "manual" ? (
        <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      ) : (
        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
      )}
    </div>
  );
}

function PilotReadinessRow({ step }: { step: PilotReadinessStep }) {
  return (
    <div className="rounded-md border border-border px-3 py-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-medium">{step.label}</div>
            {!step.required && (
              <Badge variant="outline" className="bg-muted text-[10px] uppercase text-muted-foreground">
                Recommended
              </Badge>
            )}
          </div>
          <div className="mt-0.5 break-words text-xs text-muted-foreground">{step.detail}</div>
          {step.status !== "ready" && step.action && (
            <div className="mt-1 text-xs text-foreground">{step.action}</div>
          )}
        </div>
        {step.status === "ready" ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
        ) : step.status === "recommended" ? (
          <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        )}
      </div>
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

function phoneTrialState(record: PhoneNumberRecord) {
  if (record.status === "released" || record.releasedAt) {
    return { className: "border-muted bg-muted text-muted-foreground", label: "Released" };
  }
  if (!record.trialGraceEndsAt) {
    return { className: "bg-muted text-muted-foreground", label: "No trial dates" };
  }

  const now = Date.now();
  const trialEnds = record.trialEndsAt ? new Date(record.trialEndsAt).getTime() : NaN;
  const graceEnds = new Date(record.trialGraceEndsAt).getTime();
  if (Number.isFinite(graceEnds) && now > graceEnds) {
    return { className: "border-destructive/30 bg-destructive/10 text-destructive", label: "Release due" };
  }
  if (Number.isFinite(trialEnds) && now > trialEnds) {
    return { className: "border-warning/30 bg-warning/10 text-warning", label: "Grace period" };
  }
  return { className: "border-success/30 bg-success/10 text-success", label: "Trial active" };
}

function phoneStatusClass(status: string) {
  if (status === "released") return "bg-muted text-muted-foreground";
  if (status === "in-use" || status === "active" || status === "provisioned") return "border-success/30 bg-success/10 text-success";
  return "border-warning/30 bg-warning/10 text-warning";
}

function formatDateTime(value?: string) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Invalid date";
  return date.toLocaleString([], {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  });
}
