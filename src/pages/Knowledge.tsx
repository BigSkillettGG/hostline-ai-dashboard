import { PageHeader, PageBody } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { knowledgeSections, faqs } from "@/data/mock";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Plus, Trash2, BookOpen } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function Knowledge() {
  const [items, setItems] = useState(faqs);

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
