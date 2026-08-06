import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { Bell, Building2, Check, Search, MapPin, ChevronDown } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  getAuthReadiness,
  getActiveLocationId,
  getPartnerRoleLabel,
  getRestaurantRoleLabel,
  isDemoAuthMode,
  isDemoWorkspace,
  isPlatformAdminUser,
  useCurrentUser,
  signOut,
  setRole,
  updateCurrentUserAccess,
} from "@/lib/auth";
import {
  fetchDepartmentDirectoryFromSupabase,
  fetchTenantDirectoryFromSupabase,
  isSupabaseConfigured,
} from "@/lib/supabase-rest";
import { getOnboardingBusinessTemplate } from "@/domain/onboarding";
import { selectActiveDepartmentId } from "@/domain/commercial-hierarchy";
import { loadOnboardingDraft } from "@/lib/onboarding-draft";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { toast } from "sonner";

export default function AppLayout() {
  const [agentLive, setAgentLive] = useState(true);
  const user = useCurrentUser();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const initials = (user?.name ?? "ML").split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
  const authReadiness = getAuthReadiness();
  const demoAuth = isDemoAuthMode();
  const platformAdmin = isPlatformAdminUser(user);
  const activeLocationId = getActiveLocationId();
  const activeDepartmentId = user?.activeDepartmentId;
  const tenantQuery = useQuery({
    enabled: isSupabaseConfigured() && Boolean(activeLocationId),
    queryFn: fetchTenantDirectoryFromSupabase,
    queryKey: ["tenant-directory", "app-shell", activeLocationId],
    staleTime: 60_000,
  });
  const activeTenant = tenantQuery.data?.find((tenant) => tenant.locationId === activeLocationId);
  const tenantOptions = tenantQuery.data?.filter((tenant) => tenant.locationId !== "not-created") ?? [];
  const departmentQuery = useQuery({
    enabled: user?.authProvider === "supabase" && Boolean(activeLocationId),
    queryFn: () => fetchDepartmentDirectoryFromSupabase(activeLocationId),
    queryKey: ["department-directory", "app-shell", activeLocationId],
    staleTime: 60_000,
  });
  const departmentOptions = departmentQuery.data?.filter(
    (department) => department.locationId === activeLocationId,
  ) ?? [];
  const activeDepartment = departmentOptions.find((department) => department.id === activeDepartmentId);
  const restaurantRole = getRestaurantRoleLabel(user?.restaurantMembershipRole);
  const partnerRole = getPartnerRoleLabel(user?.partnerMembershipRole);
  const partnerWorkspace = user?.workspaceKind === "partner";
  const draft = loadOnboardingDraft();
  const businessTemplate = getOnboardingBusinessTemplate(draft);
  const businessName = String(draft.restaurantName || businessTemplate.defaultName);
  const locationLabel =
    activeTenant?.locationName ??
    (businessTemplate.id === "restaurant" ? `${businessName} - Valencia` : businessName);
  const workspaceLabel = activeTenant?.businessLabel ?? businessTemplate.workspaceLabel;
  const scopeMenuLabel = platformAdmin
    ? "Customer workspaces"
    : partnerWorkspace
      ? "Partner workspaces"
      : "Locations";

  useEffect(() => {
    if (!departmentQuery.data) return;
    const nextDepartmentId = selectActiveDepartmentId(
      departmentQuery.data,
      activeLocationId,
      activeDepartmentId,
    );
    if (nextDepartmentId === activeDepartmentId) return;
    updateCurrentUserAccess({ activeDepartmentId: nextDepartmentId ?? null });
  }, [activeDepartmentId, activeLocationId, departmentQuery.data]);

  function switchWorkspace(tenant: NonNullable<typeof tenantQuery.data>[number]) {
    if (tenant.locationId === activeLocationId) return;
    updateCurrentUserAccess({
      activeDepartmentId: null,
      activeLocationId: tenant.locationId,
      activeOrganizationId: tenant.organizationId,
      activePartnerId: tenant.channelPartnerId,
    });
    void queryClient.invalidateQueries();
    toast.success(`Switched to ${tenant.locationName}`);
  }

  function switchDepartment(department: NonNullable<typeof departmentQuery.data>[number]) {
    if (department.locationId !== activeLocationId || department.id === activeDepartmentId) return;
    updateCurrentUserAccess({ activeDepartmentId: department.id });
    void queryClient.invalidateQueries();
    toast.success(`Switched to ${department.name}`);
  }

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
                  <span className="hidden sm:inline">
                    {activeDepartment ? `${locationLabel} / ${activeDepartment.name}` : locationLabel}
                  </span>
                  <span className="sm:hidden">{workspaceLabel}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>{scopeMenuLabel}</DropdownMenuLabel>
                {tenantQuery.isLoading && <DropdownMenuItem disabled>Loading accessible locations...</DropdownMenuItem>}
                {tenantQuery.isError && <DropdownMenuItem disabled>Could not load accessible locations</DropdownMenuItem>}
                {!tenantQuery.isLoading && !tenantQuery.isError && tenantOptions.length === 0 && (
                  <DropdownMenuItem disabled>{locationLabel}</DropdownMenuItem>
                )}
                {tenantOptions.map((tenant) => (
                  <DropdownMenuItem
                    key={tenant.locationId}
                    className="items-start gap-2"
                    onSelect={() => switchWorkspace(tenant)}
                  >
                    <Check className={`mt-0.5 h-3.5 w-3.5 ${tenant.locationId === activeLocationId ? "opacity-100" : "opacity-0"}`} />
                    <div className="min-w-0">
                      <div className="truncate font-medium">{tenant.locationName}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {partnerWorkspace || platformAdmin
                          ? `${tenant.channelPartnerName} · ${tenant.organizationName}`
                          : tenant.organizationName}
                      </div>
                    </div>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Departments</DropdownMenuLabel>
                {departmentQuery.isLoading && <DropdownMenuItem disabled>Loading accessible departments...</DropdownMenuItem>}
                {departmentQuery.isError && <DropdownMenuItem disabled>Could not load accessible departments</DropdownMenuItem>}
                {!departmentQuery.isLoading && !departmentQuery.isError && departmentOptions.length === 0 && (
                  <DropdownMenuItem disabled>No active departments</DropdownMenuItem>
                )}
                {departmentOptions.map((department) => (
                  <DropdownMenuItem
                    key={department.id}
                    className="items-start gap-2"
                    onSelect={() => switchDepartment(department)}
                  >
                    {department.id === activeDepartmentId
                      ? <Check className="mt-0.5 h-3.5 w-3.5" />
                      : <Building2 className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />}
                    <div className="min-w-0">
                      <div className="truncate font-medium">{department.name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {department.isDefault ? "Default department" : department.departmentType.replace(/_/g, " ")}
                      </div>
                    </div>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled>Add location (soon)</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="relative ml-auto hidden md:block w-72">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder={`Search calls, requests, ${businessTemplate.customerNoun}s...`} className="h-9 pl-8 text-sm" />
            </div>

            <div className="ml-auto md:ml-0 flex items-center gap-2">
              {platformAdmin && (
                <Badge
                  variant="outline"
                  className={authReadiness.ready ? "hidden border-success/20 bg-success/10 text-success lg:inline-flex" : "hidden border-warning/30 bg-warning/10 text-warning lg:inline-flex"}
                  title={authReadiness.detail}
                >
                  {authReadiness.badge}
                </Badge>
              )}
              {platformAdmin && isDemoWorkspace(user) && (
                <Badge variant="outline" className="hidden border-primary/20 bg-primary/10 text-primary lg:inline-flex">
                  Demo workspace
                </Badge>
              )}
              {platformAdmin && activeLocationId && (
                <Badge variant="outline" className="hidden border-warning/30 bg-warning/10 text-warning lg:inline-flex">
                  Staff tenant view
                </Badge>
              )}
              {partnerWorkspace && (
                <Badge variant="outline" className="hidden border-primary/20 bg-primary/10 text-primary lg:inline-flex">
                  Partner workspace
                </Badge>
              )}
              {platformAdmin && (
                <Button variant="outline" size="sm" className="hidden h-9 sm:inline-flex" onClick={() => navigate("/super/tenants")}>
                  Back to Super
                </Button>
              )}
              <div className="hidden sm:flex items-center gap-2 rounded-full border border-border bg-card px-2.5 py-1">
                <span className={`h-1.5 w-1.5 rounded-full ${agentLive ? "bg-success animate-pulse" : "bg-muted-foreground"}`} />
                <span className="text-xs font-medium">{agentLive ? "SignalHost Live" : "Paused"}</span>
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
                    <div className="text-xs font-normal text-muted-foreground">
                      {partnerWorkspace ? partnerRole : restaurantRole}
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/app/profile")}>Profile</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/app/billing")}>Billing</DropdownMenuItem>
                  {platformAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => navigate("/super/tenants")}>
                        Back to Super Console
                      </DropdownMenuItem>
                    </>
                  )}
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
            <ErrorBoundary resetKey={location.pathname} scopeLabel="page">
              <Outlet />
            </ErrorBoundary>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
