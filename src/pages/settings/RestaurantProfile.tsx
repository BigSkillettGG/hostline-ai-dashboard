import { PageHeader, PageBody } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { restaurant } from "@/data/mock";
import { toast } from "sonner";

export default function RestaurantProfile() {
  return (
    <>
      <PageHeader title="Restaurant Profile" description="Name, cuisine, locations" actions={<Button size="sm" onClick={() => toast.success("Profile saved")}>Save</Button>} />
      <PageBody>
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Profile</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5"><Label>Name</Label><Input defaultValue={restaurant.name} /></div>
                <div className="space-y-1.5"><Label>Cuisine</Label><Input defaultValue={restaurant.cuisine} /></div>
              </div>
              <div className="space-y-1.5"><Label>Address</Label><Input defaultValue={restaurant.address} /></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5"><Label>Timezone</Label>
                  <Select defaultValue="la">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="la">America/Los_Angeles</SelectItem>
                      <SelectItem value="ny">America/New_York</SelectItem>
                      <SelectItem value="ch">America/Chicago</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>Contact phone</Label><Input defaultValue={restaurant.phone} /></div>
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
                    <div className="text-sm font-medium">Olive & Ember · Valencia</div>
                    <div className="text-xs text-muted-foreground">{restaurant.address}</div>
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
