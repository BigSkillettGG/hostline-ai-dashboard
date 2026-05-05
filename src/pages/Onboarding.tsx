import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Bot,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ClipboardCheck,
  FileText,
  PhoneForwarded,
  Rocket,
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
  onboardingSections,
  productionWorkstreams,
  type OnboardingDraft,
  type OnboardingField,
  type OnboardingStepId,
} from "@/domain/onboarding";
import { loadOnboardingDraft, saveOnboardingDraft } from "@/lib/onboarding-draft";
import { cn } from "@/lib/utils";

const sectionIcons: Record<OnboardingStepId, LucideIcon> = {
  basics: Store,
  hours: Clock3,
  launch: PhoneForwarded,
  menus: UtensilsCrossed,
  orders: ShoppingBag,
  policies: ShieldCheck,
  reservations: CalendarDays,
  voice: Bot,
};

const launchChecklist = [
  "Call the assigned HostLine number directly.",
  "Ask hours, parking, menu, and allergy questions.",
  "Place a pay-at-pickup order and confirm it appears in Orders.",
  "Forward unanswered calls from the restaurant main line.",
  "Call the restaurant main line from a mobile phone.",
  "Review the call transcript, order, and staff alert behavior.",
];

export default function Onboarding() {
  const [activeSectionId, setActiveSectionId] = useState<OnboardingStepId>("basics");
  const [draft, setDraft] = useState<OnboardingDraft>(() => loadOnboardingDraft());
  const progress = useMemo(() => calculateOnboardingProgress(draft), [draft]);
  const activeSection = onboardingSections.find((section) => section.id === activeSectionId) ?? onboardingSections[0];
  const ActiveIcon = sectionIcons[activeSection.id];
  const assignedNumber = String(draft.assignedHostLineNumber || assignedDemoPhoneNumber);

  const updateField = (fieldId: string, value: string | boolean) => {
    setDraft((current) => ({ ...current, [fieldId]: value }));
  };

  const saveDraft = () => {
    saveOnboardingDraft(draft);
    toast.success("Onboarding draft saved");
  };

  return (
    <>
      <PageHeader
        title="Restaurant Onboarding"
        description="Guided setup for a launch-ready phone host"
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link to="/app/voice-agent">
                Voice Agent
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
            <Button size="sm" onClick={saveDraft}>
              <ClipboardCheck className="mr-1.5 h-3.5 w-3.5" />
              Save draft
            </Button>
          </>
        }
      />

      <PageBody className="space-y-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
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
                  <div className="text-xs font-medium text-muted-foreground">Production scope</div>
                  <div className="mt-2 text-3xl font-semibold tabular-nums">{productionWorkstreams.length}</div>
                  <div className="mt-1 text-xs text-muted-foreground">remaining workstreams tracked</div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="text-xs font-medium text-muted-foreground">HostLine number</div>
                  <div className="mt-2 truncate text-xl font-semibold tabular-nums">{assignedNumber}</div>
                  <div className="mt-1 text-xs text-muted-foreground">Twilio provisioning target</div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
              <Card className="h-fit p-2">
                <div className="px-2 py-1.5 text-xs font-semibold uppercase text-muted-foreground">Interview</div>
                <div className="space-y-1">
                  {onboardingSections.map((section) => {
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
                    <Button size="sm" variant="outline" onClick={saveDraft}>
                      Save
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
                  {onboardingSections.map((section) => (
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
                  <div className="text-xs font-medium text-muted-foreground">Assigned HostLine number</div>
                  <div className="mt-1 text-2xl font-semibold tabular-nums">{assignedNumber}</div>
                  <Badge variant="outline" className="mt-3 bg-warning/10 text-warning border-warning/30">
                    Ready for Twilio provisioning
                  </Badge>
                </div>

                <div className="space-y-2">
                  <Label>Main line</Label>
                  <Input
                    value={String(draft.mainPhone ?? "")}
                    onChange={(event) => updateField("mainPhone", event.target.value)}
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
    const section = onboardingSections.find((item) => item.id === sectionId);
    const requiredFields = section?.fields.filter((field) => field.required) ?? [];
    const completed = requiredFields.filter((field) => hasDraftValue(currentDraft[field.id])).length;

    return {
      complete: requiredFields.length > 0 && completed === requiredFields.length,
      completed,
      total: requiredFields.length,
    };
  }
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
              <SelectItem key={option} value={option}>
                {option}
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

function hasDraftValue(value: string | boolean | undefined) {
  if (typeof value === "boolean") return true;
  return typeof value === "string" && value.trim().length > 0;
}
