import { FormEvent, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isDemoAuthMode, signIn, startDemoSession } from "@/lib/auth";
import { toast } from "sonner";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const demoAuth = isDemoAuthMode();

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

  const openDemoWorkspace = () => {
    const user = startDemoSession("admin");
    toast.success(`Opening ${user.name}'s demo workspace`);
    navigate("/app", { replace: true });
  };

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-5 py-16">
      <Link to="/" className="mb-6 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Flame className="h-4 w-4" />
        </span>
        <span className="text-lg font-semibold tracking-tight">HostLine AI</span>
      </Link>
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Welcome back</CardTitle>
          <CardDescription>Sign in to your HostLine AI dashboard.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@restaurant.com" />
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
            {demoAuth && (
              <Button type="button" variant="outline" className="w-full" onClick={openDemoWorkspace}>
                Open demo workspace
              </Button>
            )}
            <p className="text-center text-xs text-muted-foreground">
              No account? <Link to="/signup" className="text-foreground underline-offset-4 hover:underline">Start free</Link>
            </p>
            {demoAuth && (
              <p className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
                Demo: any email works. Use the demo workspace for a restaurant-owner sales walkthrough, or an email containing <code className="font-mono">staff</code> or <code className="font-mono">@hostline</code> for the internal console.
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
