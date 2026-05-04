import { PageHeader, PageBody } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { restaurant, users } from "@/data/mock";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus } from "lucide-react";

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const notifications = [
  { id: "missed", label: "Missed calls" },
  { id: "escalations", label: "Escalations" },
  { id: "new_orders", label: "New orders" },
  { id: "reservation_requests", label: "Reservation requests" },
  { id: "daily_digest", label: "Daily digest" },
];

export default function Settings() {
  return (
    <>
      <PageHeader title="Settings" description="Manage your restaurant, team, and preferences" />
      <PageBody>
        <Tabs defaultValue="profile">
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="locations">Locations</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="phones">Phone numbers</TabsTrigger>
            <TabsTrigger value="hours">Business hours</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Restaurant profile</CardTitle></CardHeader>
              <CardContent className="space-y-4 max-w-xl">
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
                <div className="flex justify-end"><Button onClick={() => toast.success("Profile saved")}>Save</Button></div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="locations" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Locations</CardTitle>
                <Button size="sm"><Plus className="mr-1.5 h-3.5 w-3.5" />Add location</Button>
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-border rounded-md border border-border">
                  <div className="flex items-center justify-between p-3">
                    <div>
                      <div className="text-sm font-medium">Olive & Ember · Valencia</div>
                      <div className="text-xs text-muted-foreground">{restaurant.address}</div>
                    </div>
                    <Badge variant="outline" className="bg-success/15 text-success border-success/20">Active</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Team</CardTitle>
                <Button size="sm">Invite user</Button>
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-border rounded-md border border-border">
                  {users.map(u => (
                    <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8"><AvatarFallback className="bg-primary/10 text-primary text-xs">{u.name.split(" ").map(n => n[0]).join("")}</AvatarFallback></Avatar>
                        <div>
                          <div className="text-sm font-medium">{u.name}</div>
                          <div className="text-xs text-muted-foreground">{u.email}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">{u.lastActive}</span>
                        <Select defaultValue={u.role.toLowerCase()}>
                          <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="owner">Owner</SelectItem>
                            <SelectItem value="manager">Manager</SelectItem>
                            <SelectItem value="staff">Staff</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="phones" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Phone numbers</CardTitle></CardHeader>
              <CardContent className="space-y-4 max-w-xl">
                <div className="space-y-1.5"><Label>Restaurant main line</Label><Input defaultValue={restaurant.phone} /></div>
                <div className="space-y-1.5"><Label>AI host number</Label><Input defaultValue={restaurant.aiHostNumber} /></div>
                <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                  Port-in status: <span className="font-medium text-foreground">Active</span> · forwarding to AI host on overflow.
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="hours" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Business hours</CardTitle></CardHeader>
              <CardContent>
                <div className="divide-y divide-border rounded-md border border-border">
                  {days.map(d => (
                    <div key={d} className="flex items-center justify-between p-3">
                      <div className="w-24 text-sm font-medium">{d}</div>
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
          </TabsContent>

          <TabsContent value="notifications" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Notification preferences</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground">
                      <tr className="border-b border-border">
                        <th className="py-2 text-left font-medium">Event</th>
                        <th className="py-2 px-3 text-center font-medium">Email</th>
                        <th className="py-2 px-3 text-center font-medium">SMS</th>
                        <th className="py-2 px-3 text-center font-medium">Push</th>
                      </tr>
                    </thead>
                    <tbody>
                      {notifications.map(n => (
                        <tr key={n.id} className="border-b border-border last:border-0">
                          <td className="py-3">{n.label}</td>
                          <td className="py-3 px-3 text-center"><Switch defaultChecked /></td>
                          <td className="py-3 px-3 text-center"><Switch defaultChecked={n.id !== "daily_digest"} /></td>
                          <td className="py-3 px-3 text-center"><Switch defaultChecked={n.id === "escalations"} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </PageBody>
    </>
  );
}
