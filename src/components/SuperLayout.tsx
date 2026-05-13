import { Outlet, NavLink, useLocation } from "react-router-dom";
import { Bell, ChevronDown, Flame, LayoutDashboard, Building2, Bot, Phone, CreditCard, FileText, PhoneCall, ClipboardList, ListChecks, ListTodo } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter,
  SidebarProvider, SidebarTrigger, useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getAuthReadiness, isDemoAuthMode, isPlatformAdminUser, useCurrentUser, signOut, setRole } from "@/lib/auth";
import { useNavigate } from "react-router-dom";

const items = [
  { title: "Overview", url: "/super", icon: LayoutDashboard, end: true },
  { title: "Tenants", url: "/super/tenants", icon: Building2 },
  { title: "Calls", url: "/super/calls", icon: PhoneCall },
  { title: "Action Center", url: "/super/tasks", icon: ListTodo },
  { title: "QA Queue", url: "/super/qa", icon: ClipboardList },
  { title: "Scenario Lab", url: "/super/scenarios", icon: ListChecks },
  { title: "Voice Agent", url: "/super/voice-agent", icon: Bot },
  { title: "Telephony", url: "/super/telephony", icon: Phone },
  { title: "Billing", url: "/super/billing", icon: CreditCard },
  { title: "Audit log", url: "/super/audit", icon: FileText },
];

function SuperSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const isActive = (url: string, end?: boolean) => end ? pathname === url : pathname.startsWith(url);

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-destructive text-destructive-foreground">
            <Flame className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="min-w-0 leading-tight">
              <div className="truncate text-sm font-semibold text-sidebar-foreground">SignalHost</div>
              <div className="truncate text-[11px] text-sidebar-foreground/60">Internal · Staff</div>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Operations</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((it) => (
                <SidebarMenuItem key={it.title}>
                  <SidebarMenuButton asChild isActive={isActive(it.url, it.end)} tooltip={it.title}>
                    <NavLink to={it.url} end={it.end} className="flex items-center gap-2.5">
                      <it.icon className="h-4 w-4 shrink-0" />
                      <span>{it.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        {!collapsed && <div className="px-2 py-2 text-[11px] text-sidebar-foreground/60">Staff console v1.0</div>}
      </SidebarFooter>
    </Sidebar>
  );
}

export default function SuperLayout() {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const authReadiness = getAuthReadiness();
  const demoAuth = isDemoAuthMode();
  const platformAccess = isPlatformAdminUser(user);
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <SuperSidebar />
        <div className="flex flex-1 flex-col min-w-0">
          <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-3 backdrop-blur md:px-5">
            <SidebarTrigger />
            <Badge variant="outline" className="border-destructive/40 bg-destructive/10 text-destructive">SignalHost Staff</Badge>
            <Badge
              variant="outline"
              className={authReadiness.ready ? "hidden border-success/20 bg-success/10 text-success sm:inline-flex" : "hidden border-warning/30 bg-warning/10 text-warning sm:inline-flex"}
              title={authReadiness.detail}
            >
              {authReadiness.badge}
            </Badge>
            <div className="ml-auto flex items-center gap-2">
              {demoAuth && (
                <Button variant="outline" size="sm" onClick={() => { setRole("admin"); navigate("/app"); }}>
                  View as Admin
                </Button>
              )}
              <Button variant="ghost" size="icon" className="relative h-9 w-9">
                <Bell className="h-4 w-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2">
                    <Avatar className="h-7 w-7"><AvatarFallback className="bg-destructive/10 text-destructive text-xs font-semibold">{(user?.name ?? "S").slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                    <span className="hidden text-sm font-medium sm:inline">{user?.name ?? "Staff"}</span>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="text-sm">{user?.name}</div>
                    <div className="text-xs font-normal text-muted-foreground">
                      {platformAccess ? "Platform admin" : "Staff console"}
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => { signOut(); navigate("/"); }}>Sign out</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <main className="flex-1 min-w-0"><Outlet /></main>
        </div>
      </div>
    </SidebarProvider>
  );
}
