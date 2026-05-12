import { useEffect, useState } from "react";
import { PageHeader, PageBody } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  afterHoursBehaviorLabels,
  callHandlingLabels,
  defaultRestaurantAgentConfig,
  orderDestinationLabels,
  reservationModeLabels,
  type AfterHoursBehavior,
  type CallHandlingMode,
  type OrderDestination,
  type RestaurantAgentConfig,
  type ReservationMode,
} from "@/domain/restaurant-config";
import {
  hostlineVoiceProfiles,
  normalizeHostlineVoiceGender,
  type HostlineVoiceGender,
} from "@/domain/voice-selection";
import {
  AlertTriangle,
  Bot,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  PhoneCall,
  Play,
  Printer,
  RefreshCw,
  Server,
  ShoppingBag,
  Sparkles,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  fetchVoicePreviewAudio,
  fetchVoiceServiceHealth,
  isVoiceServiceConfigured,
  voiceServiceBaseUrl,
  type VoiceServiceHealth,
} from "@/lib/voice-service";
import { loadAgentConfigDraft, saveAgentConfigDraft } from "@/lib/agent-config-storage";
import { loadOnboardingDraft, saveOnboardingDraft } from "@/lib/onboarding-draft";
import {
  fetchAgentConfigFromSupabase,
  fetchOnboardingProfileFromSupabase,
  isAgentConfigPersistenceConfigured,
  isOnboardingPersistenceConfigured,
  saveAgentConfigToSupabase,
  saveOnboardingProfileToSupabase,
} from "@/lib/supabase-rest";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const variables = ["{restaurant_name}", "{caller_name}", "{hours_today}"];

const capabilityRows = [
  { key: "answerFaqs", name: "Answer FAQs", desc: "Hours, location, menu questions, policies" },
  { key: "takeOrders", name: "Take pickup orders", desc: "Items, modifiers, name, phone, pickup ETA" },
  { key: "handleReservations", name: "Handle reservations", desc: "Integrated booking or staff-confirmed requests" },
  { key: "sendSmsConfirmations", name: "Send SMS confirmations", desc: "Order and reservation summaries" },
  { key: "escalateToStaff", name: "Escalate to staff", desc: "Low confidence, allergy risk, complaints, human requests" },
] as const;

