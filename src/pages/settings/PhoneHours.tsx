import { PageHeader, PageBody } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { restaurant } from "@/data/mock";
import { toast } from "sonner";

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export default function PhoneHours() {
  return (
    <>
      <PageHeader title="Phone & Hours" description="Forwarding numbers and weekly schedule" actions={<Button size="sm" onClick={() => toast.success("Saved")}>Save</Button>} />
      <PageBody>
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Phone numbers</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5"><Label>Restaurant main line</Label><Input defaultValue={restaurant.phone} /></div>
              <div className="space-y-1.5"><Label>AI host number</Label><Input defaultValue={restaurant.aiHostNumber} /></div>
              <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                Port-in status: <span className="font-medium text-foreground">Active</span> · forwarding to AI host on overflow.
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Business hours</CardTitle></CardHeader>
            <CardContent>
              <div className="divide-y divide-border rounded-md border border-border">
                {days.map(d => (
                  <div key={d} className="flex items-center justify-between p-3">
                    <div className="w-20 text-sm font-medium">{d}</div>
                    <div className="flex flex-1 items-center justify-end gap-2">
                      <Input className="h-8 w-24" defaultValue={restaurant.hours[d].includes("Closed") ? "" : restaurant.hours[d].split("–")[0].trim()} placeholder="Open" />
                      <span className="text-muted-foreground">–</span>
                      <Input className="h-8 w-24" defaultValue={restaurant.hours[d].includes("Closed") ? "" : restaurant.hours[d].split("–")[1]?.trim()} placeholder="Close" />
                      <Switch defaultChecked={!restaurant.hours[d].includes("Closed")} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </PageBody>
    </>
  );
}
