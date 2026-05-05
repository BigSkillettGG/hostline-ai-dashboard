import { PageHeader, PageBody } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { knowledgeSections, faqs } from "@/data/mock";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Plus, Trash2, BookOpen, Music, Globe, Link2, RefreshCw, CalendarDays } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { EntertainmentSource, EntertainmentEvent, SyncFrequency, EventType } from "@/types/sources";

const EVENT_TYPES: EventType[] = ["Live music", "DJ", "Trivia", "Open mic", "Other"];

export default function Knowledge() {
  const [items, setItems] = useState(faqs);

  // TODO: replace local state with Lovable Cloud + Firecrawl-backed sync job
  const [musicSources, setMusicSources] = useState<EntertainmentSource[]>([]);
  const [newMusicUrl, setNewMusicUrl] = useState("");
  const [newMusicFreq, setNewMusicFreq] = useState<SyncFrequency>("daily");

  const [events, setEvents] = useState<EntertainmentEvent[]>([
    { id: "e1", date: new Date(Date.now() + 86400000).toISOString().slice(0, 10), startTime: "20:00", endTime: "23:00", performer: "The Wandering Trio", type: "Live music", notes: "No cover" },
  ]);
  const [draft, setDraft] = useState<Partial<EntertainmentEvent>>({ type: "Live music" });

  const addSource = () => {
    try {
      const u = new URL(newMusicUrl.trim());
      if (!/^https?:$/.test(u.protocol)) throw new Error();
      setMusicSources([...musicSources, { id: crypto.randomUUID(), url: u.toString(), frequency: newMusicFreq, lastSyncedAt: "—", status: "pending" }]);
      setNewMusicUrl("");
      toast.success("Source added — first sync queued");
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
        id: crypto.randomUUID(),
        date: draft.date!,
        startTime: draft.startTime!,
        endTime: draft.endTime || "",
        performer: draft.performer!,
        type: (draft.type as EventType) || "Live music",
        notes: draft.notes,
      },
    ]);
    setDraft({ type: "Live music" });
    toast.success("Event added");
  };

  const sortedEvents = [...events].sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));

  return (
    <>
      <PageHeader
        title="Knowledge Base"
        description="What the AI host knows about your restaurant"
      />
      <PageBody className="space-y-4">
        <Card className="p-0 overflow-hidden">
          <Accordion type="multiple" defaultValue={["hours"]}>
            {knowledgeSections.map(s => (
              <AccordionItem key={s.id} value={s.id} className="border-b border-border last:border-0 px-5">
                <AccordionTrigger className="py-4 hover:no-underline">
                  <div className="flex flex-1 items-center justify-between gap-3 pr-3">
                    <div className="text-left">
                      <div className="text-sm font-semibold">{s.title}</div>
                      <div className="text-xs text-muted-foreground line-clamp-1">{s.body}</div>
                    </div>
                    <Badge variant="secondary" className="text-[10px] tabular-nums shrink-0">Used {s.uses}× / wk</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-5">
                  <Textarea defaultValue={s.body} rows={3} />
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Last updated 2 days ago</span>
                    <Button size="sm" variant="outline" onClick={() => toast.success("Saved")}>Save</Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold flex items-center gap-2"><BookOpen className="h-4 w-4 text-primary" />Custom FAQs</div>
              <p className="text-xs text-muted-foreground">Question and answer pairs the AI host can reference verbatim.</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setItems([...items, { q: "", a: "" }])}><Plus className="mr-1.5 h-3.5 w-3.5" />Add FAQ</Button>
          </div>
          <div className="space-y-2">
            {items.length === 0 && (
              <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                No FAQs yet — add the questions you hear most often.
              </div>
            )}
            {items.map((f, i) => (
              <div key={i} className="rounded-md border border-border p-3 space-y-2">
                <Input defaultValue={f.q} placeholder="Question" />
                <Textarea defaultValue={f.a} rows={2} placeholder="Answer" />
                <div className="flex justify-end">
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setItems(items.filter((_, j) => j !== i))}>
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />Remove
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
              <div className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Globe className="h-3.5 w-3.5" />Live calendar URL
              </div>
              <div className="space-y-2">
                {musicSources.length === 0 && (
                  <div className="rounded-md border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
                    No URLs yet — add a "what's on" page and we'll keep events fresh automatically.
                  </div>
                )}
                {musicSources.map((s) => (
                  <div key={s.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2.5">
                    <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <a href={s.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-sm hover:underline">{s.url}</a>
                    <Badge variant="outline" className={
                      s.status === "synced" ? "border-primary/30 bg-primary/10 text-primary"
                      : s.status === "error" ? "border-destructive/30 bg-destructive/10 text-destructive"
                      : "bg-muted text-muted-foreground"
                    }>{s.status}</Badge>
                    <span className="text-xs text-muted-foreground tabular-nums">{s.frequency} · {s.lastSyncedAt}</span>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => toast.success("Sync queued")}>
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setMusicSources(musicSources.filter(x => x.id !== s.id))}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Input
                  value={newMusicUrl}
                  onChange={(e) => setNewMusicUrl(e.target.value)}
                  placeholder="https://your-restaurant.com/events"
                  className="h-9 flex-1 min-w-[180px]"
                />
                <Select value={newMusicFreq} onValueChange={(v) => setNewMusicFreq(v as SyncFrequency)}>
                  <SelectTrigger className="h-9 w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={addSource}><Plus className="mr-1.5 h-3.5 w-3.5" />Add</Button>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" />Scheduled events
              </div>
              <div className="space-y-2">
                {sortedEvents.length === 0 && (
                  <div className="rounded-md border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
                    No events scheduled — add tonight's act so the AI host can answer "who's playing tonight?".
                  </div>
                )}
                {sortedEvents.map((e) => (
                  <div key={e.id} className="flex flex-wrap items-center gap-3 rounded-md border border-border p-3">
                    <div className="text-xs tabular-nums text-muted-foreground w-28 shrink-0">
                      <div className="font-medium text-foreground">{new Date(e.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</div>
                      <div>{e.startTime}{e.endTime ? `–${e.endTime}` : ""}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{e.performer}</div>
                      {e.notes && <div className="text-xs text-muted-foreground truncate">{e.notes}</div>}
                    </div>
                    <Badge variant="secondary" className="text-[10px]">{e.type}</Badge>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setEvents(events.filter(x => x.id !== e.id))}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="mt-3 rounded-md border border-dashed border-border p-3">
                <div className="grid gap-2 sm:grid-cols-12">
                  <div className="sm:col-span-3 space-y-1">
                    <Label className="text-xs">Date</Label>
                    <Input type="date" value={draft.date || ""} onChange={(e) => setDraft({ ...draft, date: e.target.value })} className="h-9" />
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <Label className="text-xs">Start</Label>
                    <Input type="time" value={draft.startTime || ""} onChange={(e) => setDraft({ ...draft, startTime: e.target.value })} className="h-9" />
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <Label className="text-xs">End</Label>
                    <Input type="time" value={draft.endTime || ""} onChange={(e) => setDraft({ ...draft, endTime: e.target.value })} className="h-9" />
                  </div>
                  <div className="sm:col-span-3 space-y-1">
                    <Label className="text-xs">Performer / act</Label>
                    <Input value={draft.performer || ""} onChange={(e) => setDraft({ ...draft, performer: e.target.value })} placeholder="e.g. Jazz Quartet" className="h-9" />
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <Label className="text-xs">Type</Label>
                    <Select value={(draft.type as string) || "Live music"} onValueChange={(v) => setDraft({ ...draft, type: v as EventType })}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {EVENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-12 space-y-1">
                    <Label className="text-xs">Notes (optional)</Label>
                    <Input value={draft.notes || ""} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder="Cover charge, age restriction…" className="h-9" />
                  </div>
                </div>
                <div className="mt-3 flex justify-end">
                  <Button size="sm" onClick={addEvent}><Plus className="mr-1.5 h-3.5 w-3.5" />Add event</Button>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </PageBody>
    </>
  );
}
