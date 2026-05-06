import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader, PageBody } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { restaurant } from "@/data/mock";
import {
  fetchPhoneNumbersFromSupabase,
  isSupabaseConfigured,
  type PhoneNumberRecord,
} from "@/lib/supabase-rest";

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const samplePhoneNumbers: PhoneNumberRecord[] = [
  {
    forwardingMode: "forward_unanswered",
    forwardingVerification: {},
    forwardingStatus: "pending_verification",
    id: "sample",
    phoneNumber: restaurant.aiHostNumber,
    provider: "twilio",
    restaurantMainLine: restaurant.phone,
    status: "provisioned",
  },
];

export default function PhoneHours() {
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumberRecord[]>(samplePhoneNumbers);
  const [dataMode, setDataMode] = useState<"sample" | "live">("sample");

  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    fetchPhoneNumbersFromSupabase()
      .then((records) => {
        if (!records.length) return;
        setPhoneNumbers(records);
        setDataMode("live");
      })
      .catch(() => setDataMode("sample"));
  }, []);

  return (
    <>
      <PageHeader
        title="Phone & Hours"
        description="Forwarding numbers and weekly schedule"
        actions={<Button size="sm" onClick={() => toast.success("Saved")}>Save</Button>}
      />
      <PageBody>
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base">Phone numbers</CardTitle>
                <Badge variant="outline">{dataMode === "live" ? "Live Supabase" : "Sample"}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Restaurant main line</Label>
                <Input defaultValue={restaurant.phone} />
              </div>
              <div className="space-y-2">
                <Label>AI host numbers</Label>
                <div className="divide-y divide-border rounded-md border border-border">
                  {phoneNumbers.map((record) => (
                    <div key={record.id} className="space-y-2 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-mono text-sm font-medium">{record.phoneNumber}</div>
                          <div className="text-xs text-muted-foreground">{formatForwardingMode(record.forwardingMode)}</div>
                        </div>
                        <Badge variant="outline" className={statusClass(record.forwardingStatus)}>
                          {formatStatus(record.forwardingStatus)}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Main line {record.restaurantMainLine ?? restaurant.phone} forwards to HostLine on overflow.
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                Forwarding setup: <span className="font-medium text-foreground">carrier-level call forwarding</span>. Use unanswered-call forwarding first; port-in can come later.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Business hours</CardTitle></CardHeader>
            <CardContent>
              <div className="divide-y divide-border rounded-md border border-border">
                {days.map((day) => (
                  <div key={day} className="flex items-center justify-between p-3">
                    <div className="w-20 text-sm font-medium">{day}</div>
                    <div className="flex flex-1 items-center justify-end gap-2">
                      <Input
                        className="h-8 w-24"
                        defaultValue={parseHours(restaurant.hours[day]).open}
                        placeholder="Open"
                      />
                      <span className="text-muted-foreground">-</span>
                      <Input
                        className="h-8 w-24"
                        defaultValue={parseHours(restaurant.hours[day]).close}
                        placeholder="Close"
                      />
                      <Switch defaultChecked={!restaurant.hours[day].includes("Closed")} />
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

function formatForwardingMode(mode: string) {
  if (mode === "forward_all") return "Forward all calls";
  if (mode === "after_hours") return "After-hours forwarding";
  if (mode === "port_in") return "Port-in planned";
  return "Forward unanswered calls";
}

function formatStatus(status: string) {
  return status.replace(/_/g, " ");
}

function statusClass(status: string) {
  if (status === "verified") return "border-success/30 bg-success/10 text-success";
  if (status === "needs_attention") return "border-destructive/30 bg-destructive/10 text-destructive";
  if (status === "pending_verification" || status === "partial") return "border-warning/30 bg-warning/10 text-warning";
  return "border-muted-foreground/30 bg-muted text-muted-foreground";
}

function parseHours(value: string) {
  if (value.includes("Closed")) return { close: "", open: "" };
  const match = value.match(/^(.+?)\s+(?:-|[^0-9:APM]+)\s+(.+)$/);
  return {
    close: match?.[2]?.trim() ?? "",
    open: match?.[1]?.trim() ?? value,
  };
}
