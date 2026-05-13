import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  AlertTriangle,
  Bot,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ClipboardCheck,
  Copy,
  FileText,
  Loader2,
  PhoneForwarded,
  Rocket,
  Search,
  ShieldCheck,
  ShoppingBag,
  Store,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { PageBody, PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  assignedDemoPhoneNumber,
  calculateOnboardingProgress,
  createOnboardingDraftForBusiness,
  getBusinessOnboardingSections,
  getOnboardingBusinessTemplate,
  productionWorkstreams,
  type OnboardingDraft,
  type OnboardingField,
  type OnboardingFieldOption,
  type OnboardingStepId,
} from "@/domain/onboarding";
import { loadOnboardingDraft, saveOnboardingDraft } from "@/lib/onboarding-draft";
import {
  fetchOnboardingProfileFromSupabase,
  fetchPhoneNumbersFromSupabase,
  getActiveSupabaseLocationId,
  type ForwardingTestStatus,
  type ForwardingVerification,
  isOnboardingPersistenceConfigured,
  type PhoneNumberRecord,
  saveOnboardingProfileToSupabase,
  savePhoneNumberVerificationToSupabase,
} from "@/lib/supabase-rest";
import {
  searchAvailableVoicePhoneNumbers,
  provisionVoicePhoneNumber,
  isVoiceServiceConfigured,
  type AvailableVoicePhoneNumber,
} from "@/lib/voice-service";
import { cn } from "@/lib/utils";

const sectionIcons: Record<OnboardingStepId, LucideIcon> = {
  basics: Store,
  hours: Clock3,
  launch: PhoneForwarded,
  menus: UtensilsCrossed,
  orders: ShoppingBag,
  policies: ShieldCheck,
  reservations: CalendarDays,
  escalations: ClipboardCheck,
  voice: Bot,
};

type ForwardingVerificationCheck = {
  description: string;
  key: keyof Pick<ForwardingVerification, "busyForwarding" | "directCall" | "noAnswerForwarding">;
  label: string;
};

type LaunchAssistantStep = {
  detail: string;
  label: string;
  status: "blocked" | "current" | "done" | "pending";
};

const FIRST_AVAILABLE_NUMBER_TOKEN = "__first_available__";
const TRIAL_DAYS = 7;
const TRIAL_GRACE_DAYS = 14;

