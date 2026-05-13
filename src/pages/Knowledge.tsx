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
  fetchKnowledgeSectionsFromSupabase,
  isKnowledgePersistenceConfigured,
  updateKnowledgeSectionInSupabase,
  type KnowledgeSectionRecord,
} from "@/lib/supabase-rest";
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
} from "lucide-react";
import { toast } from "sonner";

const EVENT_TYPES: EventType[] = ["Live music", "DJ", "Trivia", "Open mic", "Other"];

type DisplayKnowledgeSection = KnowledgeSectionRecord & {
  sample?: boolean;
  uses?: number;
};

export default function Knowledge() {
  const queryClient = useQueryClient();
  const liveConfigured = isKnowledgePersistenceConfigured();
  const [items, setItems] = useState(faqs);
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

  const knowledgeQuery = useQuery({
    enabled: liveConfigured,
    queryFn: () => fetchKnowledgeSectionsFromSupabase(),
    queryKey: ["knowledge-sections"],
    refetchInterval: 60_000,
  });

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
  const businessSections: DisplayKnowledgeSection[] = liveConfigured
    ? activeLiveSections.filter((section) => !section.isBehaviorTuning)
    : sampleSections;
  const inactiveTuningCount = liveSections.filter((section) => section.isBehaviorTuning && !section.isActive).length;
  const sortedEvents = [...events].sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));

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
        description="What the AI host knows and the active tuning notes shaping its behavior"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={liveConfigured ? "border-success/30 bg-success/10 text-success" : "border-warning/30 bg-warning/10 text-warning"}
            >
              {liveConfigured ? "Live knowledge" : "Sample mode"}
            </Badge>
            {liveConfigured && (
              <Button variant="outline" size="sm" onClick={() => void knowledgeQuery.refetch()} disabled={knowledgeQuery.isFetching}>
                <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", knowledgeQuery.isFetching && "animate-spin")} />
                Refresh
              </Button>
            )}
          </div>
        }
      />
      <PageBody className="space-y-5">
        <Card className="border-primary/20 bg-primary/5 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Bot className="h-4 w-4 text-primary" />
                Active AI tuning notes
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                QA notes saved to knowledge are now included in Vera's runtime instructions. They are behavior corrections, not caller-facing facts.
              </p>
              {liveConfigured && (
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

          {!liveConfigured ? (
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
                Facts Vera can use for hours, policies, menu questions, events, directions, and common caller questions.
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
              <p className="text-xs text-muted-foreground">Question and answer pairs the AI host can reference.</p>
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
              <p className="text-xs text-muted-foreground">The AI host will reference these when callers ask about live music, DJs, or events.</p>
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
                {sortedEvents.length === 0 && <EmptyState text="No events scheduled. Add tonight's act so the AI host can answer event questions." />}
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
