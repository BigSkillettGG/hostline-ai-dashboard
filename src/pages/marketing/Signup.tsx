import { FormEvent, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Check, ClipboardList, Flame, Phone, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signUp } from "@/lib/auth";
import { saveOnboardingDraft } from "@/lib/onboarding-draft";
import { sampleOnboardingDraft } from "@/domain/onboarding";
import { industrySolutions } from "@/data/industry-solutions";
import { getBusinessTemplate, type BusinessType } from "@/domain/business-templates";
import { toast } from "sonner";

export default function Signup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedIndustry = searchParams.get("industry");
  const requestedPlan = searchParams.get("plan");
  const initialSolution = useMemo(
    () => industrySolutions.find((solution) => solution.slug === requestedIndustry) ?? industrySolutions[0],
    [requestedIndustry],
  );
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState<BusinessType>(initialSolution.businessType);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const selectedSolution = industrySolutions.find((solution) => solution.businessType === businessType) ?? industrySolutions[0];
  const selectedTier = selectedSolution.pricing.find((tier) => tier.id === requestedPlan) ?? selectedSolution.pricing[1];
  const template = getBusinessTemplate(businessType);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!email || !password) {
      toast.error("Enter email and password");
      return;
    }

    setIsSubmitting(true);
    try {
      saveOnboardingDraft({
        ...sampleOnboardingDraft,
        businessType,
        concept: template.defaultOffering,
        restaurantName: businessName || template.defaultName,
      });
      await signUp({ email, name, password, restaurant: businessName });
      toast.success("Account created - let's get you set up");
      navigate("/app/onboarding", { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Account creation failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100svh-4rem)] border-b border-border bg-card/35">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-start lg:py-16">
        <div className="lg:sticky lg:top-24">
          <Link to="/" className="mb-8 inline-flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Flame className="h-4 w-4" />
            </span>
            <span className="text-lg font-semibold">SignalHost</span>
          </Link>

          <div className="rounded-lg border border-border bg-foreground p-6 text-background">
            <div className="inline-flex items-center gap-2 rounded-md border border-background/15 bg-background/8 px-3 py-1.5 text-xs font-semibold uppercase text-primary-glow">
              <Sparkles className="h-3.5 w-3.5" />
              Guided setup
            </div>
            <h1 className="mt-5 text-4xl font-semibold leading-none md:text-5xl">
              Start with the right operating manual.
            </h1>
            <p className="mt-4 text-sm leading-6 text-background/70">
              Choose the solution now. The next screen interviews you in plain English and turns the answers into the AI's call and chat behavior.
            </p>

            <div className="mt-6 rounded-md border border-background/15 bg-background/8 p-4">
              <div className="text-xs font-semibold uppercase text-background/48">Selected plan</div>
              <div className="mt-2 flex items-end justify-between gap-4">
                <div>
                  <div className="text-lg font-semibold">{selectedTier.name}</div>
                  <div className="text-xs text-background/55">{selectedTier.includedInteractions.toLocaleString()} calls or chats included</div>
                </div>
                <div className="text-2xl font-semibold">${selectedTier.monthly}/mo</div>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {selectedSolution.setupFocus.slice(0, 3).map((item) => (
                <div key={item} className="flex gap-3">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary-glow" />
                  <p className="text-sm leading-6 text-background/72">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <Card className="w-full border-border/80">
          <CardHeader>
            <CardTitle>Create your account</CardTitle>
            <CardDescription>
              No credit card required. You will land directly in the onboarding interview.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="industry">Solution</Label>
                <select
                  id="industry"
                  className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={businessType}
                  onChange={(event) => setBusinessType(event.target.value as BusinessType)}
                >
                  {industrySolutions.map((solution) => (
                    <option key={solution.businessType} value={solution.businessType}>
                      {solution.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">{selectedSolution.proofPoint}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Your name</Label>
                  <Input id="name" value={name} onChange={(event) => setName(event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="business">Business name</Label>
                  <Input
                    id="business"
                    value={businessName}
                    onChange={(event) => setBusinessName(event.target.value)}
                    placeholder={template.defaultName}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email">Work email</Label>
                <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@business.com" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border border-border bg-muted/30 p-4">
                  <Phone className="h-4 w-4 text-primary" />
                  <div className="mt-2 text-sm font-semibold">First call ready</div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">Forward a test number after onboarding and hear the AI answer with your business name.</p>
                </div>
                <div className="rounded-md border border-border bg-muted/30 p-4">
                  <ClipboardList className="h-4 w-4 text-primary" />
                  <div className="mt-2 text-sm font-semibold">Knowledge base built</div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">Your answers become policies, links, escalation rules, and staff handoff behavior.</p>
                </div>
              </div>

              <Button type="submit" className="h-11 w-full" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create account"}
                {!isSubmitting && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Already have one? <Link to="/login" className="text-foreground underline-offset-4 hover:underline">Sign in</Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
