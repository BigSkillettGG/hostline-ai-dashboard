import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { Flame, Menu, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useCurrentUser, signOut } from "@/lib/auth";
import { industrySolutions } from "@/data/industry-solutions";

export default function MarketingLayout() {
  const user = useCurrentUser();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="bg-foreground text-background">
        <div className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-5 py-2 text-xs">
          <Sparkles className="h-3 w-3 shrink-0 text-primary-glow" />
          <span className="font-medium">New:</span>
          <span className="opacity-80">
            <span className="hidden sm:inline">AI phone plus website chat for restaurants, trades, and salons.</span>
            <span className="sm:hidden">AI phone plus website chat.</span>
          </span>
          <Link to="/#solutions" className="ml-1 shrink-0 underline-offset-2 hover:underline">See solutions</Link>
        </div>
      </div>

      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-5 md:gap-6">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Flame className="h-4 w-4" />
            </span>
            <span className="text-base font-semibold">HostLine AI</span>
          </Link>

          <nav className="hidden items-center gap-5 text-sm md:flex">
            <NavLink to="/" end className={({ isActive }) => isActive ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}>Product</NavLink>
            <a href="/#solutions" className="text-muted-foreground hover:text-foreground">Solutions</a>
            <NavLink to="/pricing" className={({ isActive }) => isActive ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}>Pricing</NavLink>
            <a href="/#live-demo" className="text-muted-foreground hover:text-foreground">Live demo</a>
            <a href="/#how" className="text-muted-foreground hover:text-foreground">How it works</a>
            <a href="mailto:sales@hostline.ai" className="text-muted-foreground hover:text-foreground">Talk to sales</a>
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <>
                <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                  <Link to={user.role === "superadmin" ? "/super" : "/app"}>Open dashboard</Link>
                </Button>
                <Button variant="outline" size="sm" onClick={() => signOut()} className="hidden sm:inline-flex">Sign out</Button>
              </>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex"><Link to="/login">Log in</Link></Button>
                <Button asChild size="sm"><Link to="/signup">Start free</Link></Button>
              </>
            )}

            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72">
                <nav className="mt-8 flex flex-col gap-1 text-base">
                  {[
                    { to: "/", label: "Product" },
                    { to: "/#solutions", label: "Solutions" },
                    { to: "/pricing", label: "Pricing" },
                    { to: "/#live-demo", label: "Live demo" },
                    { to: "/#how", label: "How it works" },
                  ].map((link) => (
                    <Link key={link.label} to={link.to} onClick={() => setOpen(false)} className="rounded-md px-3 py-2.5 text-foreground hover:bg-muted">
                      {link.label}
                    </Link>
                  ))}
                  <a href="mailto:sales@hostline.ai" onClick={() => setOpen(false)} className="rounded-md px-3 py-2.5 text-foreground hover:bg-muted">Talk to sales</a>
                  <div className="mt-4 border-t border-border pt-4">
                    {user ? (
                      <div className="flex flex-col gap-2">
                        <Button asChild onClick={() => setOpen(false)}>
                          <Link to={user.role === "superadmin" ? "/super" : "/app"}>Open dashboard</Link>
                        </Button>
                        <Button variant="outline" onClick={() => { setOpen(false); signOut(); }}>Sign out</Button>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <Button asChild variant="outline" onClick={() => setOpen(false)}><Link to="/login">Log in</Link></Button>
                        <Button asChild onClick={() => setOpen(false)}><Link to="/signup">Start free trial</Link></Button>
                      </div>
                    )}
                  </div>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-border bg-card">
        <div className="mx-auto max-w-6xl px-5 py-12">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-6 md:gap-10">
            <div className="col-span-2 md:col-span-2">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <Flame className="h-4 w-4" />
                </span>
                <span className="text-base font-semibold">HostLine AI</span>
              </div>
              <p className="mt-3 max-w-sm text-sm text-muted-foreground">
                The AI phone and website chat operator for local businesses. Answer every call, capture every request, and give staff clean follow-up.
              </p>
            </div>

            {[
              { title: "Product", links: [["Overview", "/"], ["Pricing", "/pricing"], ["How it works", "/#how"], ["Live demo", "/#live-demo"]] },
              { title: "Solutions", links: industrySolutions.slice(0, 4).map((solution) => [solution.label, `/solutions/${solution.slug}`]) },
              { title: "Company", links: [["Contact", "mailto:hello@hostline.ai"], ["Sales", "mailto:sales@hostline.ai"], ["Log in", "/login"]] },
              { title: "Legal", links: [["Privacy", "#"], ["Terms", "#"], ["Security", "#"], ["DPA", "#"]] },
            ].map((column) => (
              <div key={column.title}>
                <div className="text-xs font-semibold uppercase text-foreground">{column.title}</div>
                <ul className="mt-3 space-y-2 text-sm">
                  {column.links.map(([label, href]) => (
                    <li key={label}>
                      <Link to={href} className="text-muted-foreground hover:text-foreground">{label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-col gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>&copy; {new Date().getFullYear()} HostLine AI - Built for local service teams.</span>
            <span>Built with care in Brooklyn, NY.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
