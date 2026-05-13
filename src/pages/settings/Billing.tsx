import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CreditCard, PhoneForwarded, ReceiptText, TimerReset, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, PageBody } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { calls as demoCalls } from "@/data/mock";
import { buildBillingSnapshot, type BillingLifecycleStatus } from "@/domain/billing";
import { loadOnboardingDraft } from "@/lib/onboarding-draft";
import {
  fetchCallsFromSupabase,
  fetchOnboardingProfileFromSupabase,
  fetchPhoneNumbersFromSupabase,
  getActiveSupabaseLocationId,
  isSupabaseConfigured,
} from "@/lib/supabase-rest";
import { cn } from "@/lib/utils";

export default function Billing() {
  const locationId = getActiveSupabaseLocationId();
  const supabaseConfigured = isSupabaseConfigured();

  const onboardingQuery = useQuery({
    enabled: supabaseConfigured && Boolean(locationId),
    queryFn: () => fetchOnboardingProfileFromSupabase(locationId),
    queryKey: ["billing-onboarding", locationId],
  });
  const phoneNumbersQuery = useQuery({
    enabled: supabaseConfigured && Boolean(locationId),
    queryFn: () => fetchPhoneNumbersFromSupabase(locationId),
    queryKey: ["billing-phone-numbers", locationId],
  });
  const callsQuery = useQuery({
    enabled: supabaseConfigured && Boolean(locationId),
    queryFn: () => fetchCallsFromSupabase(locationId),
    queryKey: ["billing-calls", locationId],
  });

  const localDraft = useMemo(() => loadOnboardingDraft(), []);
  const draft = onboardingQuery.data ?? localDraft;
  const callsThisMonth = useMemo(() => {
    const calls = callsQuery.data ?? demoCalls;
    const monthKey = new Date().toISOString().slice(0, 7);
    return calls.filter((call) => call.time.slice(0, 7) === monthKey).length;
  }, [callsQuery.data]);
  const snapshot = buildBillingSnapshot({
    callsThisMonth,
    draft,
    phoneNumbers: phoneNumbersQuery.data,
  });
  const primaryNumber = snapshot.primaryNumber;

  return (
    <>
      <PageHeader
        title="Billing"
        description="Plan, trial status, usage, and number ownership"
        actions={
          <>
            <Button asChild size="sm" variant="outline">
              <Link to="/pricing">Compare plans</Link>
            </Button>
            <Button
              size="sm"
              onClick={() => toast.info("Stripe checkout is the next billing slice. This button is wired as the payment-method placeholder.")}
            >
              <CreditCard className="mr-1.5 h-3.5 w-3.5" />
              Add payment method
            </Button>
          </>
        }
      />
      <PageBody className="space-y-5">
        <Card className={cn("border-border", snapshot.upgradeRequired && "border-warning/40 bg-warning/5")}>
          <CardContent className="p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={lifecycleBadgeClass(snapshot.lifecycleStatus)}>
                    {snapshot.lifecycleLabel}
                  </Badge>
                  {primaryNumber?.phoneNumber && <span className="font-mono text-sm text-muted-foreground">{primaryNumber.phoneNumber}</span>}
                </div>
                <h2 className="mt-3 text-xl font-semibold">
                  {snapshot.upgradeRequired ? "Upgrade before this number is cleaned up." : "Your trial number is protected while the account is active."}
                </h2>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{snapshot.lifecycleDetail}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline">
                  <Link to="/app/onboarding">Open launch setup</Link>
                </Button>
                <Button onClick={() => toast.info("Stripe checkout will connect here next.")}>
                  Upgrade now
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-5">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ReceiptText className="h-4 w-4 text-primary" />
                  Current plan
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 md:grid-cols-3">
                  <PlanFact label="Plan" value={snapshot.planName} />
                  <PlanFact label="Monthly" value={snapshot.monthlyPrice ? `$${snapshot.monthlyPrice}/mo` : "Not selected"} />
                  <PlanFact label="Overage" value={snapshot.overageLabel} />
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span>Calls and chats this month</span>
                    <span className="tabular-nums text-muted-foreground">
                      {snapshot.usedInteractions.toLocaleString()} / {snapshot.includedInteractions.toLocaleString()}
                    </span>
                  </div>
                  <Progress value={snapshot.usagePercent} />
                  <div className="mt-2 text-xs text-muted-foreground">
                    Overage starts after {snapshot.includedInteractions.toLocaleString()} calls or chats.
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <GuardrailCard
                    icon={PhoneForwarded}
                    label="Trial number"
                    ready={Boolean(primaryNumber && !primaryNumber.releasedAt)}
                    text={primaryNumber?.phoneNumber ?? "No number assigned yet"}
                  />
                  <GuardrailCard
                    icon={TimerReset}
                    label="Cleanup grace"
                    ready={!snapshot.upgradeRequired}
                    text={cleanupText(snapshot)}
                  />
                  <GuardrailCard
                    icon={CreditCard}
                    label="Payment method"
                    ready={snapshot.lifecycleStatus === "active"}
                    text={snapshot.lifecycleStatus === "active" ? "Active" : "Stripe checkout pending"}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-5">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Trial timeline</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <TimelineRow label="Trial started" value={formatDate(primaryNumber?.trialStartedAt)} />
                <TimelineRow label="Trial ends" value={formatDate(primaryNumber?.trialEndsAt)} />
                <TimelineRow label="Number cleanup" value={formatDate(primaryNumber?.trialGraceEndsAt)} />
                {snapshot.upgradeRequired && (
                  <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-xs leading-5 text-warning">
                    Add billing before cleanup to keep the number attached to this location.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Invoices</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                  Stripe invoices will appear here after checkout is connected.
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </PageBody>
    </>
  );
}

function PlanFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/20 p-3">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

function GuardrailCard({
  icon: Icon,
  label,
  ready,
  text,
}: {
  icon: LucideIcon;
  label: string;
  ready: boolean;
  text: string;
}) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex items-start gap-2">
        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", ready ? "text-success" : "text-warning")} />
        <div className="min-w-0">
          <div className="text-sm font-medium">{label}</div>
          <div className="mt-1 text-xs leading-5 text-muted-foreground">{text}</div>
        </div>
      </div>
    </div>
  );
}

function TimelineRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function lifecycleBadgeClass(status: BillingLifecycleStatus) {
  if (status === "trialing" || status === "active") return "border-success/30 bg-success/10 text-success";
  if (status === "grace_period") return "border-warning/30 bg-warning/10 text-warning";
  if (status === "release_due") return "border-destructive/30 bg-destructive/10 text-destructive";
  return "bg-muted text-muted-foreground";
}

function cleanupText(snapshot: ReturnType<typeof buildBillingSnapshot>) {
  if (snapshot.lifecycleStatus === "release_due") return "Cleanup is due now";
  if (snapshot.lifecycleStatus === "grace_period") return `${snapshot.trialGraceDaysRemaining ?? 0} grace days left`;
  if (snapshot.lifecycleStatus === "trialing") return `${snapshot.trialDaysRemaining ?? 0} trial days left`;
  if (snapshot.lifecycleStatus === "not_started") return "Assign a number in onboarding";
  return "No cleanup scheduled";
}

function formatDate(value?: string) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Invalid date";
  return date.toLocaleDateString([], {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
