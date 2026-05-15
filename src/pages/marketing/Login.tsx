import { FormEvent, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isDemoAuthMode, signIn, startDemoSession } from "@/lib/auth";
import { getDemoBusinessLabel, getVerticalDemoProfile, verticalDemoProfiles } from "@/domain/demo-verticals";
import { toast } from "sonner";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const demoAuth = isDemoAuthMode();
  const params = new URLSearchParams(location.search);
  const demoParamEnabled = params.get("demo") === "1";
  const profileParam = params.get("profile") ?? undefined;
  const selectedDemoProfile = profileParam ? getVerticalDemoProfile(profileParam) : undefined;
  const localDemoEnabled = demoAuth || import.meta.env.DEV || demoParamEnabled;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Enter email and password");
      return;
    }
    setIsSubmitting(true);
    try {
      const user = await signIn(email, password);
      toast.success(`Welcome back, ${user.name}`);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from ?? (user.role === "superadmin" ? "/super" : "/app"), { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sign in failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openDemoWorkspace = (role: "admin" | "superadmin" = "admin", profileSlug?: string) => {
    const user = startDemoSession(role, profileSlug);
    toast.success(`Opening ${user.name}'s demo workspace`);
    navigate(user.role === "superadmin" ? "/super" : "/app", { replace: true });
  };

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-5 py-16">
      <Link to="/" className="mb-6 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Flame className="h-4 w-4" />
        </span>
        <span className="text-lg font-semibold">SignalHost</span>
      </Link>
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Welcome back</CardTitle>
          <CardDescription>Sign in to your SignalHost dashboard.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@business.com" />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <a href="#" className="text-xs text-muted-foreground hover:text-foreground">Forgot?</a>
              </div>
              <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Signing in..." : "Sign in"}
            </Button>
            {localDemoEnabled && (
              <div className="grid gap-2 sm:grid-cols-2">
                {selectedDemoProfile && (
                  <Button
                    type="button"
                    className="h-auto min-h-11 w-full flex-col items-start gap-0.5 px-3 py-2 text-left sm:col-span-2"
                    onClick={() => openDemoWorkspace("admin", selectedDemoProfile.demoSiteSlug)}
                  >
                    <span className="text-sm font-medium">Open {selectedDemoProfile.businessName}</span>
                    <span className="text-[11px] opacity-80">{getDemoBusinessLabel(selectedDemoProfile)} demo workspace</span>
                  </Button>
                )}
                <Button type="button" variant="outline" className="w-full" onClick={() => openDemoWorkspace("superadmin")}>
                  Staff console
                </Button>
                {verticalDemoProfiles.map((profile) => (
                  <Button
                    key={profile.demoSiteSlug}
                    type="button"
                    variant="outline"
                    className="h-auto min-h-10 w-full flex-col items-start gap-0.5 px-3 py-2 text-left"
                    onClick={() => openDemoWorkspace("admin", profile.demoSiteSlug)}
                  >
                    <span className="text-sm font-medium">{profile.businessName}</span>
                    <span className="text-[11px] text-muted-foreground">{getDemoBusinessLabel(profile)}</span>
                  </Button>
                ))}
              </div>
            )}
            <p className="text-center text-xs text-muted-foreground">
              No account? <Link to="/signup" className="text-foreground underline-offset-4 hover:underline">Start free</Link>
            </p>
            {localDemoEnabled && (
              <p className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
                Local demo shortcuts are available in development so testing does not depend on typing credentials. Production Supabase login still requires a real account.
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
