import { Link, NavLink, Outlet } from "react-router-dom";
import { Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrentUser, signOut } from "@/lib/auth";

export default function MarketingLayout() {
  const user = useCurrentUser();
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-5">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Flame className="h-4 w-4" />
            </span>
            <span className="text-base font-semibold tracking-tight">HostLine AI</span>
          </Link>
          <nav className="hidden items-center gap-5 text-sm md:flex">
            <NavLink to="/" end className={({ isActive }) => isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"}>Product</NavLink>
            <NavLink to="/pricing" className={({ isActive }) => isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"}>Pricing</NavLink>
            <a href="#how" className="text-muted-foreground hover:text-foreground">How it works</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link to={user.role === "superadmin" ? "/super" : "/app"}>Open dashboard</Link>
                </Button>
                <Button variant="outline" size="sm" onClick={() => signOut()}>Sign out</Button>
              </>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm"><Link to="/login">Log in</Link></Button>
                <Button asChild size="sm"><Link to="/signup">Start free</Link></Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-border bg-card/40">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Flame className="h-3.5 w-3.5 text-primary" />
            <span>© {new Date().getFullYear()} HostLine AI</span>
          </div>
          <div className="flex gap-4">
            <Link to="/pricing" className="hover:text-foreground">Pricing</Link>
            <a href="mailto:hello@hostline.ai" className="hover:text-foreground">Contact</a>
            <a href="#" className="hover:text-foreground">Privacy</a>
            <a href="#" className="hover:text-foreground">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