export default function VoiceAgent() {
  const [config, setConfig] = useState<RestaurantAgentConfig>(() => loadAgentConfigDraft() ?? createConfigFromOnboardingDraft());
  const [serviceHealth, setServiceHealth] = useState<VoiceServiceHealth | null>(null);
  const [serviceError, setServiceError] = useState<string | null>(null);
  const [checkingService, setCheckingService] = useState(false);
  const [playingPreview, setPlayingPreview] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configSyncState, setConfigSyncState] = useState<"error" | "live" | "loading" | "local">(
    isAgentConfigPersistenceConfigured() ? "loading" : "local",
  );
  const [configSyncMessage, setConfigSyncMessage] = useState(
    isAgentConfigPersistenceConfigured() ? "Checking saved voice config" : "Saved to this browser",
  );

  const checkVoiceService = async () => {
    if (!isVoiceServiceConfigured()) {
      setServiceHealth(null);
      setServiceError("Set VITE_VOICE_SERVICE_URL to connect the dashboard to the voice backend.");
      return;
    }

    setCheckingService(true);
    setServiceError(null);

    try {
      const health = await fetchVoiceServiceHealth();
      setServiceHealth(health);
    } catch (error) {
      setServiceHealth(null);
      setServiceError(error instanceof Error ? error.message : "Voice service health check failed.");
    } finally {
      setCheckingService(false);
    }
  };

  useEffect(() => {
    void checkVoiceService();
  }, []);

  useEffect(() => {
    if (!isAgentConfigPersistenceConfigured()) return;

    let active = true;

    fetchAgentConfigFromSupabase(loadAgentConfigDraft() ?? createConfigFromOnboardingDraft())
      .then((remoteConfig) => {
        if (!active) return;

        if (!remoteConfig) {
          setConfigSyncState("live");
          setConfigSyncMessage("Ready to create Supabase voice config");
          return;
        }

        setConfig(remoteConfig);
        saveAgentConfigDraft(remoteConfig);
        setConfigSyncState("live");
        setConfigSyncMessage("Loaded from Supabase agent_configs");
      })
      .catch((error) => {
        if (!active) return;
        setConfigSyncState("error");
        setConfigSyncMessage(error instanceof Error ? error.message : "Voice config load failed");
      });

    return () => {
      active = false;
    };
  }, []);

  const saveConfig = async () => {
    saveAgentConfigDraft(config);
    persistVoiceGenderToLocalOnboardingDraft(config.voiceGender);

    if (!isAgentConfigPersistenceConfigured()) {
      setConfigSyncState("local");
      setConfigSyncMessage("Saved to this browser");
      toast.success("Voice configuration saved locally");
      return;
    }

    setSavingConfig(true);

    try {
      await saveAgentConfigToSupabase(config);
      await syncVoiceGenderToOnboardingProfile(config.voiceGender);
      setConfigSyncState("live");
      setConfigSyncMessage("Synced to Supabase voice config");
      toast.success("Voice configuration synced");
    } catch (error) {
      setConfigSyncState("error");
      setConfigSyncMessage(error instanceof Error ? error.message : "Voice config sync failed");
      toast.error("Saved locally, but Supabase sync failed");
    } finally {
      setSavingConfig(false);
    }
  };

  const playVoicePreview = async () => {
    if (!isVoiceServiceConfigured()) {
      toast.error("Voice service is not configured yet. Set VITE_VOICE_SERVICE_URL first.");
      return;
    }

    setPlayingPreview(true);

    try {
      const audioBlob = await fetchVoicePreviewAudio(config.greetingTemplate, config.voiceGender);
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.onended = () => URL.revokeObjectURL(audioUrl);
      audio.onerror = () => URL.revokeObjectURL(audioUrl);
      await audio.play();
      toast.success("Playing ElevenLabs preview");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Voice preview failed.");
    } finally {
      setPlayingPreview(false);
    }
  };

  const setDestination = (destination: OrderDestination, checked: boolean) => {
    setConfig((current) => {
      const destinations = checked
        ? Array.from(new Set([...current.orders.destinations, destination]))
        : current.orders.destinations.filter((item) => item !== destination);

      return {
        ...current,
        orders: {
          ...current.orders,
          destinations,
        },
      };
    });
  };

  return (
    <>
      <PageHeader
        title="Voice Agent"
        description="Configure how the AI host answers, routes, and escalates calls"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={playVoicePreview} disabled={playingPreview}>
              <Play className="mr-1.5 h-3.5 w-3.5" />
              {playingPreview ? "Loading..." : "Preview"}
            </Button>
            <Button size="sm" onClick={saveConfig} disabled={savingConfig}>
              {savingConfig ? "Saving..." : "Save changes"}
            </Button>
          </>
        }
      />
      <PageBody>
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-5">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Bot className="h-4 w-4 text-primary" />
                  Identity
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label>Host name</Label>
                    <Input
                      value={config.hostName}
                      onChange={(event) => setConfig({ ...config, hostName: event.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Voice</Label>
                    <Select
                      value={config.voiceGender}
                      onValueChange={(voiceGender) =>
                        setConfig({ ...config, voiceGender: normalizeHostlineVoiceGender(voiceGender) })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {voiceGenderOptions.map((voice) => (
                          <SelectItem key={voice.value} value={voice.value}>
                            {voice.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Tone</Label>
                    <Select
                      value={config.tone}
                      onValueChange={(tone) => setConfig({ ...config, tone: tone as typeof config.tone })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="warm">Warm</SelectItem>
                        <SelectItem value="professional">Professional</SelectItem>
                        <SelectItem value="playful">Playful</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Greeting</Label>
                  <Textarea
                    rows={2}
                    value={config.greetingTemplate}
                    onChange={(event) => setConfig({ ...config, greetingTemplate: event.target.value })}
                  />
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {variables.map((variable) => (
                      <Badge key={variable} variant="secondary" className="cursor-pointer font-mono text-[10px] hover:bg-accent">
                        {variable}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-md border border-border p-3">
                  <div>
                    <div className="text-sm font-medium">Light AI disclosure</div>
                    <div className="text-xs text-muted-foreground">Default greeting identifies the host as virtual.</div>
                  </div>
                  <Switch
                    checked={config.disclosureEnabled}
                    onCheckedChange={(disclosureEnabled) => setConfig({ ...config, disclosureEnabled })}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Call handling</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Mode</Label>
                    <Select
                      value={config.callHandlingMode}
                      onValueChange={(callHandlingMode) =>
                        setConfig({ ...config, callHandlingMode: callHandlingMode as CallHandlingMode })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(callHandlingLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Answer after rings</Label>
                    <Select
                      value={String(config.answerAfterRings)}
                      onValueChange={(answerAfterRings) =>
                        setConfig({ ...config, answerAfterRings: Number(answerAfterRings) })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6].map((count) => (
                          <SelectItem key={count} value={String(count)}>
                            {count}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>After-hours behavior</Label>
                    <Select
                      value={config.afterHoursBehavior}
                      onValueChange={(afterHoursBehavior) =>
                        setConfig({ ...config, afterHoursBehavior: afterHoursBehavior as AfterHoursBehavior })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(afterHoursBehaviorLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Escalation phone number</Label>
                    <Input
                      value={config.escalationPhoneNumber}
                      onChange={(event) => setConfig({ ...config, escalationPhoneNumber: event.target.value })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Capabilities</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {capabilityRows.map((capability) => (
                  <div key={capability.key} className="flex items-center justify-between border-b border-border py-2.5 last:border-0">
                    <div>
                      <div className="text-sm font-medium">{capability.name}</div>
                      <div className="text-xs text-muted-foreground">{capability.desc}</div>
                    </div>
                    <Switch
                      checked={config.capabilities[capability.key]}
                      onCheckedChange={(checked) =>
                        setConfig({
                          ...config,
                          capabilities: {
                            ...config.capabilities,
                            [capability.key]: checked,
                          },
                        })
                      }
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="grid gap-5 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ShoppingBag className="h-4 w-4 text-primary" />
                    Order workflow
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between rounded-md border border-border p-3">
                    <div>
                      <div className="text-sm font-medium">Take pickup orders</div>
                      <div className="text-xs text-muted-foreground">Guests pay when they arrive.</div>
                    </div>
                    <Switch
                      checked={config.orders.enabled}
                      onCheckedChange={(enabled) =>
                        setConfig({
                          ...config,
                          orders: { ...config.orders, enabled },
                          capabilities: { ...config.capabilities, takeOrders: enabled },
                        })
                      }
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Payment</Label>
                      <Select value={config.orders.paymentMode}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pay_at_pickup">Pay at pickup</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Default pickup ETA</Label>
                      <Input
                        type="number"
                        min={1}
                        value={config.orders.defaultPickupEtaMinutes}
                        onChange={(event) =>
                          setConfig({
                            ...config,
                            orders: { ...config.orders, defaultPickupEtaMinutes: Number(event.target.value) },
                          })
                        }
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label>Order destinations</Label>
                    {(Object.keys(orderDestinationLabels) as OrderDestination[]).map((destination) => (
                      <label key={destination} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                        <Checkbox
                          checked={config.orders.destinations.includes(destination)}
                          onCheckedChange={(checked) => setDestination(destination, checked === true)}
                        />
                        {orderDestinationLabels[destination]}
                      </label>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    Reservation workflow
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Reservation handling</Label>
                    <Select
                      value={config.reservations.mode}
                      onValueChange={(mode) =>
                        setConfig({
                          ...config,
                          reservations: { ...config.reservations, mode: mode as ReservationMode },
                          capabilities: { ...config.capabilities, handleReservations: mode !== "disabled" },
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(reservationModeLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Provider</Label>
                    <Select
                      value={config.reservations.provider}
                      onValueChange={(provider) =>
                        setConfig({
                          ...config,
                          reservations: { ...config.reservations, provider: provider as typeof config.reservations.provider },
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="opentable">OpenTable</SelectItem>
                        <SelectItem value="yelp_guest_manager">Yelp Guest Manager</SelectItem>
                        <SelectItem value="sevenrooms">SevenRooms</SelectItem>
                        <SelectItem value="resy">Resy</SelectItem>
                        <SelectItem value="tock">Tock</SelectItem>
                        <SelectItem value="none">No provider</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Auto-confirm party size limit</Label>
                    <Input
                      type="number"
                      min={1}
                      value={config.reservations.maxPartySizeWithoutConfirmation}
                      onChange={(event) =>
                        setConfig({
                          ...config,
                          reservations: {
                            ...config.reservations,
                            maxPartySizeWithoutConfirmation: Number(event.target.value),
                          },
                        })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-md border border-warning/30 bg-warning/10 p-3">
                    <div>
                      <div className="text-sm font-medium">Manual requests need staff confirmation</div>
                      <div className="text-xs text-muted-foreground">Used when no reservation integration is connected.</div>
                    </div>
                    <Switch
                      checked={config.reservations.requireStaffConfirmationWithoutIntegration}
                      onCheckedChange={(requireStaffConfirmationWithoutIntegration) =>
                        setConfig({
                          ...config,
                          reservations: { ...config.reservations, requireStaffConfirmationWithoutIntegration },
                        })
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Server className="h-4 w-4 text-primary" />
                  Voice service
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-md border border-border bg-muted/20 p-3">
                  <div className="text-xs font-medium text-muted-foreground">Service URL</div>
                  <div className="mt-1 truncate text-sm font-medium">
                    {voiceServiceBaseUrl || "Not configured"}
                  </div>
                </div>
                <div className="rounded-md border border-border bg-muted/20 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-medium text-muted-foreground">Config persistence</div>
                      <div className="mt-1 text-sm font-medium">{configSyncLabel(configSyncState)}</div>
                    </div>
                    <Badge variant={configSyncState === "error" ? "destructive" : "secondary"} className="capitalize">
                      {configSyncState}
                    </Badge>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">{configSyncMessage}</div>
                </div>

                <ServiceStatusRow
                  label="Backend"
                  value={
                    serviceHealth?.ok
                      ? "Online"
                      : serviceError
                        ? "Not connected"
                        : checkingService
                          ? "Checking"
                          : "Not checked"
                  }
                  state={serviceHealth?.ok ? "ready" : serviceError ? "error" : "pending"}
                />
                <ServiceStatusRow
                  label="ElevenLabs preview"
                  value={serviceHealth?.elevenLabsConfigured ? "API key configured" : "Needs API key"}
                  state={serviceHealth?.elevenLabsConfigured ? "ready" : "pending"}
                />
                <ServiceStatusRow
                  label="OpenAI replies"
                  value={serviceHealth?.openaiConfigured ? "API key configured" : "Fallback mode"}
                  state={serviceHealth?.openaiConfigured ? "ready" : "pending"}
                />
                <ServiceStatusRow
                  label="Supabase logging"
                  value={serviceHealth?.supabaseConfigured ? "Calls will be saved" : "Not connected"}
                  state={serviceHealth?.supabaseConfigured ? "ready" : "pending"}
                />
                <ServiceStatusRow
                  label="Onboarded context"
                  value={serviceHealth?.onboardedContextConfigured ? "Loaded for calls" : "Demo fallback"}
                  state={serviceHealth?.onboardedContextConfigured ? "ready" : "pending"}
                />
                <ServiceStatusRow
                  label="Menu ingestion"
                  value={serviceHealth?.menuIngestionConfigured ? "Worker connected" : "Not connected"}
                  state={serviceHealth?.menuIngestionConfigured ? "ready" : "pending"}
                />
                <ServiceStatusRow
                  label="Twilio signatures"
                  value={serviceHealth?.twilioSignatureRequired ? "Required" : "Relaxed for local dev"}
                  state={serviceHealth?.twilioSignatureRequired ? "ready" : "pending"}
                />
                <ServiceStatusRow
                  label="Twilio provisioning"
                  value={serviceHealth?.twilioProvisioningConfigured ? "API credentials configured" : "Manual setup"}
                  state={serviceHealth?.twilioProvisioningConfigured ? "ready" : "pending"}
                />
                <ServiceStatusRow
                  label="Staff alerts"
                  value={serviceHealth?.staffAlertsConfigured ? "SMS or webhook configured" : "Not connected"}
                  state={serviceHealth?.staffAlertsConfigured ? "ready" : "pending"}
                />

                {serviceError && (
                  <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-xs text-muted-foreground">
                    {serviceError}
                  </div>
                )}

                <Button variant="outline" size="sm" className="w-full" onClick={checkVoiceService} disabled={checkingService}>
                  <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${checkingService ? "animate-spin" : ""}`} />
                  Check service
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Voice preview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Voice</Label>
                  <Select
                    value={config.voiceGender}
                    onValueChange={(voiceGender) =>
                      setConfig({ ...config, voiceGender: normalizeHostlineVoiceGender(voiceGender) })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {voiceGenderOptions.map((voice) => (
                        <SelectItem key={voice.value} value={voice.value}>
                          {voice.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-4 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Bot className="h-5 w-5" />
                  </div>
                  <div className="text-xs text-muted-foreground">Sample phrase</div>
                  <p className="mt-1 text-sm italic">{config.greetingTemplate}</p>
                  <Button size="sm" variant="outline" className="mt-3" onClick={playVoicePreview} disabled={playingPreview}>
                    <Play className="mr-1.5 h-3.5 w-3.5" />
                    {playingPreview ? "Loading..." : "Play sample"}
                  </Button>
                </div>
                <Button className="w-full" onClick={() => toast.success("Test call queued")}>
                  <PhoneCall className="mr-1.5 h-4 w-4" />
                  Test call
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Launch readiness</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <ReadinessRow icon={PhoneCall} label="Call mode" value={callHandlingLabels[config.callHandlingMode]} />
                <ReadinessRow icon={Bot} label="Voice" value={hostlineVoiceProfiles[config.voiceGender].shortLabel} />
                <ReadinessRow icon={ShoppingBag} label="Orders" value={config.orders.enabled ? "Enabled" : "Disabled"} />
                <ReadinessRow icon={CreditCard} label="Payment" value="Pay at pickup" />
                <ReadinessRow icon={Printer} label="Order routing" value={`${config.orders.destinations.length} destinations`} />
                <ReadinessRow icon={CalendarDays} label="Reservations" value={reservationModeLabels[config.reservations.mode]} />
                <ReadinessRow icon={AlertTriangle} label="Escalation" value={config.escalationPhoneNumber} />
              </CardContent>
            </Card>
          </div>
        </div>
      </PageBody>
    </>
  );
}

function createConfigFromOnboardingDraft(): RestaurantAgentConfig {
  const draft = loadOnboardingDraft();
  const callHandlingMode = mapCallHandlingMode(String(draft.callHandling ?? ""));
  const takeOrders = draft.takeOrders !== false;
  const takeReservations = draft.takeReservations !== false;
  const provider = mapReservationProvider(String(draft.reservationProvider ?? ""));
  const reservationMode = takeReservations ? mapReservationMode(String(draft.reservationHandlingMode ?? ""), provider) : "disabled";

  return {
    ...defaultRestaurantAgentConfig,
    callHandlingMode,
    escalationPhoneNumber: String(draft.escalationPhone || defaultRestaurantAgentConfig.escalationPhoneNumber),
    greetingTemplate: String(draft.greeting || defaultRestaurantAgentConfig.greetingTemplate),
    hostName: String(draft.hostName || defaultRestaurantAgentConfig.hostName),
    voiceGender: normalizeHostlineVoiceGender(draft.voiceGender),
    orders: {
      ...defaultRestaurantAgentConfig.orders,
      defaultPickupEtaMinutes: parsePickupEta(String(draft.defaultPickupEta ?? "")),
      enabled: takeOrders,
    },
    reservations: {
      ...defaultRestaurantAgentConfig.reservations,
      maxPartySizeWithoutConfirmation: parsePositiveInteger(
        String(draft.autoConfirmPartyLimit ?? ""),
        defaultRestaurantAgentConfig.reservations.maxPartySizeWithoutConfirmation,
      ),
      mode: reservationMode,
      provider,
    },
    tone: mapVoiceTone(String(draft.tone ?? "")),
    capabilities: {
      ...defaultRestaurantAgentConfig.capabilities,
      handleReservations: takeReservations,
      takeOrders,
    },
  };
}

function mapCallHandlingMode(value: string): CallHandlingMode {
  if (value === "Immediately") return "answer_immediately";
  if (value === "After-hours only") return "after_hours_only";
  if (value === "Manual on/off") return "manually_enabled";
  return "answer_after_rings";
}

function mapReservationMode(
  value: string,
  provider: RestaurantAgentConfig["reservations"]["provider"],
): ReservationMode {
  const normalized = value.toLowerCase();
  if (normalized.includes("do not") || normalized.includes("no reservations")) return "disabled";
  if (normalized.includes("booking link") || normalized.includes("send caller")) return "booking_link";
  if (normalized.includes("pending request in hostline")) return "hostline_lite_request";
  if (normalized.includes("confirm in hostline")) return "hostline_lite_confirm";
  if (normalized.includes("connected reservation system")) return provider === "none" ? "manual_request" : "integration";
  return "manual_request";
}

function mapReservationProvider(value: string): RestaurantAgentConfig["reservations"]["provider"] {
  const normalized = value.toLowerCase();
  if (normalized.includes("yelp")) return "yelp_guest_manager";
  if (normalized.includes("sevenrooms")) return "sevenrooms";
  if (normalized.includes("resy")) return "resy";
  if (normalized.includes("tock")) return "tock";
  if (normalized.includes("manual") || normalized.includes("google") || normalized.includes("booking link") || normalized.includes("no reservations")) return "none";
  return "opentable";
}

function mapVoiceTone(value: string): RestaurantAgentConfig["tone"] {
  const normalized = value.toLowerCase();
  if (normalized.includes("professional") || normalized.includes("calm")) return "professional";
  if (normalized.includes("playful") || normalized.includes("bright")) return "playful";
  return "warm";
}

function parsePickupEta(value: string) {
  return parsePositiveInteger(value, defaultRestaurantAgentConfig.orders.defaultPickupEtaMinutes);
}

function parsePositiveInteger(value: string, fallback: number) {
  const minutes = Number.parseInt(value, 10);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : fallback;
}

const voiceGenderOptions: Array<{ label: string; value: HostlineVoiceGender }> = [
  { label: hostlineVoiceProfiles.female.label, value: "female" },
  { label: hostlineVoiceProfiles.male.label, value: "male" },
];

function persistVoiceGenderToLocalOnboardingDraft(voiceGender: HostlineVoiceGender) {
  const draft = {
    ...loadOnboardingDraft(),
    voiceGender: hostlineVoiceProfiles[voiceGender].label,
  };
  saveOnboardingDraft(draft);
  return draft;
}

async function syncVoiceGenderToOnboardingProfile(voiceGender: HostlineVoiceGender) {
  if (!isOnboardingPersistenceConfigured()) return;

  const remoteDraft = await fetchOnboardingProfileFromSupabase().catch(() => null);
  const draft = {
    ...(remoteDraft ?? loadOnboardingDraft()),
    voiceGender: hostlineVoiceProfiles[voiceGender].label,
  };
  saveOnboardingDraft(draft);
  await saveOnboardingProfileToSupabase(draft);
}

function configSyncLabel(state: "error" | "live" | "loading" | "local") {
  if (state === "live") return "Supabase sync active";
  if (state === "loading") return "Checking saved config";
  if (state === "error") return "Needs attention";
  return "Local browser storage";
}

function ServiceStatusRow({
  label,
  state,
  value,
}: {
  label: string;
  state: "ready" | "pending" | "error";
  value: string;
}) {
  const Icon = state === "ready" ? CheckCircle2 : state === "error" ? XCircle : AlertTriangle;
  const color =
    state === "ready"
      ? "text-success"
      : state === "error"
        ? "text-destructive"
        : "text-warning";

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm font-medium">{value}</div>
      </div>
      <Icon className={`h-4 w-4 shrink-0 ${color}`} />
    </div>
  );
}

function ReadinessRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof PhoneCall;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-border p-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="truncate text-sm font-medium">{value}</div>
      </div>
    </div>
  );
}
