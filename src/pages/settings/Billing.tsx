import { useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, CreditCard, Info, PhoneForwarded, ReceiptText, RefreshCw, TimerReset, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, PageBody } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { calls as demoCalls } from "@/data/mock";
import { buildBillingCheckoutNotice, buildBillingSnapshot, normalizeCheckoutReturn, type BillingLifecycleStatus, type BillingNoticeTone } from "@/domain/billing";
import { loadOnboardingDraft } from "@/lib/onboarding-draft";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  fetchCallsFromSupabase,
  fetchOnboardingProfileFromSupabase,
  fetchPhoneNumbersFromSupabase,
  getActiveSupabaseLocationId,
  isSupabaseConfigured,
} from "@/lib/supabase-rest";
import {
  createBillingCheckoutSession,
  createBillingPortalSession,
  fetchBillingStatus,
  isVoiceServiceConfigured,
} from "@/lib/voice-service";
import { cn } from "@/lib/utils";

export default function Billing() {
  const [searchParams, setSearchParams] = useSearchParams();
  const checkoutReturn = normalizeCheckoutReturn(searchParams.get("checkout"));
  const locationId = getActiveSupabaseLocationId();
  const supabaseConfigured = isSupabaseConfigured();
  const voiceServiceConfigured = isVoiceServiceConfigured();

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
  const billingQuery = useQuery({
    enabled: voiceServiceConfigured && Boolean(locationId),
    queryFn: () => fetchBillingStatus(locationId),
    queryKey: ["billing-status", locationId],
  });

  const localDraft = useMemo(() => loadOnboardingDraft(), []);
  const draft = onboardingQuery.data ?? localDraft;
  const callsThisMonth = useMemo(() => {
    const calls = callsQuery.data ?? demoCalls;
    const monthKey = new Date().toISOString().slice(0, 7);
    return calls.filter((call) => call.time.slice(0, 7) === monthKey).length;
  }, [callsQuery.data]);
  const snapshot = buildBillingSnapshot({
    billingAccount: billingQuery.data?.account,
    callsThisMonth,
    draft,
    phoneNumbers: phoneNumbersQuery.data,
  });
  const checkoutNotice = buildBillingCheckoutNotice({
    checkoutReturn,
    configured: billingQuery.data?.configured,
    fetching: billingQuery.isFetching,
    status: snapshot.billingStatus,
  });
  const primaryNumber = snapshot.primaryNumber;

  useEffect(() => {
    if (checkoutReturn === "success" && voiceServiceConfigured && locationId) {
      void billingQuery.refetch();
    }
  }, [billingQuery.refetch, checkoutReturn, locationId, voiceServiceConfigured]);

  const checkoutMutation = useMutation({
    mutationFn: () => createBillingCheckoutSession({
      businessType: snapshot.businessType,
      cancelUrl: `${window.location.origin}/app/billing?checkout=cancelled`,
      locationId,
      planId: snapshot.planId,
      planName: snapshot.planName,
      successUrl: `${window.location.origin}/app/billing?checkout=success`,
    }),
    onError: (error) => toast.error(error instanceof Error ? error.message : "Stripe checkout failed"),
    onSuccess: (session) => {
      window.location.href = session.url;
    },
  });
  const portalMutation = useMutation({
    mutationFn: () => createBillingPortalSession({
      locationId,
      returnUrl: `${window.location.origin}/app/billing`,
    }),
    onError: (error) => toast.error(error instanceof Error ? error.message : "Stripe portal failed"),
    onSuccess: (session) => {
      window.location.href = session.url;
    },
  });
  const billingActionBusy = checkoutMutation.isPending || portalMutation.isPending;
  const openCheckout = () => {
    if (!voiceServiceConfigured) {
      toast.error("Set VITE_VOICE_SERVICE_URL before starting Stripe checkout.");
      return;
    }
    checkoutMutation.mutate();
  };
  const openBillingPortal = () => {
    if (snapshot.billingAccount?.stripeCustomerId) {
      portalMutation.mutate();
      return;
    }
    openCheckout();
  };

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
              variant="outline"
              disabled={!voiceServiceConfigured || billingQuery.isFetching}
              onClick={() => void billingQuery.refetch()}
            >
              <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", billingQuery.isFetching && "animate-spin")} />
              Refresh status
            </Button>
            <Button
              size="sm"
              disabled={billingActionBusy}
              onClick={openBillingPortal}
            >
              <CreditCard className="mr-1.5 h-3.5 w-3.5" />
              {snapshot.billingAccount?.stripeCustomerId ? "Manage billing" : "Add payment method"}
            </Button>
          </>
        }
      />
      <PageBody className="space-y-5">
        {checkoutNotice ? (
          <BillingReturnNotice
            notice={checkoutNotice}
            onDismiss={() => {
              const next = new URLSearchParams(searchParams);
              next.delete("checkout");
              setSearchParams(next, { replace: true });
            }}
            onRefresh={() => void billingQuery.refetch()}
            refreshing={billingQuery.isFetching}
          />
        ) : null}

        {billingQuery.isError ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Billing status could not be checked.</AlertTitle>
            <AlertDescription>
              {billingQuery.error instanceof Error ? billingQuery.error.message : "Open the voice service logs, then refresh billing status."}
            </AlertDescription>
          </Alert>
        ) : null}

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
                <h2 className="mt-3 text-xl font-semibold">{heroTitle(snapshot)}</h2>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{snapshot.lifecycleDetail}</p>
                {billingQuery.data && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Billing status: <span className="font-medium text-foreground">{billingStatusLabel(snapshot.billingStatus)}</span>
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline">
                  <Link to="/app/onboarding">Open launch setup</Link>
                </Button>
                <Button disabled={billingActionBusy} onClick={openCheckout}>
                  {billingActionBusy ? "Opening..." : snapshot.billingStatus === "active" ? "Change plan" : "Upgrade now"}
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
                    text={paymentMethodText(snapshot)}
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
                  Stripe invoices and payment method controls open in the customer portal after checkout is completed.
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </PageBody>
    </>
  );
}

