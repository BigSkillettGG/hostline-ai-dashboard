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
        </div>
      </PageBody>
    </>
  );
}