export default function Onboarding() {
  const [activeSectionId, setActiveSectionId] = useState<OnboardingStepId>("basics");
  const [draft, setDraft] = useState<OnboardingDraft>(() => loadOnboardingDraft());
  const [savingDraft, setSavingDraft] = useState(false);
  const [syncState, setSyncState] = useState<"local" | "loading" | "live" | "error">(
    isOnboardingPersistenceConfigured() ? "loading" : "local",
  );
  const [syncMessage, setSyncMessage] = useState(
    isOnboardingPersistenceConfigured() ? "Checking Supabase profile" : "Saved to this browser",
  );
  const [availableNumbers, setAvailableNumbers] = useState<AvailableVoicePhoneNumber[]>([]);
  const [phoneSearchAreaCode, setPhoneSearchAreaCode] = useState(() => {
    const savedDraft = loadOnboardingDraft();
    return String(savedDraft.preferredAreaCode ?? "") || inferAreaCode(String(savedDraft.mainPhone ?? ""));
  });
  const [phoneSearchError, setPhoneSearchError] = useState<string | null>(null);
  const [phoneNumberRecord, setPhoneNumberRecord] = useState<PhoneNumberRecord | null>(null);
  const [localForwardingVerification, setLocalForwardingVerification] = useState<ForwardingVerification>({});
  const [provisioningNumber, setProvisioningNumber] = useState<string | null>(null);
  const [savingVerificationKey, setSavingVerificationKey] = useState<string | null>(null);
  const [searchingNumbers, setSearchingNumbers] = useState(false);
  const businessTemplate = useMemo(() => getOnboardingBusinessTemplate(draft), [draft]);
  const activeOnboardingSections = useMemo(() => getBusinessOnboardingSections(draft), [draft]);
  const progress = useMemo(() => calculateOnboardingProgress(draft, activeOnboardingSections), [draft, activeOnboardingSections]);
  const activeSection = activeOnboardingSections.find((section) => section.id === activeSectionId) ?? activeOnboardingSections[0];
  const ActiveIcon = sectionIcons[activeSection.id];
  const assignedNumber = String(draft.assignedSignalHostNumber || draft.assignedHostLineNumber || assignedDemoPhoneNumber);
  const assignedNumberIsDemo = assignedNumber === assignedDemoPhoneNumber;
  const activeLocationId = getActiveSupabaseLocationId();
  const launchChecklist = useMemo(() => buildLaunchChecklist(businessTemplate), [businessTemplate]);
  const forwardingVerificationChecks = useMemo(() => buildForwardingVerificationChecks(businessTemplate), [businessTemplate]);
  const forwardingVerification = phoneNumberRecord?.forwardingVerification ?? localForwardingVerification;
  const forwardingVerificationStatus = buildVerificationStatus(forwardingVerification);
  const selectedPlanName = String(draft.selectedPlanName ?? "Not selected");
  const selectedPlanMonthly = String(draft.selectedPlanMonthly ?? "");
  const launchAssistantSteps = useMemo(
    () =>
      buildLaunchAssistantSteps({
        assignedNumberIsDemo,
        forwardingVerificationStatus,
        progressPercent: progress.percent,
        syncState,
        voiceConfigured: isVoiceServiceConfigured(),
      }),
    [assignedNumberIsDemo, forwardingVerificationStatus, progress.percent, syncState],
  );

  useEffect(() => {
    if (!isOnboardingPersistenceConfigured()) return;

    let active = true;

    fetchOnboardingProfileFromSupabase()
      .then((remoteDraft) => {
        if (!active) return;

        if (!remoteDraft) {
          setSyncState("live");
          setSyncMessage("Ready to create Supabase profile");
          return;
        }

        const localDraft = loadOnboardingDraft();
        const remoteBusinessType = String(remoteDraft.businessType ?? localDraft.businessType ?? "restaurant");
        const mergedDraft = {
          ...createOnboardingDraftForBusiness(remoteBusinessType),
          ...(localDraft.businessType === remoteBusinessType ? localDraft : {}),
          ...remoteDraft,
        };
        setDraft(mergedDraft);
        saveOnboardingDraft(mergedDraft);
        setSyncState("live");
        setSyncMessage("Loaded from Supabase");
      })
      .catch((error) => {
        if (!active) return;
        setSyncState("error");
        setSyncMessage(error instanceof Error ? error.message : "Supabase profile load failed");
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isOnboardingPersistenceConfigured()) return;

    let active = true;

    fetchPhoneNumbersFromSupabase()
      .then((phoneNumbers) => {
        if (!active) return;
        const matchedNumber =
          phoneNumbers.find((phoneNumber) => phoneNumber.phoneNumber === assignedNumber) ?? phoneNumbers[0] ?? null;
        setPhoneNumberRecord(matchedNumber);
      })
      .catch(() => {
        if (!active) return;
        setPhoneNumberRecord(null);
      });

    return () => {
      active = false;
    };
  }, [assignedNumber]);

  useEffect(() => {
    if (phoneSearchAreaCode) return;
    const inferredAreaCode = String(draft.preferredAreaCode ?? "") || inferAreaCode(String(draft.mainPhone ?? ""));
    if (inferredAreaCode) setPhoneSearchAreaCode(inferredAreaCode);
  }, [draft.mainPhone, draft.preferredAreaCode, phoneSearchAreaCode]);

  const updateField = (fieldId: string, value: string | boolean) => {
    if (fieldId === "businessType" && typeof value === "string") {
      setDraft((current) => mergeDraftForBusinessTypeChange(current, value));
      return;
    }

    setDraft((current) => ({ ...current, [fieldId]: value }));
  };

  const persistDraft = async (nextDraft: OnboardingDraft, successMessage = "Onboarding draft saved locally") => {
    saveOnboardingDraft(nextDraft);

    if (!isOnboardingPersistenceConfigured()) {
      setSyncState("local");
      setSyncMessage("Saved to this browser");
      toast.success(successMessage);
      return;
    }

    setSavingDraft(true);

    try {
      const result = await saveOnboardingProfileToSupabase(nextDraft);
      setSyncState("live");
      setSyncMessage(`Synced to Supabase at ${result.progress_percent ?? calculateOnboardingProgress(nextDraft).percent}% readiness`);
      toast.success(successMessage === "Onboarding draft saved locally" ? "Onboarding profile synced to Supabase" : successMessage);
    } catch (error) {
      setSyncState("error");
      setSyncMessage(error instanceof Error ? error.message : "Supabase profile sync failed");
      toast.error("Saved locally, but Supabase sync failed");
    } finally {
      setSavingDraft(false);
    }
  };

  const saveDraft = async () => {
    await persistDraft(draft);
  };

  const searchPhoneNumbers = async () => {
    if (!isVoiceServiceConfigured()) {
      setPhoneSearchError("Set VITE_VOICE_SERVICE_URL to connect Twilio number search.");
      toast.error("Voice service URL is not configured.");
      return;
    }

    setSearchingNumbers(true);
    setPhoneSearchError(null);

    try {
      const result = await searchAvailableVoicePhoneNumbers({
        areaCode: phoneSearchAreaCode,
        country: "US",
        limit: 6,
      });
      setAvailableNumbers(result.numbers);
      if (!result.numbers.length) {
        toast.info("No matching numbers found. Try a nearby area code.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Phone number search failed.";
      setPhoneSearchError(message);
      toast.error(message);
    } finally {
      setSearchingNumbers(false);
    }
  };

  const provisionNumber = async (phoneNumber?: string) => {
    const searchAreaCode = phoneSearchAreaCode || inferAreaCode(String(draft.mainPhone ?? ""));
    if (!phoneNumber && !searchAreaCode) {
      setPhoneSearchError("Enter the business area code before assigning a trial number.");
      toast.error("Enter an area code first.");
      return;
    }

    const provisioningToken = phoneNumber ?? FIRST_AVAILABLE_NUMBER_TOKEN;
    setProvisioningNumber(provisioningToken);
    setPhoneSearchError(null);

    try {
      const result = await provisionVoicePhoneNumber({
        areaCode: phoneNumber ? undefined : searchAreaCode,
        country: "US",
        forwardingMode: mapForwardingMode(String(draft.forwardingMode ?? "")),
        locationId: activeLocationId,
        phoneNumber,
        restaurantMainLine: String(draft.mainPhone ?? "").trim() || undefined,
        trialDays: TRIAL_DAYS,
        trialGraceDays: TRIAL_GRACE_DAYS,
      });
      const nextDraft = {
        ...draft,
        assignedHostLineNumber: result.phoneNumber.phoneNumber,
        assignedSignalHostNumber: result.phoneNumber.phoneNumber,
        preferredAreaCode: searchAreaCode,
      };
      setDraft(nextDraft);
      await persistDraft(nextDraft, "SignalHost number assigned");
      await refreshPhoneNumberRecord(result.phoneNumber.phoneNumber);
      setAvailableNumbers([]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Phone number provisioning failed.";
      setPhoneSearchError(message);
      toast.error(message);
    } finally {
      setProvisioningNumber(null);
    }
  };

  async function refreshPhoneNumberRecord(expectedPhoneNumber = assignedNumber) {
    if (!isOnboardingPersistenceConfigured()) return;

    const phoneNumbers = await fetchPhoneNumbersFromSupabase(activeLocationId);
    const matchedNumber =
      phoneNumbers.find((phoneNumber) => phoneNumber.phoneNumber === expectedPhoneNumber) ?? phoneNumbers[0] ?? null;
    setPhoneNumberRecord(matchedNumber);
  }

  const updateForwardingVerification = async (
    key: keyof Pick<ForwardingVerification, "busyForwarding" | "directCall" | "noAnswerForwarding">,
    status: ForwardingTestStatus,
  ) => {
    const nextVerification: ForwardingVerification = {
      ...forwardingVerification,
      [key]: status,
      updatedAt: new Date().toISOString(),
    };

    setLocalForwardingVerification(nextVerification);
    setSavingVerificationKey(`${key}-${status}`);

    try {
      if (phoneNumberRecord) {
        const updatedRecord = await savePhoneNumberVerificationToSupabase(phoneNumberRecord.id, nextVerification);
        if (updatedRecord) setPhoneNumberRecord(updatedRecord);
      }

      toast.success(status === "passed" ? "Forwarding check marked passed" : "Forwarding check marked failed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save forwarding verification.");
    } finally {
      setSavingVerificationKey(null);
    }
  };

  return (
    <>
      <PageHeader
        title={`${businessTemplate.workspaceLabel} Onboarding`}
        description={`Guided setup for a launch-ready ${businessTemplate.businessNoun} phone and chat host`}
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link to="/app/voice-agent">
                Voice Agent
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
            <Button size="sm" onClick={saveDraft} disabled={savingDraft}>
              <ClipboardCheck className="mr-1.5 h-3.5 w-3.5" />
              {savingDraft ? "Saving..." : "Save draft"}
            </Button>
          </>
        }
      />

      <PageBody className="space-y-5">
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="border-primary/25 bg-background/80 text-primary">Self-service launch</Badge>
                  <span className="text-xs font-medium text-muted-foreground">7-day trial number, then 14-day cleanup grace</span>
                </div>
                <h2 className="mt-3 text-xl font-semibold">Get to the first test call without touching Twilio.</h2>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                  Finish the interview, assign a local SignalHost number, call it directly, then forward the business line when it sounds right.
                </p>

                <div className="mt-4 grid gap-2 md:grid-cols-4">
                  {launchAssistantSteps.map((step) => (
                    <LaunchAssistantStepCard key={step.label} step={step} />
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                <Button
                  onClick={() => provisionNumber()}
                  disabled={Boolean(provisioningNumber) || !assignedNumberIsDemo || !isVoiceServiceConfigured() || !activeLocationId}
                >
                  {provisioningNumber === FIRST_AVAILABLE_NUMBER_TOKEN ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <PhoneForwarded className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Assign first available
                </Button>
                <Button variant="outline" disabled={assignedNumberIsDemo} asChild={!assignedNumberIsDemo}>
                  {assignedNumberIsDemo ? (
                    <span>
                      Call test number
                      <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                    </span>
                  ) : (
                    <a href={`tel:${assignedNumber}`}>
                      Call test number
                      <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                    </a>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-4">
              <Card>
                <CardContent className="p-4">
                  <div className="text-xs font-medium text-muted-foreground">Launch readiness</div>
                  <div className="mt-2 flex items-end justify-between gap-3">
                    <div className="text-3xl font-semibold tabular-nums">{progress.percent}%</div>
                    <Badge variant="secondary">{progress.completedRequired}/{progress.totalRequired} required</Badge>
                  </div>
                  <Progress value={progress.percent} className="mt-3 h-2" />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="text-xs font-medium text-muted-foreground">Selected plan</div>
                  <div className="mt-2 truncate text-2xl font-semibold">{selectedPlanName}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {selectedPlanMonthly ? `$${selectedPlanMonthly}/mo from signup` : "Choose pricing before launch"}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="text-xs font-medium text-muted-foreground">SignalHost number</div>
                  <div className="mt-2 truncate text-xl font-semibold tabular-nums">{assignedNumber}</div>
                  <div className="mt-1 text-xs text-muted-foreground">Twilio provisioning target</div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="text-xs font-medium text-muted-foreground">Persistence</div>
                  <div className="mt-2 text-lg font-semibold capitalize">{syncState}</div>
                  <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{syncMessage}</div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
              <Card className="h-fit p-2">
                <div className="px-2 py-1.5 text-xs font-semibold uppercase text-muted-foreground">Interview</div>
                <div className="space-y-1">
                  {activeOnboardingSections.map((section) => {
                    const Icon = sectionIcons[section.id];
                    const sectionProgress = getSectionProgress(section.id, draft);
                    const active = section.id === activeSection.id;

                    return (
                      <button
                        key={section.id}
                        type="button"
                        onClick={() => setActiveSectionId(section.id)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                          active ? "bg-accent font-medium" : "hover:bg-muted",
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate">{section.title}</span>
                        {sectionProgress.complete ? (
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />
                        ) : (
                          <span className="text-[11px] text-muted-foreground tabular-nums">
                            {sectionProgress.completed}/{sectionProgress.total}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <Badge variant="outline" className="mb-2">{activeSection.eyebrow}</Badge>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <ActiveIcon className="h-4 w-4 text-primary" />
                        {activeSection.title}
                      </CardTitle>
                    </div>
                    <Button size="sm" variant="outline" onClick={saveDraft} disabled={savingDraft}>
                      {savingDraft ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="rounded-md border border-primary/20 bg-primary/5 p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                        <Bot className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-sm font-medium">Setup interview</div>
                        <p className="mt-1 text-sm text-muted-foreground">{activeSection.assistantPrompt}</p>
                        <p className="mt-2 text-xs font-medium text-foreground">{activeSection.outcome}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4">
                    {activeSection.fields.map((field) => (
                      <OnboardingFieldControl
                        key={field.id}
                        draft={draft}
                        field={field}
                        onChange={(value) => updateField(field.id, value)}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-4 w-4 text-primary" />
                  Knowledge variables
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {activeOnboardingSections.map((section) => (
                    <div key={section.id} className="rounded-md border border-border p-3">
                      <div className="text-sm font-medium">{section.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{section.fields.length} captured variables</div>
                      <div className="mt-3 flex flex-wrap gap-1">
                        {section.fields.slice(0, 4).map((field) => (
                          <Badge key={field.id} variant="secondary" className="text-[10px]">
                            {field.label}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <PhoneForwarded className="h-4 w-4 text-primary" />
                  Phone launch
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-md border border-border bg-muted/20 p-4">
                  <div className="text-xs font-medium text-muted-foreground">Assigned SignalHost number</div>
                  <div className="mt-1 text-2xl font-semibold tabular-nums">{assignedNumber}</div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "mt-3",
                      assignedNumberIsDemo
                        ? "border-warning/30 bg-warning/10 text-warning"
                        : "border-success/30 bg-success/10 text-success",
                    )}
                  >
                    {assignedNumberIsDemo ? "Ready for Twilio provisioning" : "Provisioned"}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <Label>Main line</Label>
                  <Input
                    value={String(draft.mainPhone ?? "")}
                    onChange={(event) => {
                      updateField("mainPhone", event.target.value);
                      if (!phoneSearchAreaCode) setPhoneSearchAreaCode(inferAreaCode(event.target.value));
                    }}
                    placeholder="+1 (415) 555-0148"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Forwarding mode</Label>
                  <Select
                    value={String(draft.forwardingMode ?? "Forward only unanswered calls")}
                    onValueChange={(value) => updateField("forwardingMode", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Forward all calls">Forward all calls</SelectItem>
                      <SelectItem value="Forward only unanswered calls">Forward only unanswered calls</SelectItem>
                      <SelectItem value="After-hours forwarding">After-hours forwarding</SelectItem>
                      <SelectItem value="Port number later">Port number later</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-end gap-2">
                    <div className="min-w-0 flex-1 space-y-2">
                      <Label>Search SignalHost numbers</Label>
                      <Input
                        inputMode="numeric"
                        maxLength={3}
                        onChange={(event) => setPhoneSearchAreaCode(event.target.value.replace(/\D/g, "").slice(0, 3))}
                        placeholder="415"
                        value={phoneSearchAreaCode}
                      />
                    </div>
                    <Button variant="outline" onClick={searchPhoneNumbers} disabled={searchingNumbers}>
                      {searchingNumbers ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Search className="mr-1.5 h-3.5 w-3.5" />}
                      Search
                    </Button>
                  </div>

                  {phoneSearchError && (
                    <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-xs text-muted-foreground">
                      {phoneSearchError}
                    </div>
                  )}

                  {availableNumbers.length > 0 && (
                    <div className="divide-y divide-border rounded-md border border-border">
                      {availableNumbers.map((number) => (
                        <div key={number.phoneNumber} className="flex items-center justify-between gap-3 p-3">
                          <div className="min-w-0">
                            <div className="font-mono text-sm font-semibold">{number.phoneNumber}</div>
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              {[number.locality, number.region].filter(Boolean).join(", ") || number.friendlyName || "US local number"}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => provisionNumber(number.phoneNumber)}
                            disabled={Boolean(provisioningNumber)}
                          >
                            {provisioningNumber === number.phoneNumber ? (
                              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <PhoneForwarded className="mr-1.5 h-3.5 w-3.5" />
                            )}
                            Assign
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Separator />

                <div className="rounded-md border border-primary/20 bg-primary/5 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">Forwarding instruction</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {buildForwardingInstruction(String(draft.forwardingMode ?? ""), assignedNumber, businessTemplate.businessNoun)}
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => {
                        void navigator.clipboard?.writeText(
                          buildForwardingInstruction(String(draft.forwardingMode ?? ""), assignedNumber, businessTemplate.businessNoun),
                        );
                        toast.success("Forwarding instruction copied");
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="rounded-md border border-border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">No-busy-signal verification</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Verify the phone setup before promising overflow coverage.
                      </div>
                    </div>
                    <Badge variant="outline" className={verificationBadgeClass(forwardingVerificationStatus)}>
                      {verificationStatusLabel(forwardingVerificationStatus)}
                    </Badge>
                  </div>

                  <div className="mt-3 space-y-2">
                    {forwardingVerificationChecks.map((check) => {
                      const status = forwardingVerification[check.key] ?? "pending";

                      return (
                        <div key={check.key} className="rounded-md border border-border bg-muted/20 p-3">
                          <div className="flex items-start gap-2">
                            {status === "passed" ? (
                              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                            ) : status === "failed" ? (
                              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                            ) : (
                              <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium">{check.label}</div>
                              <div className="mt-0.5 text-xs text-muted-foreground">{check.description}</div>
                            </div>
                            <Badge variant="secondary" className="capitalize">
                              {status.replace("_", " ")}
                            </Badge>
                          </div>
                          <div className="mt-3 flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateForwardingVerification(check.key, "failed")}
                              disabled={Boolean(savingVerificationKey)}
                            >
                              {savingVerificationKey === `${check.key}-failed` ? (
                                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                              ) : null}
                              Failed
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => updateForwardingVerification(check.key, "passed")}
                              disabled={Boolean(savingVerificationKey)}
                            >
                              {savingVerificationKey === `${check.key}-passed` ? (
                                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                              ) : null}
                              Passed
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {forwardingVerificationStatus !== "verified" && (
                    <div className="mt-3 rounded-md border border-warning/30 bg-warning/10 p-3 text-xs text-muted-foreground">
                      Until busy-line and no-answer forwarding both pass, position this setup as missed-call coverage,
                      not guaranteed no-busy-signal coverage for this {businessTemplate.businessNoun}.
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  {launchChecklist.map((item, index) => (
                    <div key={item} className="flex gap-3 rounded-md border border-border p-3 text-sm">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold tabular-nums">
                        {index + 1}
                      </div>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Rocket className="h-4 w-4 text-primary" />
                  Production workstreams
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {productionWorkstreams.map((workstream, index) => (
                  <div key={workstream} className="flex gap-3 rounded-md border border-border p-3 text-sm">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary tabular-nums">
                      {index + 1}
                    </div>
                    <span>{workstream}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </PageBody>
    </>
  );

  function getSectionProgress(sectionId: OnboardingStepId, currentDraft: OnboardingDraft) {
    const section = activeOnboardingSections.find((item) => item.id === sectionId);
    const requiredFields = section?.fields.filter((field) => field.required) ?? [];
    const completed = requiredFields.filter((field) => hasDraftValue(currentDraft[field.id])).length;

    return {
      complete: requiredFields.length > 0 && completed === requiredFields.length,
      completed,
      total: requiredFields.length,
    };
  }
}

function LaunchAssistantStepCard({ step }: { step: LaunchAssistantStep }) {
  const Icon = step.status === "done" ? CheckCircle2 : step.status === "blocked" ? AlertTriangle : Clock3;

  return (
    <div className="rounded-md border border-border bg-background/80 p-3">
      <div className="flex items-start gap-2">
        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", launchStepIconClass(step.status))} />
        <div className="min-w-0">
          <div className="text-sm font-medium">{step.label}</div>
          <div className="mt-1 text-xs leading-5 text-muted-foreground">{step.detail}</div>
        </div>
      </div>
    </div>
  );
}

function OnboardingFieldControl({
  draft,
  field,
  onChange,
}: {
  draft: OnboardingDraft;
  field: OnboardingField;
  onChange: (value: string | boolean) => void;
}) {
  const value = draft[field.id];

  if (field.control === "toggle") {
    return (
      <div className="flex items-center justify-between gap-4 rounded-md border border-border p-3">
        <div>
          <Label className="text-sm">{field.label}</Label>
          <div className="mt-1 text-xs text-muted-foreground">{field.prompt}</div>
        </div>
        <Switch checked={value === true} onCheckedChange={onChange} />
      </div>
    );
  }

  if (field.control === "select") {
    return (
      <div className="space-y-1.5">
        <FieldLabel field={field} />
        <Select value={String(value ?? "")} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select option" />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((option) => (
              <SelectItem key={optionValue(option)} value={optionValue(option)}>
                {optionLabel(option)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{field.prompt}</p>
      </div>
    );
  }

  if (field.control === "long") {
    return (
      <div className="space-y-1.5">
        <FieldLabel field={field} />
        <Textarea
          rows={3}
          value={String(value ?? "")}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder}
        />
        <p className="text-xs text-muted-foreground">{field.prompt}</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <FieldLabel field={field} />
      <Input
        type={field.control === "url" ? "url" : "text"}
        value={String(value ?? "")}
        onChange={(event) => onChange(event.target.value)}
        placeholder={field.placeholder}
      />
      <p className="text-xs text-muted-foreground">{field.prompt}</p>
    </div>
  );
}

function FieldLabel({ field }: { field: OnboardingField }) {
  return (
    <div className="flex items-center gap-2">
      <Label>{field.label}</Label>
      {field.required && <Badge variant="secondary" className="text-[10px]">Required</Badge>}
    </div>
  );
}

function optionValue(option: OnboardingFieldOption) {
  return typeof option === "string" ? option : option.value;
}

function optionLabel(option: OnboardingFieldOption) {
  return typeof option === "string" ? option : option.label;
}

function hasDraftValue(value: string | boolean | undefined) {
  if (typeof value === "boolean") return true;
  return typeof value === "string" && value.trim().length > 0;
}

function buildLaunchAssistantSteps({
  assignedNumberIsDemo,
  forwardingVerificationStatus,
  progressPercent,
  syncState,
  voiceConfigured,
}: {
  assignedNumberIsDemo: boolean;
  forwardingVerificationStatus: ReturnType<typeof buildVerificationStatus>;
  progressPercent: number;
  syncState: "local" | "loading" | "live" | "error";
  voiceConfigured: boolean;
}): LaunchAssistantStep[] {
  return [
    {
      detail: workspaceLaunchDetail(syncState),
      label: "Workspace",
      status: syncState === "error" ? "blocked" : syncState === "loading" ? "current" : "done",
    },
    {
      detail: progressPercent >= 85 ? "Enough answers for a strong first call." : `${progressPercent}% complete. Fill the required blanks before forwarding real traffic.`,
      label: "Interview",
      status: progressPercent >= 85 ? "done" : "current",
    },
    {
      detail: assignedNumberIsDemo
        ? voiceConfigured
          ? "Assign a real Twilio number from the trial pool."
          : "Connect the voice service before assigning a number."
        : "A real SignalHost number is attached to this location.",
      label: "Trial number",
      status: assignedNumberIsDemo ? (voiceConfigured ? "current" : "blocked") : "done",
    },
    {
      detail: forwardingVerificationStatus === "verified" ? "Direct, no-answer, and busy-line tests passed." : "Call the AI number first, then verify forwarding.",
      label: "Forwarding",
      status: forwardingVerificationStatus === "verified" ? "done" : assignedNumberIsDemo ? "pending" : "current",
    },
  ];
}

function workspaceLaunchDetail(syncState: "local" | "loading" | "live" | "error") {
  if (syncState === "live") return "Workspace and knowledge profile are connected.";
  if (syncState === "error") return "Saved locally, but cloud sync needs attention.";
  if (syncState === "local") return "Saved locally until Supabase is connected.";
  return "Saving the workspace profile.";
}

function launchStepIconClass(status: LaunchAssistantStep["status"]) {
  if (status === "done") return "text-success";
  if (status === "blocked") return "text-destructive";
  if (status === "current") return "text-primary";
  return "text-muted-foreground";
}

function inferAreaCode(phoneNumber: string) {
  const digits = phoneNumber.replace(/\D/g, "");
  if (digits.length >= 11 && digits.startsWith("1")) return digits.slice(1, 4);
  if (digits.length >= 10) return digits.slice(0, 3);
  return "";
}

function mapForwardingMode(value: string) {
  if (value === "Forward all calls") return "forward_all";
  if (value === "After-hours forwarding") return "after_hours";
  if (value === "Port number later") return "port_later";
  return "forward_unanswered";
}

function buildForwardingInstruction(forwardingMode: string, assignedNumber: string, businessNoun = "business") {
  if (forwardingMode === "Forward all calls") {
    return `Forward all inbound calls from the ${businessNoun} main line to ${assignedNumber}.`;
  }

  if (forwardingMode === "After-hours forwarding") {
    return `Set after-hours call forwarding to ${assignedNumber} when the ${businessNoun} is closed.`;
  }

  if (forwardingMode === "Port number later") {
    return `Keep the current main line active for now. Use ${assignedNumber} for test calls before starting a port request.`;
  }

  return `Forward unanswered calls to ${assignedNumber} after the ${businessNoun} line rings 3 to 4 times.`;
}

function buildLaunchChecklist(template: ReturnType<typeof getOnboardingBusinessTemplate>) {
  const isRestaurant = template.id === "restaurant";

  if (isRestaurant) {
    return [
      "Call the assigned SignalHost number directly.",
      "Ask hours, parking, menu, and allergy questions.",
      "Place a pay-at-pickup order and confirm it appears in Orders.",
      "Forward unanswered calls from the restaurant main line.",
      "Call the restaurant main line from a mobile phone.",
      "Review the call transcript, order, and staff alert behavior.",
    ];
  }

  return [
    "Call the assigned SignalHost number directly.",
    `Ask hours, service area, ${template.offeringNoun}, and safety or policy questions.`,
    `Request ${withIndefiniteArticle(template.appointmentNoun)}, estimate, or staff callback and confirm it appears in Tasks.`,
    `Forward unanswered calls from the ${template.businessNoun} main line.`,
    `Call the ${template.businessNoun} main line from a mobile phone.`,
    "Review the transcript, recording, captured request, and staff alert behavior.",
  ];
}

function buildForwardingVerificationChecks(template: ReturnType<typeof getOnboardingBusinessTemplate>): ForwardingVerificationCheck[] {
  return [
    {
      description: "Call the assigned SignalHost number directly and confirm the AI answers.",
      key: "directCall",
      label: "Direct AI number",
    },
    {
      description: `Let the ${template.businessNoun} main line ring unanswered and confirm the call reaches SignalHost.`,
      key: "noAnswerForwarding",
      label: "No-answer forwarding",
    },
    {
      description: `Keep the ${template.businessNoun} line busy, place a second call, and confirm it reaches SignalHost instead of busy/call-waiting/voicemail.`,
      key: "busyForwarding",
      label: "Busy-line forwarding",
    },
  ];
}

function withIndefiniteArticle(noun: string) {
  return `${/^[aeiou]/i.test(noun) ? "an" : "a"} ${noun}`;
}

function mergeDraftForBusinessTypeChange(current: OnboardingDraft, nextBusinessType: string): OnboardingDraft {
  const currentTemplate = getOnboardingBusinessTemplate(current);
  const nextDefaults = createOnboardingDraftForBusiness(nextBusinessType);
  const businessNameWasEdited =
    typeof current.restaurantName === "string" &&
    current.restaurantName.trim().length > 0 &&
    current.restaurantName !== currentTemplate.defaultName;
  const conceptWasEdited =
    typeof current.concept === "string" &&
    current.concept.trim().length > 0 &&
    current.concept !== currentTemplate.defaultOffering;

  return {
    ...nextDefaults,
    assignedSignalHostNumber: current.assignedSignalHostNumber || nextDefaults.assignedSignalHostNumber,
    businessType: nextDefaults.businessType,
    callHandling: current.callHandling || nextDefaults.callHandling,
    concept: conceptWasEdited ? current.concept : nextDefaults.concept,
    escalationPhone: current.escalationPhone || nextDefaults.escalationPhone,
    forwardingMode: current.forwardingMode || nextDefaults.forwardingMode,
    hostName: current.hostName || nextDefaults.hostName,
    mainPhone: current.mainPhone || nextDefaults.mainPhone,
    primaryLocation: businessNameWasEdited ? current.primaryLocation || nextDefaults.primaryLocation : nextDefaults.primaryLocation,
    restaurantName: businessNameWasEdited ? current.restaurantName : nextDefaults.restaurantName,
    selectedPlanId: current.selectedPlanId,
    selectedPlanIncludedInteractions: current.selectedPlanIncludedInteractions,
    selectedPlanMonthly: current.selectedPlanMonthly,
    selectedPlanName: current.selectedPlanName,
    selectedPlanOverage: current.selectedPlanOverage,
    smsConfirmations: current.smsConfirmations ?? nextDefaults.smsConfirmations,
    timezone: current.timezone || nextDefaults.timezone,
    tone: current.tone || nextDefaults.tone,
    voiceGender: current.voiceGender || nextDefaults.voiceGender,
  };
}

function buildVerificationStatus(verification: ForwardingVerification) {
  const statuses = [verification.directCall, verification.noAnswerForwarding, verification.busyForwarding];

  if (statuses.every((status) => status === "passed" || status === "not_applicable")) return "verified";
  if (statuses.some((status) => status === "failed")) return "needs_attention";
  if (statuses.some((status) => status === "passed")) return "partial";
  return "not_verified";
}

function verificationStatusLabel(status: ReturnType<typeof buildVerificationStatus>) {
  if (status === "verified") return "No-busy verified";
  if (status === "needs_attention") return "Needs attention";
  if (status === "partial") return "Partially verified";
  return "Not verified";
}

function verificationBadgeClass(status: ReturnType<typeof buildVerificationStatus>) {
  if (status === "verified") return "border-success/30 bg-success/10 text-success";
  if (status === "needs_attention") return "border-destructive/30 bg-destructive/10 text-destructive";
  if (status === "partial") return "border-warning/30 bg-warning/10 text-warning";
  return "bg-muted text-muted-foreground";
}
