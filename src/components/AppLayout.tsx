import { Outlet, useNavigate } from "react-router-dom";
import { Bell, Search, MapPin, ChevronDown } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { getAuthReadiness, isDemoAuthMode, useCurrentUser, signOut, setRole } from "@/lib/auth";

export default function AppLayout() {
  const [agentLive, setAgentLive] = useState(true);
  const user = useCurrentUser();
  const navigate = useNavigate();
  const initials = (user?.name ?? "ML").split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
  const authReadiness = getAuthReadiness();
  const demoAuth = isDemoAuthMode();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />

        <div className="flex flex-1 flex-col min-w-0">
          <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-3 backdrop-blur md:px-5">
            <SidebarTrigger />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1.5 px-2 text-sm font-medium">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="hidden sm:inline">Olive & Ember · Valencia</span>
                  <span className="sm:hidden">Valencia</span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>Locations</DropdownMenuLabel>
                <DropdownMenuItem>Olive & Ember · Valencia</DropdownMenuItem>
                <DropdownMenuItem disabled>Olive & Ember · Hayes (soon)</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Add location</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="relative ml-auto hidden md:block w-72">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search calls, orders, guests…" className="h-9 pl-8 text-sm" />
            </div>

            <div className="ml-auto md:ml-0 flex items-center gap-2">
              <Badge
                variant="outline"
                className={authReadiness.ready ? "hidden border-success/20 bg-success/10 text-success lg:inline-flex" : "hidden border-warning/30 bg-warning/10 text-warning lg:inline-flex"}
                title={authReadiness.detail}
              >
                {authReadiness.badge}
              </Badge>
              <div className="hidden sm:flex items-center gap-2 rounded-full border border-border bg-card px-2.5 py-1">
                <span className={`h-1.5 w-1.5 rounded-full ${agentLive ? "bg-success animate-pulse" : "bg-muted-foreground"}`} />
                <span className="text-xs font-medium">{agentLive ? "AI Live" : "Paused"}</span>
                <Switch checked={agentLive} onCheckedChange={setAgentLive} className="h-4 w-7 data-[state=checked]:bg-success" />
              </div>

              <Button variant="ghost" size="icon" className="relative h-9 w-9">
                <Bell className="h-4 w-4" />
                <Badge className="absolute -right-0.5 -top-0.5 h-4 min-w-4 px-1 text-[10px] bg-primary text-primary-foreground">4</Badge>
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">{initials}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="text-sm">{user?.name ?? "Maria Lombardi"}</div>
                    <div className="text-xs font-normal text-muted-foreground">{user?.email ?? "Owner"}</div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/app/profile")}>Profile</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/app/billing")}>Billing</DropdownMenuItem>
                  {demoAuth && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => { setRole("superadmin"); navigate("/super"); }}>
                        Switch to Super Admin
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuItem onClick={() => { signOut(); navigate("/"); }}>Sign out</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <main className="flex-1 min-w-0">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