function heroTitle(snapshot: ReturnType<typeof buildBillingSnapshot>) {
  if (snapshot.billingStatus === "active" || snapshot.billingStatus === "trialing") {
    return "Billing is active for this location.";
  }
  if (snapshot.billingStatus === "past_due") return "Payment needs attention.";
  if (snapshot.upgradeRequired) return "Upgrade before this number is cleaned up.";
  return "Your trial number is protected while the account is active.";
}

function PlanFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/20 p-3">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

function BillingReturnNotice({
  notice,
  onDismiss,
  onRefresh,
  refreshing,
}: {
  notice: {
    detail: string;
    title: string;
    tone: BillingNoticeTone;
  };
  onDismiss: () => void;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const Icon = notice.tone === "success" ? CheckCircle2 : notice.tone === "danger" || notice.tone === "warning" ? AlertCircle : Info;

  return (
    <Alert className={billingNoticeClass(notice.tone)} variant={notice.tone === "danger" ? "destructive" : "default"}>
      <Icon className="h-4 w-4" />
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <AlertTitle>{notice.title}</AlertTitle>
          <AlertDescription>{notice.detail}</AlertDescription>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={onRefresh} disabled={refreshing}>
            <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", refreshing && "animate-spin")} />
            Refresh
          </Button>
          <Button size="sm" variant="ghost" onClick={onDismiss}>
            Dismiss
          </Button>
        </div>
      </div>
    </Alert>
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

function billingNoticeClass(tone: BillingNoticeTone) {
  if (tone === "success") return "border-success/30 bg-success/5 [&>svg]:text-success";
  if (tone === "warning") return "border-warning/30 bg-warning/10 [&>svg]:text-warning";
  if (tone === "info") return "border-primary/20 bg-primary/5 [&>svg]:text-primary";
  return "";
}

function cleanupText(snapshot: ReturnType<typeof buildBillingSnapshot>) {
  if (snapshot.lifecycleStatus === "release_due") return "Cleanup is due now";
  if (snapshot.lifecycleStatus === "grace_period") return `${snapshot.trialGraceDaysRemaining ?? 0} grace days left`;
  if (snapshot.lifecycleStatus === "trialing") return `${snapshot.trialDaysRemaining ?? 0} trial days left`;
  if (snapshot.lifecycleStatus === "not_started") return "Assign a number in onboarding";
  return "No cleanup scheduled";
}

function billingStatusLabel(status: ReturnType<typeof buildBillingSnapshot>["billingStatus"]) {
  if (status === "active") return "Active";
  if (status === "trialing") return "Stripe trialing";
  if (status === "checkout_started") return "Checkout started";
  if (status === "past_due") return "Past due";
  if (status === "unpaid") return "Unpaid or canceled";
  return "Not connected";
}

function paymentMethodText(snapshot: ReturnType<typeof buildBillingSnapshot>) {
  if (snapshot.billingStatus === "active" || snapshot.billingStatus === "trialing") return "Stripe active";
  if (snapshot.billingStatus === "past_due") return "Payment failed";
  if (snapshot.billingStatus === "checkout_started") return "Checkout started";
  return "Stripe checkout pending";
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
