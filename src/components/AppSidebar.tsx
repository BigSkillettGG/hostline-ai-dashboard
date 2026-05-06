import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Phone, ShoppingBag, CalendarDays, BookOpen,
  Bot, Plug, Settings as SettingsIcon, UtensilsCrossed, Flame,
  CreditCard, Users, Building2, ChevronDown, AlertTriangle, BellRing,
  ChefHat,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState } from "react";

const operations = [
  { title: "Dashboard", url: "/app", icon: LayoutDashboard, end: true },
  { title: "Calls", url: "/app/calls", icon: Phone },
  { title: "Orders", url: "/app/orders", icon: ShoppingBag },
  { title: "Kitchen", url: "/app/kitchen", icon: ChefHat },
  { title: "Reservations", url: "/app/reservations", icon: CalendarDays },
  { title: "Escalations", url: "/app/escalations", icon: AlertTriangle },
];
const content = [
  { title: "Menu", url: "/app/menu", icon: UtensilsCrossed },
  { title: "Knowledge Base", url: "/app/knowledge", icon: BookOpen },
];
const settings = [
  { title: "Voice Agent", url: "/app/voice-agent", icon: Bot },
  { title: "Integrations", url: "/app/integrations", icon: Plug },
  { title: "Phone & Hours", url: "/app/settings", icon: Phone },
  { title: "Alerts & Routing", url: "/app/settings/alerts", icon: BellRing },
  { title: "Team", url: "/app/team", icon: Users },
  { title: "Restaurant Profile", url: "/app/profile", icon: Building2 },
  { title: "Billing", url: "/app/billing", icon: CreditCard },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const isActive = (url: string, end?: boolean) => end ? pathname === url : pathname === url || pathname.startsWith(url + "/");
  const settingsActive = settings.some((s) => isActive(s.url));
  const [settingsOpen, setSettingsOpen] = useState(settingsActive);

  const renderItem = (item: { title: string; url: string; icon: typeof Phone; end?: boolean }) => (
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
              <div className="truncate text-sm font-semibold text-sidebar-foreground">HostLine AI</div>
              <div className="truncate text-[11px] text-sidebar-foreground/60">Olive & Ember</div>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Operations</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{operations.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Content</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{content.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {collapsed ? (
          <SidebarGroup>
            <SidebarGroupLabel>Settings</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{settings.map(renderItem)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : (
          <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
            <SidebarGroup>
              <CollapsibleTrigger asChild>
                <SidebarGroupLabel className="group/label flex cursor-pointer items-center justify-between hover:text-sidebar-foreground">
                  <span className="flex items-center gap-1.5"><SettingsIcon className="h-3 w-3" />Settings</span>
                  <ChevronDown className={`h-3 w-3 transition-transform ${settingsOpen ? "" : "-rotate-90"}`} />
                </SidebarGroupLabel>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>{settings.map(renderItem)}</SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
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
