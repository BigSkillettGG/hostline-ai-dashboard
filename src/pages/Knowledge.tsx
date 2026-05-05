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
      </PageBody>
    </>
  );
}
