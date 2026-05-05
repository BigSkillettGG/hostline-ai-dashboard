import { useState } from "react";
import { PageHeader, PageBody } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { menuCategories } from "@/data/mock";
import { Upload, Plus, Clock, Sparkles, FileUp, Link2, RefreshCw, Trash2, Globe } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { MenuSource, SyncFrequency } from "@/types/sources";

export default function MenuPage() {
  const [activeCat, setActiveCat] = useState(menuCategories[0].id);
  const [editing, setEditing] = useState<any>(null);
  const cat = menuCategories.find(c => c.id === activeCat)!;

  // TODO: replace local state with Lovable Cloud + Firecrawl-backed sync job
  const [sources, setSources] = useState<MenuSource[]>([
    { id: "1", url: "https://oliveandember.com/menu", frequency: "daily", lastSyncedAt: "2h ago", status: "synced" },
  ]);
  const [newUrl, setNewUrl] = useState("");
  const [newFreq, setNewFreq] = useState<SyncFrequency>("daily");

  const addSource = () => {
    try {
      const u = new URL(newUrl.trim());
      if (!/^https?:$/.test(u.protocol)) throw new Error();
      setSources([...sources, { id: crypto.randomUUID(), url: u.toString(), frequency: newFreq, lastSyncedAt: "—", status: "pending" }]);
      setNewUrl("");
      toast.success("Source added — first sync queued");
    } catch {
      toast.error("Enter a valid http(s) URL");
    }
  };

  return (
    <>
      <PageHeader
        title="Menu"
        description="Manage what your AI host can offer to callers"
        actions={
          <>
            <Button variant="outline" size="sm"><Upload className="mr-1.5 h-3.5 w-3.5" />Import</Button>
            <Button size="sm" onClick={() => setEditing({ name: "" })}><Plus className="mr-1.5 h-3.5 w-3.5" />Add item</Button>
          </>
        }
      />
      <PageBody className="space-y-5">
        <Card className="border-dashed bg-muted/20 p-5">
          <div className="flex flex-col items-center justify-center gap-2 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <FileUp className="h-5 w-5" />
            </div>
            <div className="text-sm font-medium">Upload menu PDF, image, or CSV</div>
            <div className="text-xs text-muted-foreground">Drop your file here or click to browse · we'll extract items automatically</div>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => toast("Upload coming soon")}>Choose file</Button>
          </div>
        </Card>

        <div className="grid gap-4 lg:grid-cols-[200px_1fr]">
          <Card className="p-2 h-fit">
            <div className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Categories</div>
            {menuCategories.map(c => (
              <button
                key={c.id}
                onClick={() => setActiveCat(c.id)}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-2.5 py-2 text-sm transition-colors",
                  activeCat === c.id ? "bg-accent font-medium" : "hover:bg-muted"
                )}
              >
                <span>{c.name}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{c.items.length}</span>
              </button>
            ))}
            <Button variant="ghost" size="sm" className="mt-1 w-full justify-start text-muted-foreground">
              <Plus className="mr-1.5 h-3.5 w-3.5" />New category
            </Button>
          </Card>

          <div className="space-y-2">
            {cat.items.map(item => (
              <Card key={item.id} className="p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <button onClick={() => setEditing(item)} className="text-sm font-semibold hover:underline">{item.name}</button>
                      {!item.available && <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">86'd</Badge>}
                      {item.upsell?.length ? <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20"><Sparkles className="mr-0.5 h-2.5 w-2.5" />Upsell</Badge> : null}
                    </div>
                    {item.description && <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>}
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{item.prepMinutes}m prep</span>
                      {item.modifiers?.length ? <span>{item.modifiers.length} modifier{item.modifiers.length !== 1 ? "s" : ""}</span> : null}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="text-base font-semibold tabular-nums">${item.price}</div>
                    <Switch defaultChecked={item.available} />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </PageBody>

      <Sheet open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editing?.id ? "Edit item" : "Add item"}</SheetTitle>
          </SheetHeader>
          <div className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input defaultValue={editing?.name || ""} placeholder="Margherita Pizza" />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea defaultValue={editing?.description || ""} rows={2} placeholder="A short description for the AI host…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Price ($)</Label>
                <Input type="number" defaultValue={editing?.price ?? ""} />
              </div>
              <div className="space-y-1.5">
                <Label>Prep time (min)</Label>
                <Input type="number" defaultValue={editing?.prepMinutes ?? ""} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Modifiers</Label>
              <Textarea rows={2} defaultValue={editing?.modifiers?.join("\n") || ""} placeholder="One per line, e.g. Light cheese" />
            </div>
            <div className="space-y-1.5">
              <Label>Upsell suggestions</Label>
              <Textarea rows={2} defaultValue={editing?.upsell?.join("\n") || ""} placeholder="One per line, e.g. Add truffle oil +$3" />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <div className="text-sm font-medium">Available</div>
                <div className="text-xs text-muted-foreground">If off, AI host will mark as 86'd</div>
              </div>
              <Switch defaultChecked={editing?.available ?? true} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={() => { setEditing(null); toast.success("Item saved"); }}>Save</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
