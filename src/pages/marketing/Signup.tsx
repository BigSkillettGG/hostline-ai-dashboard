import { FormEvent, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Flame } from "lucide-react";
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
    <div className="mx-auto flex max-w-2xl flex-col items-center px-5 py-16">
      <Link to="/" className="mb-6 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Flame className="h-4 w-4" />
        </span>
        <span className="text-lg font-semibold">HostLine AI</span>
      </Link>
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Start your free trial</CardTitle>
          <CardDescription>
            Choose a solution, create the account, then the onboarding interview builds the AI knowledge base.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="industry">Solution</Label>
              <select
                id="industry"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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

            {requestedPlan && (
              <div className="rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                Selected plan: <span className="font-medium text-foreground">{requestedPlan}</span>. You can change this before billing.
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create account"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Already have one? <Link to="/login" className="text-foreground underline-offset-4 hover:underline">Sign in</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
