import { PageHeader, PageBody } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { tenants } from "@/data/tenants";
import { toast } from "sonner";

export default function Telephony() {
  return (
    <>
      <PageHeader title="Telephony" description="Twilio numbers, port-in queue, SIP routing" actions={<Button size="sm" onClick={() => toast.success("Provisioning new number…")}>Provision number</Button>} />
      <PageBody>
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">AI host numbers</CardTitle></CardHeader>
            <CardContent>
              <div className="divide-y divide-border rounded-md border border-border">
                {tenants.map((t) => (
                  <div key={t.id} className="flex items-center justify-between p-3">
                    <div>
                      <div className="text-sm font-medium">{t.name}</div>
                      <div className="font-mono text-xs text-muted-foreground">{t.aiNumber}</div>
                    </div>
                    <Badge variant="outline" className="border-success/30 bg-success/10 text-success">Active</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Port-in queue</CardTitle></CardHeader>
            <CardContent>
              <div className="divide-y divide-border rounded-md border border-border">
                <div className="flex items-center justify-between p-3">
                  <div>
                    <div className="text-sm font-medium">Bodega Azul</div>
                    <div className="font-mono text-xs text-muted-foreground">+1 (512) 555-2034</div>
                  </div>
                  <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning">Pending LOA</Badge>
                </div>
                <div className="flex items-center justify-between p-3">
                  <div>
                    <div className="text-sm font-medium">Carbone & Fig</div>
                    <div className="font-mono text-xs text-muted-foreground">+1 (312) 555-9921</div>
                  </div>
                  <Badge variant="outline" className="border-info/30 bg-info/10 text-info">FOC scheduled</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="pb-3"><CardTitle className="text-base">Webhook health (last 24h)</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { name: "voice/incoming", success: "99.8%", p95: "210 ms" },
                  { name: "voice/conversation-relay", success: "99.4%", p95: "320 ms" },
                  { name: "orders/dispatch", success: "100%", p95: "180 ms" },
                ].map((w) => (
                  <div key={w.name} className="rounded-md border border-border p-3">
                    <div className="font-mono text-xs text-muted-foreground">{w.name}</div>
                    <div className="mt-1 text-lg font-semibold tabular-nums">{w.success}</div>
                    <div className="text-xs text-muted-foreground">p95 {w.p95}</div>
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
