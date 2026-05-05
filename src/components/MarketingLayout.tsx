import { Link, NavLink, Outlet } from "react-router-dom";
import { Flame, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrentUser, signOut } from "@/lib/auth";

export default function MarketingLayout() {
  const user = useCurrentUser();
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* announcement bar */}
      <div className="bg-foreground text-background">
        <div className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-5 py-2 text-xs">
          <Sparkles className="h-3 w-3 text-primary-glow" />
          <span className="font-medium">New:</span>
          <span className="opacity-80">Toast & Square integrations now live — sync orders straight to your POS.</span>
          <Link to="/pricing" className="ml-1 underline-offset-2 hover:underline">Learn more →</Link>
        </div>
      </div>

      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-5">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Flame className="h-4 w-4" />
            </span>
            <span className="text-base font-semibold tracking-tight">HostLine AI</span>
          </Link>
          <nav className="hidden items-center gap-5 text-sm md:flex">
            <NavLink to="/" end className={({ isActive }) => isActive ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground"}>Product</NavLink>
            <NavLink to="/pricing" className={({ isActive }) => isActive ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground"}>Pricing</NavLink>
            <a href="/#how" className="text-muted-foreground hover:text-foreground">How it works</a>
            <a href="mailto:sales@hostline.ai" className="text-muted-foreground hover:text-foreground">Talk to sales</a>
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

      <footer className="border-t border-border bg-card">
        <div className="mx-auto max-w-6xl px-5 py-12">
          <div className="grid gap-10 md:grid-cols-5">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <Flame className="h-4 w-4" />
                </span>
                <span className="text-base font-semibold tracking-tight">HostLine AI</span>
              </div>
              <p className="mt-3 max-w-sm text-sm text-muted-foreground">
                The AI phone host built for independent restaurants. Answer every call, capture every order,
                never miss a reservation.
              </p>
            </div>

            {[
              { title: "Product", links: [["Overview", "/"], ["Pricing", "/pricing"], ["How it works", "/#how"], ["Integrations", "/#how"]] },
              { title: "Company", links: [["Customers", "/"], ["Contact", "mailto:hello@hostline.ai"], ["Sales", "mailto:sales@hostline.ai"]] },
              { title: "Legal", links: [["Privacy", "#"], ["Terms", "#"], ["Security", "#"], ["DPA", "#"]] },
            ].map((col) => (
              <div key={col.title}>
                <div className="text-xs font-semibold uppercase tracking-wider text-foreground">{col.title}</div>
                <ul className="mt-3 space-y-2 text-sm">
                  {col.links.map(([label, href]) => (
                    <li key={label}>
                      <Link to={href} className="text-muted-foreground hover:text-foreground">{label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-col gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>© {new Date().getFullYear()} HostLine AI · Made for restaurants.</span>
            <span>Built with care in Brooklyn, NY.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
