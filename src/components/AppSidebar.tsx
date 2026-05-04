import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Phone, ShoppingBag, CalendarDays, BookOpen,
  Bot, Plug, Settings as SettingsIcon, UtensilsCrossed, Flame,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Calls", url: "/calls", icon: Phone },
  { title: "Orders", url: "/orders", icon: ShoppingBag },
  { title: "Reservations", url: "/reservations", icon: CalendarDays },
  { title: "Menu", url: "/menu", icon: UtensilsCrossed },
  { title: "Knowledge Base", url: "/knowledge", icon: BookOpen },
  { title: "Voice Agent", url: "/voice-agent", icon: Bot },
  { title: "Integrations", url: "/integrations", icon: Plug },
  { title: "Settings", url: "/settings", icon: SettingsIcon },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const isActive = (path: string) => path === "/" ? pathname === "/" : pathname.startsWith(path);

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
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <NavLink to={item.url} end={item.url === "/"} className={cn(
                      "flex items-center gap-2.5",
                    )}>
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
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
