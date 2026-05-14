import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageBody, PageHeader } from "@/components/PageHeader";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { faqs, knowledgeSections } from "@/data/mock";
import {
  buildBusinessLiveContext,
  businessModes,
  createTemporaryUpdate,
  expirationLabels,
  getBusinessMode,
  summarizeLiveContext,
  temporaryUpdateTypeLabels,
  type BusinessMode,
  type TemporaryBusinessUpdate,
  type TemporaryUpdateExpiration,
  type TemporaryUpdateType,
} from "@/domain/business-updates";
import {
  clearBusinessLiveUpdateInSupabase,
  applyKnowledgeSuggestionInSupabase,
  createBusinessLiveUpdateInSupabase,
  fetchBusinessLiveStateFromSupabase,
  fetchKnowledgeSuggestionsFromSupabase,
  fetchKnowledgeSectionsFromSupabase,
  getActiveSupabaseLocationId,
  isBusinessLiveUpdatesPersistenceConfigured,
  isKnowledgePersistenceConfigured,
  isKnowledgeSuggestionPersistenceConfigured,
  saveBusinessLiveModeToSupabase,
  updateKnowledgeSuggestionInSupabase,
  updateKnowledgeSectionInSupabase,
  type KnowledgeSectionRecord,
} from "@/lib/supabase-rest";
import {
  knowledgeSuggestionPriorityLabels,
  knowledgeSuggestionSourceLabels,
  type KnowledgeSuggestion,
} from "@/domain/knowledge-suggestions";
import {
  businessLiveUpdatesEvent,
  businessLiveUpdatesStorageKey,
  createDefaultBusinessLiveUpdates,
  loadBusinessLiveState,
  saveBusinessLiveState,
} from "@/lib/business-live-updates-storage";
import { cn } from "@/lib/utils";
import type { EntertainmentEvent, EntertainmentSource, EventType, SyncFrequency } from "@/types/sources";
import {
  AlertTriangle,
  BookOpen,
  Bot,
  CalendarDays,
  CheckCircle2,
  EyeOff,
  Globe,
  Link2,
  Music,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

const EVENT_TYPES: EventType[] = ["Live music", "DJ", "Trivia", "Open mic", "Other"];
const UPDATE_TYPES: TemporaryUpdateType[] = ["special", "hours", "closure", "promotion", "staffing", "service_status", "event", "policy"];
const EXPIRATIONS: TemporaryUpdateExpiration[] = ["today_close", "tomorrow_close", "custom", "until_cleared"];

type DisplayKnowledgeSection = KnowledgeSectionRecord & {
  sample?: boolean;
  uses?: number;
};

type TemporaryUpdateDraft = {
  body: string;
  customExpiresAt: string;
  expiration: TemporaryUpdateExpiration;
  mode: BusinessMode | "none";
  title: string;
  type: TemporaryUpdateType;
};

export default function Knowledge() {
  const queryClient = useQueryClient();
  const knowledgeConfigured = isKnowledgePersistenceConfigured();
  const suggestionsConfigured = isKnowledgeSuggestionPersistenceConfigured();
  const liveUpdatesConfigured = isBusinessLiveUpdatesPersistenceConfigured();
  const activeLocationId = getActiveSupabaseLocationId();
  const [items, setItems] = useState(faqs);
  const [businessLiveState, setBusinessLiveState] = useState(() =>
    loadBusinessLiveState({ defaultUpdates: createDefaultBusinessLiveUpdates() }),
  );
  const [updateDraft, setUpdateDraft] = useState<TemporaryUpdateDraft>({
    body: "",
    customExpiresAt: "",
    expiration: "today_close",
    mode: "none",
    title: "",
    type: "special",
  });
  const [musicSources, setMusicSources] = useState<EntertainmentSource[]>([]);
  const [newMusicUrl, setNewMusicUrl] = useState("");
  const [newMusicFreq, setNewMusicFreq] = useState<SyncFrequency>("daily");
  const [events, setEvents] = useState<EntertainmentEvent[]>([
    {
      date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      endTime: "23:00",
      id: "e1",
      notes: "No cover",
      performer: "The Wandering Trio",
      startTime: "20:00",
      type: "Live music",
    },
  ]);
  const [draft, setDraft] = useState<Partial<EntertainmentEvent>>({ type: "Live music" });
  const businessMode = businessLiveState.mode;
  const temporaryUpdates = businessLiveState.updates;

  const knowledgeQuery = useQuery({
    enabled: knowledgeConfigured,
    queryFn: () => fetchKnowledgeSectionsFromSupabase(),
    queryKey: ["knowledge-sections"],
    refetchInterval: 60_000,
  });
  const suggestionsQuery = useQuery({
    enabled: suggestionsConfigured,
    queryFn: () => fetchKnowledgeSuggestionsFromSupabase(),
    queryKey: ["knowledge-suggestions", activeLocationId],
    refetchInterval: 60_000,
    retry: 1,
  });

  const businessLiveQuery = useQuery({
    enabled: liveUpdatesConfigured,
    queryFn: () => fetchBusinessLiveStateFromSupabase(),
    queryKey: ["business-live-state", activeLocationId],
    refetchInterval: 60_000,
    retry: 1,
  });
  const liveUpdatesWritable = liveUpdatesConfigured && !businessLiveQuery.isError;

  const updateKnowledgeMutation = useMutation({
    mutationFn: updateKnowledgeSectionInSupabase,
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not update knowledge");
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["knowledge-sections"] });
      toast.success("Knowledge updated");
    },
  });
  const applySuggestionMutation = useMutation({
    mutationFn: applyKnowledgeSuggestionInSupabase,
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not apply knowledge update");
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["knowledge-sections"] }),
        queryClient.invalidateQueries({ queryKey: ["knowledge-suggestions", activeLocationId] }),
      ]);
      toast.success("Knowledge update approved and applied");
    },
  });
  const rejectSuggestionMutation = useMutation({
    mutationFn: (id: string) => updateKnowledgeSuggestionInSupabase({ id, status: "rejected" }),
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not reject knowledge update");
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["knowledge-suggestions", activeLocationId] });
      toast.success("Knowledge update rejected");
    },
  });

  const saveBusinessModeMutation = useMutation({
    mutationFn: saveBusinessLiveModeToSupabase,
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not save business mode");
    },
    onSuccess: async (mode) => {
      setBusinessLiveState((current) => saveBusinessLiveState({ ...current, mode }));
      await queryClient.invalidateQueries({ queryKey: ["business-live-state", activeLocationId] });
    },
  });

  const createBusinessLiveUpdateMutation = useMutation({
    mutationFn: createBusinessLiveUpdateInSupabase,
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not save live update");
    },
    onSuccess: async (update) => {
      setBusinessLiveState((current) => {
        const withoutDuplicate = current.updates.filter((item) => item.id !== update.id);
        return saveBusinessLiveState({ ...current, updates: [update, ...withoutDuplicate] });
      });
      await queryClient.invalidateQueries({ queryKey: ["business-live-state", activeLocationId] });
      toast.success("Live update added");
    },
  });

  const clearBusinessLiveUpdateMutation = useMutation({
    mutationFn: clearBusinessLiveUpdateInSupabase,
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not clear live update");
    },
    onSuccess: async (_result, updateId) => {
      setBusinessLiveState((current) => saveBusinessLiveState({
        ...current,
        updates: current.updates.filter((update) => update.id !== updateId),
      }));
      await queryClient.invalidateQueries({ queryKey: ["business-live-state", activeLocationId] });
      toast.success("Live update cleared");
    },
  });

  const liveSections = knowledgeQuery.data ?? [];
  const sampleSections = useMemo<DisplayKnowledgeSection[]>(
    () =>
      knowledgeSections.map((section) => ({
        body: section.body,
        id: section.id,
        isActive: true,
        isBehaviorTuning: false,
        locationId: "sample",
        sample: true,
        title: section.title,
        updatedAt: "",
        uses: section.uses,
      })),
    [],
  );
  const activeLiveSections = liveSections.filter((section) => section.isActive);
  const tuningNotes = activeLiveSections.filter((section) => section.isBehaviorTuning);
  const knowledgeSuggestions = suggestionsQuery.data ?? [];
  const pendingSuggestions = knowledgeSuggestions.filter((suggestion) => suggestion.status === "pending");
  const completedSuggestions = knowledgeSuggestions.length - pendingSuggestions.length;
  const businessSections: DisplayKnowledgeSection[] = knowledgeConfigured
    ? activeLiveSections.filter((section) => !section.isBehaviorTuning)
    : sampleSections;
  const inactiveTuningCount = liveSections.filter((section) => section.isBehaviorTuning && !section.isActive).length;
  const sortedEvents = [...events].sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
  const liveContext = useMemo(
    () => buildBusinessLiveContext({ mode: businessMode, updates: temporaryUpdates }),
    [businessMode, temporaryUpdates],
  );
  const selectedBusinessMode = getBusinessMode(businessMode);

  useEffect(() => {
    const syncLiveState = () => {
      setBusinessLiveState(loadBusinessLiveState({ defaultUpdates: createDefaultBusinessLiveUpdates() }));
    };
    const syncFromStorage = (event: StorageEvent) => {
      if (event.key === businessLiveUpdatesStorageKey) syncLiveState();
    };

    window.addEventListener(businessLiveUpdatesEvent, syncLiveState);
    window.addEventListener("storage", syncFromStorage);
    return () => {
      window.removeEventListener(businessLiveUpdatesEvent, syncLiveState);
      window.removeEventListener("storage", syncFromStorage);
    };
  }, []);

  useEffect(() => {
    if (businessLiveQuery.data) {
      setBusinessLiveState(saveBusinessLiveState(businessLiveQuery.data));
    }
  }, [businessLiveQuery.data]);

  const persistLiveState = (next: { mode?: BusinessMode; updates?: TemporaryBusinessUpdate[] }) => {
    const saved = saveBusinessLiveState({
      mode: next.mode ?? businessLiveState.mode,
      updates: next.updates ?? businessLiveState.updates,
    });
    setBusinessLiveState(saved);
  };

  const persistBusinessMode = (mode: BusinessMode) => {
    persistLiveState({ mode });
    if (liveUpdatesWritable) {
      saveBusinessModeMutation.mutate(mode);
    }
  };

  const addSource = () => {
    try {
      const url = new URL(newMusicUrl.trim());
      if (!/^https?:$/.test(url.protocol)) throw new Error();
      setMusicSources([
        ...musicSources,
        {
          frequency: newMusicFreq,
          id: crypto.randomUUID(),
          lastSyncedAt: "Never",
          status: "pending",
          url: url.toString(),
        },
      ]);
      setNewMusicUrl("");
      toast.success("Source added. First sync queued.");
    } catch {
      toast.error("Enter a valid http(s) URL");
    }
  };

  const addTemporaryUpdate = () => {
    if (!updateDraft.title.trim() || !updateDraft.body.trim()) {
      toast.error("Add a title and the exact thing SignalHost should know.");
      return;
    }
    if (updateDraft.expiration === "custom" && !updateDraft.customExpiresAt) {
      toast.error("Choose when this update should expire.");
      return;
    }

    const update = createTemporaryUpdate({
      body: updateDraft.body,
      customExpiresAt: updateDraft.customExpiresAt,
      expiration: updateDraft.expiration,
      mode: updateDraft.mode === "none" ? undefined : updateDraft.mode,
      title: updateDraft.title,
      type: updateDraft.type,
    });
    setUpdateDraft({
      body: "",
      customExpiresAt: "",
      expiration: "today_close",
      mode: "none",
      title: "",
      type: "special",
    });
    if (liveUpdatesWritable) {
      createBusinessLiveUpdateMutation.mutate(update);
    } else {
      persistLiveState({ updates: [update, ...temporaryUpdates] });
      toast.success("Live update added");
    }
  };

  const clearTemporaryUpdate = (id: string) => {
    if (liveUpdatesWritable) {
      clearBusinessLiveUpdateMutation.mutate(id);
    } else {
      persistLiveState({ updates: temporaryUpdates.filter((update) => update.id !== id) });
      toast.success("Live update cleared");
    }
  };

  const addEvent = () => {
    if (!draft.date || !draft.startTime || !draft.performer) {
      toast.error("Date, start time, and performer are required");
      return;
    }
    setEvents([
      ...events,
      {
        date: draft.date,
        endTime: draft.endTime || "",
        id: crypto.randomUUID(),
        notes: draft.notes,
        performer: draft.performer,
        startTime: draft.startTime,
        type: (draft.type as EventType) || "Live music",
      },
    ]);
    setDraft({ type: "Live music" });
    toast.success("Event added");
  };

  const saveKnowledgeSection = (section: DisplayKnowledgeSection, input: { body: string; title: string }) => {
    if (section.sample) {
      toast.success("Sample knowledge saved locally for this preview");
      return;
    }
    updateKnowledgeMutation.mutate({
      body: input.body,
      id: section.id,
      isActive: true,
      title: input.title,
    });
  };

  const deactivateKnowledgeSection = (section: KnowledgeSectionRecord) => {
    updateKnowledgeMutation.mutate({
      id: section.id,
      isActive: false,
    });
  };

  return (
    <>
      <PageHeader
        title="Knowledge Base"
        description="What SignalHost knows and the active tuning notes shaping its behavior"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={knowledgeConfigured ? "border-success/30 bg-success/10 text-success" : "border-warning/30 bg-warning/10 text-warning"}
            >
              {knowledgeConfigured ? "Live knowledge" : "Sample mode"}
            </Badge>
            {knowledgeConfigured && (
              <Button variant="outline" size="sm" onClick={() => void knowledgeQuery.refetch()} disabled={knowledgeQuery.isFetching}>
                <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", knowledgeQuery.isFetching && "animate-spin")} />
                Refresh
              </Button>
            )}
          </div>
        }
      />
      <PageBody className="space-y-5">
        <Card className="overflow-hidden border-primary/20">
          <div className="grid gap-0 xl:grid-cols-[0.95fr_1.2fr]">
            <div className="border-b border-border bg-primary/5 p-5 xl:border-b-0 xl:border-r">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Zap className="h-4 w-4 text-primary" />
                Live updates & modes
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Temporary instructions sit above permanent knowledge. Use them for today's specials, weather closures, staff shortages, holiday rules, or service surges.
              </p>
              <div className="mt-4 space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">Current mode</Label>
                <Select value={businessMode} onValueChange={(value) => persistBusinessMode(value as BusinessMode)}>
                  <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {businessModes.map((mode) => (
                      <SelectItem key={mode.id} value={mode.id}>{mode.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="rounded-md border border-border bg-background/80 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={selectedBusinessMode.urgency === "urgent" ? "border-destructive/30 bg-destructive/10 text-destructive" : selectedBusinessMode.urgency === "high" ? "border-warning/30 bg-warning/10 text-warning" : "border-primary/30 bg-primary/10 text-primary"}>
                      {selectedBusinessMode.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{selectedBusinessMode.description}</span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">{selectedBusinessMode.operatorCue}</p>
                </div>
              </div>
              <div className="mt-4 rounded-md border border-border bg-background/80 p-3 text-xs leading-5 text-muted-foreground">
                {summarizeLiveContext(liveContext)}
              </div>
            </div>

            <div className="p-5">
              <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                <div className="space-y-3">
                  <div>
                    <div className="text-xs font-medium uppercase text-muted-foreground">Add live update</div>
                    <p className="text-xs text-muted-foreground">Write it the way a manager would brief a front desk person.</p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Type</Label>
                      <Select value={updateDraft.type} onValueChange={(value) => setUpdateDraft({ ...updateDraft, type: value as TemporaryUpdateType })}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {UPDATE_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>{temporaryUpdateTypeLabels[type]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Expires</Label>
                      <Select value={updateDraft.expiration} onValueChange={(value) => setUpdateDraft({ ...updateDraft, expiration: value as TemporaryUpdateExpiration })}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {EXPIRATIONS.map((expiration) => (
                            <SelectItem key={expiration} value={expiration}>{expirationLabels[expiration]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs">Mode scope</Label>
                      <Select value={updateDraft.mode} onValueChange={(value) => setUpdateDraft({ ...updateDraft, mode: value as BusinessMode | "none" })}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Any mode</SelectItem>
                          {businessModes.map((mode) => (
                            <SelectItem key={mode.id} value={mode.id}>{mode.label} only</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs">Title</Label>
                      <Input
                        value={updateDraft.title}
                        onChange={(event) => setUpdateDraft({ ...updateDraft, title: event.target.value })}
                        placeholder="Tonight's special, closed for storm, running behind..."
                        className="h-9"
                      />
                    </div>
                    {updateDraft.expiration === "custom" && (
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label className="text-xs">Custom expiration</Label>
                        <Input
                          type="datetime-local"
                          value={updateDraft.customExpiresAt}
                          onChange={(event) => setUpdateDraft({ ...updateDraft, customExpiresAt: event.target.value })}
                          className="h-9"
                        />
                      </div>
                    )}
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs">Temporary instruction</Label>
                      <Textarea
                        value={updateDraft.body}
                        onChange={(event) => setUpdateDraft({ ...updateDraft, body: event.target.value })}
                        placeholder="Example: Tell callers we are fully booked tonight, but they can join the walk-in waitlist at the door."
                        rows={3}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button size="sm" onClick={addTemporaryUpdate}>
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      Add update
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="text-xs font-medium uppercase text-muted-foreground">Active for SignalHost</div>
                    <p className="text-xs text-muted-foreground">These are the rules SignalHost would apply before regular knowledge.</p>
                    {businessLiveQuery.isError && (
                      <p className="mt-2 rounded-md border border-warning/30 bg-warning/10 p-2 text-xs text-warning">
                        Live-update tables are not reachable yet, so this page is using local browser storage.
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    {liveContext.activeUpdates.length === 0 && <EmptyState text="No live updates are active." />}
                    {liveContext.activeUpdates.map((update) => (
                      <TemporaryUpdateRow key={update.id} update={update} onClear={() => clearTemporaryUpdate(update.id)} />
                    ))}
                  </div>
                  {liveContext.expiredUpdates.length > 0 && (
                    <div className="rounded-md border border-dashed border-border p-3">
                      <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">Expired</div>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        {liveContext.expiredUpdates.slice(0, 3).map((update) => (
                          <div key={update.id} className="flex items-center justify-between gap-2">
                            <span className="truncate">{update.title}</span>
                            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => clearTemporaryUpdate(update.id)}>Clear</Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card className="border-warning/30 bg-warning/5 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="h-4 w-4 text-warning" />
                Suggested knowledge updates
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                When a call review finds missing knowledge or a better answer, SignalHost queues it here before it changes live SignalHost behavior.
              </p>
              {knowledgeConfigured && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Approving one creates an active knowledge section. Rejected suggestions stay out of the live runtime.
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="border-warning/30 bg-background text-warning">
                {pendingSuggestions.length} pending
              </Badge>
              {completedSuggestions > 0 && (
                <Badge variant="outline" className="bg-background text-muted-foreground">
                  {completedSuggestions} reviewed
                </Badge>
              )}
            </div>
          </div>

          {!suggestionsConfigured ? (
            <div className="mt-4 rounded-md border border-dashed border-warning/40 bg-background/70 p-4 text-sm text-muted-foreground">
              Connect Supabase for this tenant to approve learning suggestions from real calls.
            </div>
          ) : suggestionsQuery.isError ? (
            <div className="mt-4 flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 p-4 text-sm text-muted-foreground">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <span>{suggestionsQuery.error instanceof Error ? suggestionsQuery.error.message : "Could not load suggested knowledge updates."}</span>
            </div>
          ) : pendingSuggestions.length === 0 ? (
            <div className="mt-4 rounded-md border border-dashed border-border bg-background/70 p-4 text-sm text-muted-foreground">
              No pending suggestions yet. Save QA feedback with "Queue this as a knowledge update" to build the learning loop.
            </div>
          ) : (
            <div className="mt-4 grid gap-3 xl:grid-cols-2">
              {pendingSuggestions.map((suggestion) => (
                <KnowledgeSuggestionRow
                  key={suggestion.id}
                  isApplying={applySuggestionMutation.isPending && applySuggestionMutation.variables?.id === suggestion.id}
                  isRejecting={rejectSuggestionMutation.isPending && rejectSuggestionMutation.variables === suggestion.id}
                  onApply={(input) => applySuggestionMutation.mutate(input)}
                  onReject={() => rejectSuggestionMutation.mutate(suggestion.id)}
                  suggestion={suggestion}
                />
              ))}
            </div>
          )}
        </Card>

        <Card className="border-primary/20 bg-primary/5 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Bot className="h-4 w-4 text-primary" />
                Active SignalHost tuning notes
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                QA notes saved to knowledge are now included in SignalHost's runtime instructions. They are behavior corrections, not caller-facing facts.
              </p>
              {knowledgeConfigured && (
                <p className="mt-1 text-xs text-muted-foreground">
                  The voice service caches restaurant context briefly, so changes can take about five minutes to show up in live calls.
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="border-primary/30 bg-background text-primary">
                {tuningNotes.length} active
              </Badge>
              {inactiveTuningCount > 0 && (
                <Badge variant="outline" className="bg-background text-muted-foreground">
                  {inactiveTuningCount} inactive
                </Badge>
              )}
            </div>
          </div>

          {!knowledgeConfigured ? (
            <div className="mt-4 rounded-md border border-dashed border-warning/40 bg-background/70 p-4 text-sm text-muted-foreground">
              Connect Supabase for this tenant to see active tuning notes created from real call QA.
            </div>
          ) : knowledgeQuery.isError ? (
            <div className="mt-4 flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 p-4 text-sm text-muted-foreground">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <span>{knowledgeQuery.error instanceof Error ? knowledgeQuery.error.message : "Could not load knowledge sections."}</span>
            </div>
          ) : tuningNotes.length === 0 ? (
            <div className="mt-4 rounded-md border border-dashed border-border bg-background/70 p-4 text-sm text-muted-foreground">
              No active tuning notes yet. Save QA notes with "Add to knowledge" from the Calls or QA Queue pages.
            </div>
          ) : (
            <div className="mt-4 grid gap-3 xl:grid-cols-2">
              {tuningNotes.map((note) => (
                <TuningNoteRow
                  key={note.id}
                  note={note}
                  isUpdating={updateKnowledgeMutation.isPending && updateKnowledgeMutation.variables?.id === note.id}
                  onDeactivate={() => deactivateKnowledgeSection(note)}
                />
              ))}
            </div>
          )}
        </Card>

        <Card className="p-0 overflow-hidden">
          <div className="flex flex-col gap-2 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <BookOpen className="h-4 w-4 text-primary" />
                Business knowledge
              </div>
              <p className="text-xs text-muted-foreground">
                Facts SignalHost can use for hours, policies, menu questions, events, directions, and common caller questions.
              </p>
            </div>
            <Badge variant="secondary" className="w-fit text-[10px]">
              {businessSections.length} sections
            </Badge>
          </div>

          {businessSections.length === 0 ? (
            <div className="p-6">
              <EmptyState text="No active knowledge sections yet." />
            </div>
          ) : (
            <Accordion type="multiple" defaultValue={businessSections.slice(0, 4).map((section) => section.id)}>
              {businessSections.map((section) => (
                <AccordionItem key={section.id} value={section.id} className="border-b border-border px-5 last:border-0">
                  <AccordionTrigger className="py-4 hover:no-underline">
                    <div className="flex flex-1 items-center justify-between gap-3 pr-3">
                      <div className="min-w-0 text-left">
                        <div className="truncate text-sm font-semibold">{section.title}</div>
                        <div className="line-clamp-1 text-xs text-muted-foreground">{section.body}</div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {section.sample ? (
                          <Badge variant="secondary" className="text-[10px] tabular-nums">Used {section.uses ?? 0}x / wk</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">Live</Badge>
                        )}
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-5">
                    <KnowledgeSectionEditor
                      isUpdating={updateKnowledgeMutation.isPending && updateKnowledgeMutation.variables?.id === section.id}
                      onSave={(input) => saveKnowledgeSection(section, input)}
                      section={section}
                    />
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <BookOpen className="h-4 w-4 text-primary" />
                Custom FAQs
              </div>
              <p className="text-xs text-muted-foreground">Question and answer pairs SignalHost can reference.</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setItems([...items, { a: "", q: "" }])}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add FAQ
            </Button>
          </div>
          <div className="space-y-2">
            {items.length === 0 && <EmptyState text="No FAQs yet. Add the questions callers ask most often." />}
            {items.map((faq, index) => (
              <div key={`${faq.q}-${index}`} className="space-y-2 rounded-md border border-border p-3">
                <Input defaultValue={faq.q} placeholder="Question" />
                <Textarea defaultValue={faq.a} rows={2} placeholder="Answer" />
                <div className="flex justify-end">
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setItems(items.filter((_, itemIndex) => itemIndex !== index))}>
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-start gap-2">
            <Music className="mt-0.5 h-4 w-4 text-primary" />
            <div>
              <div className="text-sm font-semibold">Music & Entertainment</div>
              <p className="text-xs text-muted-foreground">SignalHost will reference these when callers ask about live music, DJs, or events.</p>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase text-muted-foreground">
                <Globe className="h-3.5 w-3.5" />
                Live calendar URL
              </div>
              <div className="space-y-2">
                {musicSources.length === 0 && <EmptyState text={"No URLs yet. Add a \"what's on\" page and we will keep events fresh automatically."} />}
                {musicSources.map((source) => (
                  <div key={source.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2.5">
                    <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <a href={source.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-sm hover:underline">
                      {source.url}
                    </a>
                    <Badge
                      variant="outline"
                      className={
                        source.status === "synced"
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : source.status === "error"
                            ? "border-destructive/30 bg-destructive/10 text-destructive"
                            : "bg-muted text-muted-foreground"
                      }
                    >
                      {source.status}
                    </Badge>
                    <span className="text-xs tabular-nums text-muted-foreground">{source.frequency} - {source.lastSyncedAt}</span>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => toast.success("Sync queued")}>
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setMusicSources(musicSources.filter((item) => item.id !== source.id))}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Input
                  value={newMusicUrl}
                  onChange={(event) => setNewMusicUrl(event.target.value)}
                  placeholder="https://your-restaurant.com/events"
                  className="h-9 min-w-[180px] flex-1"
                />
                <Select value={newMusicFreq} onValueChange={(value) => setNewMusicFreq(value as SyncFrequency)}>
                  <SelectTrigger className="h-9 w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={addSource}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Add
                </Button>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" />
                Scheduled events
              </div>
              <div className="space-y-2">
                {sortedEvents.length === 0 && <EmptyState text="No events scheduled. Add tonight's act so SignalHost can answer event questions." />}
                {sortedEvents.map((event) => (
                  <div key={event.id} className="flex flex-wrap items-center gap-3 rounded-md border border-border p-3">
                    <div className="w-28 shrink-0 text-xs tabular-nums text-muted-foreground">
                      <div className="font-medium text-foreground">
                        {new Date(event.date).toLocaleDateString(undefined, { day: "numeric", month: "short", weekday: "short" })}
                      </div>
                      <div>{event.startTime}{event.endTime ? `-${event.endTime}` : ""}</div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{event.performer}</div>
                      {event.notes && <div className="truncate text-xs text-muted-foreground">{event.notes}</div>}
                    </div>
                    <Badge variant="secondary" className="text-[10px]">{event.type}</Badge>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setEvents(events.filter((item) => item.id !== event.id))}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="mt-3 rounded-md border border-dashed border-border p-3">
                <div className="grid gap-2 sm:grid-cols-12">
                  <div className="space-y-1 sm:col-span-3">
                    <Label className="text-xs">Date</Label>
                    <Input type="date" value={draft.date || ""} onChange={(event) => setDraft({ ...draft, date: event.target.value })} className="h-9" />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs">Start</Label>
                    <Input type="time" value={draft.startTime || ""} onChange={(event) => setDraft({ ...draft, startTime: event.target.value })} className="h-9" />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs">End</Label>
                    <Input type="time" value={draft.endTime || ""} onChange={(event) => setDraft({ ...draft, endTime: event.target.value })} className="h-9" />
                  </div>
                  <div className="space-y-1 sm:col-span-3">
                    <Label className="text-xs">Performer / act</Label>
                    <Input value={draft.performer || ""} onChange={(event) => setDraft({ ...draft, performer: event.target.value })} placeholder="e.g. Jazz Quartet" className="h-9" />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs">Type</Label>
                    <Select value={(draft.type as string) || "Live music"} onValueChange={(value) => setDraft({ ...draft, type: value as EventType })}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {EVENT_TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1 sm:col-span-12">
                    <Label className="text-xs">Notes (optional)</Label>
                    <Input value={draft.notes || ""} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="Cover charge, age restriction..." className="h-9" />
                  </div>
                </div>
                <div className="mt-3 flex justify-end">
                  <Button size="sm" onClick={addEvent}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Add event
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </PageBody>
    </>
  );
}

function KnowledgeSectionEditor({
  isUpdating,
  onSave,
  section,
}: {
  isUpdating: boolean;
  onSave: (input: { body: string; title: string }) => void;
  section: DisplayKnowledgeSection;
}) {
  const [title, setTitle] = useState(section.title);
  const [body, setBody] = useState(section.body);

  useEffect(() => {
    setTitle(section.title);
    setBody(section.body);
  }, [section.body, section.title]);

  const changed = title.trim() !== section.title || body.trim() !== section.body;

  return (
    <div className="space-y-3">
      <Input value={title} onChange={(event) => setTitle(event.target.value)} />
      <Textarea value={body} onChange={(event) => setBody(event.target.value)} rows={4} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {section.sample ? "Sample data only" : `Last updated ${formatUpdatedAt(section.updatedAt)}`}
        </span>
        <Button size="sm" variant="outline" onClick={() => onSave({ body, title })} disabled={isUpdating || !title.trim() || !body.trim() || !changed}>
          {isUpdating ? <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />}
          Save
        </Button>
      </div>
    </div>
  );
}

function TuningNoteRow({
  isUpdating,
  note,
  onDeactivate,
}: {
  isUpdating: boolean;
  note: KnowledgeSectionRecord;
  onDeactivate: () => void;
}) {
  const parsed = parseTuningBody(note.body);

  return (
    <div className="rounded-md border border-primary/20 bg-background/80 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
            <div className="truncate text-sm font-semibold">{cleanTuningTitle(note.title)}</div>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">Updated {formatUpdatedAt(note.updatedAt)}</div>
        </div>
        <Button size="sm" variant="outline" onClick={onDeactivate} disabled={isUpdating}>
          {isUpdating ? <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <EyeOff className="mr-1.5 h-3.5 w-3.5" />}
          Deactivate
        </Button>
      </div>

      <div className="mt-3 space-y-2 text-sm">
        {parsed.feedback && (
          <div>
            <div className="text-[11px] font-medium uppercase text-muted-foreground">What happened</div>
            <p className="mt-1">{parsed.feedback}</p>
          </div>
        )}
        {parsed.preferred && (
          <div className="rounded-md bg-primary/10 p-2">
            <div className="text-[11px] font-medium uppercase text-primary">Preferred behavior</div>
            <p className="mt-1">{parsed.preferred}</p>
          </div>
        )}
        {!parsed.feedback && !parsed.preferred && <p>{note.body}</p>}
        {parsed.source && <div className="text-[11px] text-muted-foreground">Source: {parsed.source}</div>}
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">{text}</div>;
}

function KnowledgeSuggestionRow({
  isApplying,
  isRejecting,
  onApply,
  onReject,
  suggestion,
}: {
  isApplying: boolean;
  isRejecting: boolean;
  onApply: (input: { body: string; id: string; title: string }) => void;
  onReject: () => void;
  suggestion: KnowledgeSuggestion;
}) {
  const [title, setTitle] = useState(suggestion.title);
  const [body, setBody] = useState(suggestion.body);

  useEffect(() => {
    setTitle(suggestion.title);
    setBody(suggestion.body);
  }, [suggestion.body, suggestion.title]);

  return (
    <div className="rounded-md border border-warning/30 bg-background/85 p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning">
          {knowledgeSuggestionPriorityLabels[suggestion.priority]}
        </Badge>
        <Badge variant="secondary" className="text-[10px]">
          {knowledgeSuggestionSourceLabels[suggestion.source]}
        </Badge>
        {suggestion.callId && (
          <span className="text-[11px] text-muted-foreground">Call {suggestion.callId.slice(0, 8)}</span>
        )}
      </div>

      <div className="mt-3 space-y-2">
        <Label className="text-xs font-medium text-muted-foreground">Title</Label>
        <Input value={title} onChange={(event) => setTitle(event.target.value)} />
      </div>

      <div className="mt-3 space-y-2">
        <Label className="text-xs font-medium text-muted-foreground">Knowledge to apply</Label>
        <Textarea value={body} onChange={(event) => setBody(event.target.value)} rows={5} />
      </div>

      {suggestion.suggestedAnswer && (
        <div className="mt-3 rounded-md bg-warning/10 p-3 text-sm">
          <div className="text-[11px] font-medium uppercase text-warning">Suggested answer</div>
          <p className="mt-1 text-muted-foreground">{suggestion.suggestedAnswer}</p>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">Queued {formatUpdatedAt(suggestion.createdAt)}</span>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={onReject} disabled={isApplying || isRejecting}>
            {isRejecting ? <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <EyeOff className="mr-1.5 h-3.5 w-3.5" />}
            Reject
          </Button>
          <Button size="sm" onClick={() => onApply({ body, id: suggestion.id, title })} disabled={isApplying || isRejecting || !title.trim() || !body.trim()}>
            {isApplying ? <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />}
            Approve & apply
          </Button>
        </div>
      </div>
    </div>
  );
}

function TemporaryUpdateRow({
  onClear,
  update,
}: {
  onClear: () => void;
  update: TemporaryBusinessUpdate;
}) {
  return (
    <div className="rounded-md border border-border bg-background/80 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-[10px]">{temporaryUpdateTypeLabels[update.type]}</Badge>
            {update.mode && (
              <Badge variant="secondary" className="text-[10px]">{getBusinessMode(update.mode).label}</Badge>
            )}
          </div>
          <div className="mt-2 text-sm font-semibold">{update.title}</div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{update.body}</p>
        </div>
        <Button size="sm" variant="outline" onClick={onClear}>Clear</Button>
      </div>
      <div className="mt-2 text-[11px] text-muted-foreground">
        {update.expiresAt ? `Expires ${formatUpdateExpiration(update.expiresAt)}` : "Active until cleared"}
      </div>
    </div>
  );
}

function parseTuningBody(body: string) {
  const feedback = body.match(/Feedback:\s*([\s\S]*?)(?:\n\s*\nPreferred answer:|\n\s*\nSource call:|$)/i)?.[1]?.trim();
  const preferred = body.match(/Preferred answer:\s*([\s\S]*?)(?:\n\s*\nSource call:|$)/i)?.[1]?.trim();
  const source = body.match(/Source call:\s*(.+)$/im)?.[1]?.trim();
  return { feedback, preferred, source };
}

function cleanTuningTitle(title: string) {
  return title.replace(/^call tuning\s*-\s*/i, "").trim() || "Reviewed call note";
}

function formatUpdatedAt(value: string) {
  if (!value) return "recently";
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

function formatUpdateExpiration(value: string) {
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
