import { PageHeader, PageBody } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { users } from "@/data/mock";
import { Switch } from "@/components/ui/switch";

const notifications = [
  { id: "missed", label: "Missed calls" },
  { id: "escalations", label: "Escalations" },
  { id: "new_orders", label: "New orders" },
  { id: "reservation_requests", label: "Reservation requests" },
  { id: "daily_digest", label: "Daily digest" },
];

export default function Team() {
  return (
    <>
      <PageHeader title="Team" description="Invite teammates and manage roles" actions={<Button size="sm">Invite user</Button>} />
      <PageBody>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Members</CardTitle></CardHeader>
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

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Notifications</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr className="border-b border-border">
                      <th className="py-2 text-left font-medium">Event</th>
                      <th className="py-2 px-2 text-center font-medium">Email</th>
                      <th className="py-2 px-2 text-center font-medium">SMS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notifications.map(n => (
                      <tr key={n.id} className="border-b border-border last:border-0">
                        <td className="py-2.5">{n.label}</td>
                        <td className="py-2.5 text-center"><Switch defaultChecked /></td>
                        <td className="py-2.5 text-center"><Switch defaultChecked={n.id !== "daily_digest"} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </PageBody>
    </>
  );
}
