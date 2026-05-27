import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Phone, ShoppingBag, CalendarDays, BookOpen,
  Flame, CreditCard, ChefHat, AlertTriangle, BellRing, ListChecks,
  Settings as SettingsIcon,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { getOnboardingBusinessTemplate } from "@/domain/onboarding";
import { loadOnboardingDraft } from "@/lib/onboarding-draft";
import { isPlatformAdminUser, useCurrentUser } from "@/lib/auth";

type NavItem = { title: string; url: string; icon: typeof Phone; end?: boolean };

const main: NavItem[] = [
  { title: "Dashboard", url: "/app", icon: LayoutDashboard, end: true },
  { title: "Needs Attention", url: "/app/needs-attention", icon: AlertTriangle },
  { title: "Calls", url: "/app/calls", icon: Phone },
];
const operations: NavItem[] = [
  { title: "Orders", url: "/app/orders", icon: ShoppingBag },
  { title: "Kitchen", url: "/app/kitchen", icon: ChefHat },
  { title: "Reservations", url: "/app/reservations", icon: CalendarDays },
];
const knowledge: NavItem[] = [
  { title: "Knowledge Base", url: "/app/knowledge", icon: BookOpen },
];
const account: NavItem[] = [
  { title: "Settings", url: "/app/settings", icon: SettingsIcon },
  { title: "Billing", url: "/app/billing", icon: CreditCard },
];
const diagnostics: NavItem[] = [
  { title: "Test Suite", url: "/app/test-suite", icon: ListChecks },
  { title: "Alert Log", url: "/app/alert-log", icon: BellRing },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const user = useCurrentUser();
  const platformAdmin = isPlatformAdminUser(user);
  const isActive = (url: string, end?: boolean) =>
    end ? pathname === url : pathname === url || pathname.startsWith(url + "/");

  const draft = loadOnboardingDraft();
  const businessTemplate = getOnboardingBusinessTemplate(draft);
  const businessName = String(draft.restaurantName || businessTemplate.defaultName);

  const adaptOps = (items: NavItem[]) => items.map((item) => {
    if (businessTemplate.id === "restaurant") return item;
    if (item.title === "Orders") return { ...item, title: businessTemplate.id === "salon_barber" ? "Client Requests" : "Requests" };
    if (item.title === "Kitchen") return { ...item, title: businessTemplate.id === "salon_barber" ? "Front Desk" : "Dispatch" };
    if (item.title === "Reservations") return { ...item, title: businessTemplate.appointmentNoun === "inspection" ? "Inspections" : "Appointments" };
    return item;
  });

  const renderItem = (item: NavItem) => (
    <SidebarMenuItem key={item.title}>
      <SidebarMenuButton asChild isActive={isActive(item.url, item.end)} tooltip={item.title}>
        <NavLink to={item.url} end={item.end} className="flex items-center gap-2.5">
          <item.icon className="h-4 w-4 shrink-0" />
          <span>{item.title}</span>
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <Flame className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="min-w-0 leading-tight">
              <div className="truncate text-sm font-semibold text-sidebar-foreground">SignalHost</div>
              <div className="truncate text-[11px] text-sidebar-foreground/60">{businessName}</div>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{main.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>
            {businessTemplate.id === "restaurant" ? "Restaurant Operations" : "Operations"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{adaptOps(operations).map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Knowledge</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{knowledge.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Account</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{account.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {platformAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Diagnostics</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{diagnostics.map(renderItem)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        {!collapsed && (
          <div className="px-2 py-2 text-[11px] text-sidebar-foreground/60">
            v1.0 · <span className="text-sidebar-foreground/80">Live</span>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
