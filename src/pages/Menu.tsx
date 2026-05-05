import { useEffect, useMemo, useState } from "react";
import { PageHeader, PageBody } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { menuCategories, type MenuItem } from "@/data/mock";
import {
  Clock,
  Database,
  FileUp,
  Globe,
  Link2,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { ParsedMenuCategory } from "@/domain/menu-ingestion";
import { parseMenuText } from "@/domain/menu-ingestion";
import {
  fetchMenuFromSupabase,
  importParsedMenuToSupabase,
  isMenuPersistenceConfigured,
  type MenuCategoryRecord,
} from "@/lib/supabase-rest";
import type { MenuSource, SyncFrequency } from "@/types/sources";

type MenuMode = "loading" | "live" | "sample" | "local-preview";

const sampleMenuText = `Starters
Burrata - Stracciatella, heirloom tomato, basil, olive oil $16
Caesar Salad - Little gem, parmesan, focaccia croutons $14
Add chicken +$6

Wood-fired Pizza
Margherita - Tomato, fior di latte, basil $18
Diavola - Spicy salami, chili, mozzarella $21
Gluten-free crust +$4

Dessert
Tiramisu - Classic, made in-house $11`;

export default function MenuPage() {
  const [categories, setCategories] = useState<MenuCategoryRecord[]>(menuCategories);
  const [menuMode, setMenuMode] = useState<MenuMode>("loading");
  const [activeCat, setActiveCat] = useState(menuCategories[0]?.id ?? "");
  const [editing, setEditing] = useState<Partial<MenuItem> | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importPreview, setImportPreview] = useState<ParsedMenuCategory[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [sources, setSources] = useState<MenuSource[]>([
    { id: "1", url: "https://oliveandember.com/menu", frequency: "daily", lastSyncedAt: "2h ago", status: "synced" },
  ]);
  const [newUrl, setNewUrl] = useState("");
  const [newFreq, setNewFreq] = useState<SyncFrequency>("daily");

  useEffect(() => {
    let isMounted = true;

    async function loadMenu() {
      if (!isMenuPersistenceConfigured()) {
        setMenuMode("sample");
        return;
      }

      try {
        const liveMenu = await fetchMenuFromSupabase();
        if (!isMounted) return;

        if (liveMenu.length) {
          setCategories(liveMenu);
          setMenuMode("live");
        } else {
          setMenuMode("sample");
        }
        setLoadError(null);
      } catch (error) {
        if (!isMounted) return;
        setLoadError(error instanceof Error ? error.message : "Unable to load menu data.");
        setMenuMode("sample");
      }
    }

    void loadMenu();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (categories.length && !categories.some((category) => category.id === activeCat)) {
      setActiveCat(categories[0].id);
    }
  }, [activeCat, categories]);

  const activeCategory = useMemo(
    () => categories.find((category) => category.id === activeCat) ?? categories[0],
    [activeCat, categories],
  );
  const importItemCount = importPreview.reduce((sum, category) => sum + category.items.length, 0);
  const totalItemCount = categories.reduce((sum, category) => sum + category.items.length, 0);

  const addSource = () => {
    try {
      const url = new URL(newUrl.trim());
      if (!/^https?:$/.test(url.protocol)) throw new Error();

      setSources([
        ...sources,
        {
          frequency: newFreq,
          id: crypto.randomUUID(),
          lastSyncedAt: "pending",
          status: "pending",
          url: url.toString(),
        },
      ]);
      setNewUrl("");
      toast.success("Source added. Sync job is queued.");
    } catch {
      toast.error("Enter a valid http(s) URL.");
    }
  };

  const parseImportPreview = () => {
    const parsed = parseMenuText(importText);
    setImportPreview(parsed);

    const itemCount = parsed.reduce((sum, category) => sum + category.items.length, 0);
    if (!itemCount) {
      toast.error("I could not find menu items with prices.");
      return;
    }

    toast.success(`Found ${itemCount} menu item${itemCount === 1 ? "" : "s"}.`);
  };

  const importMenu = async () => {
    const parsed = importPreview.length ? importPreview : parseMenuText(importText);
    const itemCount = parsed.reduce((sum, category) => sum + category.items.length, 0);

    if (!itemCount) {
      setImportPreview(parsed);
      toast.error("Paste menu text with item names and prices first.");
      return;
    }

    setIsImporting(true);

    try {
      if (isMenuPersistenceConfigured()) {
        const liveMenu = await importParsedMenuToSupabase(parsed);
        setCategories(liveMenu);
        setMenuMode("live");
        toast.success("Menu imported to Supabase.");
      } else {
        setCategories(mapParsedMenuToRecords(parsed));
        setMenuMode("local-preview");
        toast.success("Menu preview loaded locally. Add Supabase keys to persist it.");
      }

      setImportOpen(false);
      setImportPreview([]);
      setImportText("");
      setLoadError(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Menu import failed.");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Menu"
        description="Manage what your AI host can offer to callers"
        actions={
          <>
            <Badge variant="outline" className="hidden gap-1.5 sm:inline-flex">
              <Database className="h-3.5 w-3.5" />
              {menuModeLabel(menuMode)}
            </Badge>
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              Import
            </Button>
            <Button size="sm" onClick={() => setEditing({ available: true, prepMinutes: 10 })}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add item
            </Button>
          </>
        }
      />
      <PageBody className="space-y-5">
        {loadError && (
          <Card className="border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            Supabase menu load failed, so the dashboard is showing sample data. {loadError}
          </Card>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border-dashed bg-muted/20 p-5">
            <div className="flex flex-col items-center justify-center gap-2 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <FileUp className="h-5 w-5" />
              </div>
              <div className="text-sm font-medium">Paste menu text now, upload extraction next</div>
              <div className="max-w-sm text-xs text-muted-foreground">
                The parser recognizes categories, item names, descriptions, prices, and common modifier lines.
              </div>
              <Button variant="outline" size="sm" className="mt-2" onClick={() => setImportOpen(true)}>
                Open importer
              </Button>
            </div>
          </Card>

          <Card className="p-5">
            <div className="mb-3 flex items-start gap-2">
              <Globe className="mt-0.5 h-4 w-4 text-primary" />
              <div>
                <div className="text-sm font-semibold">Menu URLs</div>
                <div className="text-xs text-muted-foreground">Scheduled link sync will use these sources when extraction jobs are enabled.</div>
              </div>
            </div>

            <div className="space-y-2">
              {sources.length === 0 && (
                <div className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  No URLs yet. Add a menu page so the AI host can stay current.
                </div>
              )}
              {sources.map((source) => (
                <div key={source.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2.5">
                  <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <a href={source.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-sm hover:underline">
                    {source.url}
                  </a>
                  <Badge variant="outline" className={sourceBadgeClass(source.status)}>
                    {source.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {source.frequency} / {source.lastSyncedAt}
                  </span>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => toast.success("Sync queued.")}>
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive"
                    onClick={() => setSources(sources.filter((item) => item.id !== source.id))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Input
                value={newUrl}
                onChange={(event) => setNewUrl(event.target.value)}
                placeholder="https://your-restaurant.com/menu"
                className="h-9 min-w-[180px] flex-1"
              />
              <Select value={newFreq} onValueChange={(value) => setNewFreq(value as SyncFrequency)}>
                <SelectTrigger className="h-9 w-28">
                  <SelectValue />
                </SelectTrigger>
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
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
          <Card className="h-fit p-2">
            <div className="flex items-center justify-between px-2 py-1.5">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Categories</div>
              <div className="text-xs text-muted-foreground tabular-nums">{totalItemCount}</div>
            </div>
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setActiveCat(category.id)}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-2.5 py-2 text-sm transition-colors",
                  activeCat === category.id ? "bg-accent font-medium" : "hover:bg-muted",
                )}
              >
                <span className="truncate">{category.name}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{category.items.length}</span>
              </button>
            ))}
            <Button variant="ghost" size="sm" className="mt-1 w-full justify-start text-muted-foreground">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              New category
            </Button>
          </Card>

          <div className="space-y-2">
            {activeCategory?.items.length ? (
              activeCategory.items.map((item) => (
                <Card key={item.id} className="p-4 transition-shadow hover:shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <button onClick={() => setEditing(item)} className="text-sm font-semibold hover:underline">
                          {item.name}
                        </button>
                        {!item.available && (
                          <Badge variant="outline" className="border-destructive/20 bg-destructive/10 text-destructive">
                            86'd
                          </Badge>
                        )}
                        {item.upsell?.length ? (
                          <Badge variant="outline" className="border-primary/20 bg-primary/10 text-[10px] text-primary">
                            <Sparkles className="mr-0.5 h-2.5 w-2.5" />
                            Upsell
                          </Badge>
                        ) : null}
                      </div>
                      {item.description && <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>}
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {item.prepMinutes}m prep
                        </span>
                        {item.modifiers?.length ? (
                          <span>
                            {item.modifiers.length} modifier{item.modifiers.length === 1 ? "" : "s"}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="text-base font-semibold tabular-nums">{formatPrice(item.price)}</div>
                      <Switch defaultChecked={item.available} />
                    </div>
                  </div>
                </Card>
              ))
            ) : (
              <Card className="border-dashed p-8 text-center text-sm text-muted-foreground">
                Import a menu or add an item to start building the AI host order catalog.
              </Card>
            )}
          </div>
        </div>
      </PageBody>

      <Sheet open={importOpen} onOpenChange={setImportOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Import menu</SheetTitle>
          </SheetHeader>
          <div className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label>Menu text</Label>
              <Textarea
                value={importText}
                onChange={(event) => {
                  setImportText(event.target.value);
                  setImportPreview([]);
                }}
                rows={12}
                placeholder="Paste categories and item lines with prices..."
              />
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setImportText(sampleMenuText);
                  setImportPreview([]);
                }}
              >
                Use sample
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={parseImportPreview}>
                  Parse preview
                </Button>
                <Button onClick={importMenu} disabled={isImporting}>
                  {isImporting ? "Importing..." : isMenuPersistenceConfigured() ? "Replace live menu" : "Load preview"}
                </Button>
              </div>
            </div>

            <div className="rounded-md border border-border p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="text-sm font-medium">Preview</div>
                <Badge variant="outline">{importItemCount} items</Badge>
              </div>
              {importPreview.length ? (
                <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
                  {importPreview.map((category) => (
                    <div key={category.name} className="space-y-1">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{category.name}</div>
                      {category.items.map((item) => (
                        <div key={`${category.name}-${item.name}`} className="rounded-md bg-muted/40 px-3 py-2">
                          <div className="flex items-start justify-between gap-3 text-sm">
                            <span className="font-medium">{item.name}</span>
                            <span className="tabular-nums">{formatPrice(item.priceCents / 100)}</span>
                          </div>
                          {item.description && <div className="mt-0.5 text-xs text-muted-foreground">{item.description}</div>}
                          {item.modifiers?.length ? (
                            <div className="mt-1 text-xs text-muted-foreground">Modifiers: {item.modifiers.join(", ")}</div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  Paste menu text and parse it before importing.
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
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
              <Textarea defaultValue={editing?.description || ""} rows={2} placeholder="A short description for the AI host" />
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
                <div className="text-xs text-muted-foreground">If off, AI host will mark it as unavailable</div>
              </div>
              <Switch defaultChecked={editing?.available ?? true} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setEditing(null);
                  toast.success("Item saved.");
                }}
              >
                Save
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function mapParsedMenuToRecords(categories: ParsedMenuCategory[]): MenuCategoryRecord[] {
  return categories.map((category, categoryIndex) => ({
    id: `parsed-${categoryIndex}-${slugify(category.name)}`,
    items: category.items.map((item, itemIndex) => ({
      available: item.available,
      description: item.description,
      id: `parsed-${categoryIndex}-${itemIndex}-${slugify(item.name)}`,
      modifiers: item.modifiers,
      name: item.name,
      prepMinutes: item.prepMinutes,
      price: item.priceCents / 100,
      upsell: item.upsellSuggestions,
    })),
    name: category.name,
  }));
}

function menuModeLabel(mode: MenuMode) {
  if (mode === "live") return "Live Supabase";
  if (mode === "local-preview") return "Local preview";
  if (mode === "loading") return "Loading menu";
  return "Sample menu";
}

function sourceBadgeClass(status: MenuSource["status"]) {
  if (status === "synced") return "border-primary/30 bg-primary/10 text-primary";
  if (status === "error") return "border-destructive/30 bg-destructive/10 text-destructive";
  return "bg-muted text-muted-foreground";
}

function formatPrice(price: number) {
  return `$${price.toFixed(2)}`;
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "item"
  );
}
