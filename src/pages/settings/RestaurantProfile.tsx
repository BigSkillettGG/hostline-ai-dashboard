import { useQuery } from "@tanstack/react-query";
import { PageHeader, PageBody } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getOnboardingBusinessTemplate } from "@/domain/onboarding";
import { restaurant } from "@/data/mock";
import { loadOnboardingDraft } from "@/lib/onboarding-draft";
import {
  fetchTenantDirectoryFromSupabase,
  getActiveSupabaseLocationId,
  isSupabaseConfigured,
} from "@/lib/supabase-rest";
import { toast } from "sonner";

export default function RestaurantProfile() {
  const draft = loadOnboardingDraft();
  const template = getOnboardingBusinessTemplate(draft);
  const businessName = String(draft.restaurantName || template.defaultName);
  const profileDescription = String(draft.concept || template.defaultOffering);
  const addressOrArea = String(draft.primaryLocation || restaurant.address);
  const contactPhone = String(draft.mainPhone || restaurant.phone);
  const timezone = String(draft.timezone || restaurant.timezone);
  const locationLabel = template.id === "restaurant" ? `${businessName} - Valencia` : businessName;
  const profileLabel = template.id === "restaurant" ? "Cuisine / concept" : "Services and specialties";
  const timezoneValue = timezone.includes("New_York") ? "ny" : timezone.includes("Chicago") ? "ch" : "la";
  const activeLocationId = getActiveSupabaseLocationId();
  const tenantQuery = useQuery({
    enabled: isSupabaseConfigured(),
    queryFn: fetchTenantDirectoryFromSupabase,
    queryKey: ["tenant-directory", activeLocationId],
  });
  const liveTenant =
    tenantQuery.data?.find((tenant) => tenant.locationId === activeLocationId) ??
    tenantQuery.data?.[0];

  return (
    <>
      <PageHeader title="Business Profile" description="Name, service model, and locations" actions={<Button size="sm" onClick={() => toast.success("Profile saved")}>Save</Button>} />
      <PageBody>
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Profile</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5"><Label>Business name</Label><Input defaultValue={businessName} /></div>
                <div className="space-y-1.5"><Label>Business type</Label><Input defaultValue={template.label} /></div>
              </div>
              <div className="space-y-1.5"><Label>{profileLabel}</Label><Input defaultValue={profileDescription} /></div>
              <div className="space-y-1.5"><Label>Address or service area</Label><Input defaultValue={addressOrArea} /></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5"><Label>Timezone</Label>
                  <Select defaultValue={timezoneValue}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="la">America/Los_Angeles</SelectItem>
                      <SelectItem value="ny">America/New_York</SelectItem>
                      <SelectItem value="ch">America/Chicago</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>Contact phone</Label><Input defaultValue={contactPhone} /></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Locations</CardTitle>
              <Button size="sm" variant="outline">Add location</Button>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-border rounded-md border border-border">
                <div className="flex items-center justify-between p-3">
                  <div>
                    <div className="text-sm font-medium">{locationLabel}</div>
                    <div className="text-xs text-muted-foreground">{addressOrArea}</div>
                  </div>
                  <Badge variant="outline" className="border-success/30 bg-success/10 text-success">Active</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Live provisioning</CardTitle>
            </CardHeader>
            <CardContent>
              {liveTenant ? (
                <div className="grid gap-3 md:grid-cols-4">
                  <ProvisioningFact label="Organization ID" value={liveTenant.organizationId} mono />
                  <ProvisioningFact label="Location ID" value={liveTenant.locationId} mono />
                  <ProvisioningFact label="Vertical" value={liveTenant.businessLabel} />
                  <ProvisioningFact label="Onboarding" value={`${liveTenant.onboardingProgressPercent}% - ${formatStatusText(liveTenant.onboardingStatus)}`} />
                  <ProvisioningFact label="SignalHost number" value={liveTenant.aiHostPhone ?? "Not provisioned"} mono />
                  <ProvisioningFact label="Main line" value={liveTenant.mainPhone ?? "Not set"} mono />
                  <ProvisioningFact label="Plan" value={`${liveTenant.planName} - $${liveTenant.monthlyPrice}/mo`} />
                  <ProvisioningFact label="Calls this month" value={liveTenant.callsThisMonth.toLocaleString()} />
                </div>
              ) : tenantQuery.isError ? (
                <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
                  Live tenant lookup failed. {tenantQuery.error instanceof Error ? tenantQuery.error.message : ""}
                </div>
              ) : (
                <div className="rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                  {isSupabaseConfigured() ? "Loading live tenant record..." : "Supabase is not configured in this environment."}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </PageBody>
    </>
  );
}

function ProvisioningFact({ label, mono, value }: { label: string; mono?: boolean; value: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/20 p-3">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className={`mt-1 truncate text-sm font-medium ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}

function formatStatusText(value: string) {
  return value.replace(/_/g, " ");
}
