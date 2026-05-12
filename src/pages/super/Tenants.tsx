import { useState } from "react";
import { PageHeader, PageBody } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { tenants } from "@/data/tenants";
import { Search } from "lucide-react";
import { toast } from "sonner";

export default function SuperTenants() {
  const [q, setQ] = useState("");
  const filtered = tenants.filter((t) =>
    [t.name, t.city, t.ownerEmail].some((s) => s.toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <>
      <PageHeader title="Tenants" description="All restaurants on SignalHost" />
      <PageBody>
        <div className="mb-3 flex items-center gap-2">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search restaurants…" className="h-9 pl-8" />
          </div>
        </div>
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium">Restaurant</th>
                    <th className="px-4 py-2.5 text-left font-medium">Plan</th>
                    <th className="px-4 py-2.5 text-right font-medium">Usage</th>
                    <th className="px-4 py-2.5 text-left font-medium">AI number</th>
                    <th className="px-4 py-2.5 text-left font-medium">Status</th>
                    <th className="px-4 py-2.5 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((t) => (
                    <tr key={t.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="font-medium">{t.name}</div>
                        <div className="text-xs text-muted-foreground">{t.city} · {t.ownerEmail}</div>
                      </td>
                      <td className="px-4 py-3">{t.plan}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {t.callsThisMonth.toLocaleString()} / {t.includedCalls.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{t.aiNumber}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={
                          t.status === "healthy" ? "border-success/30 bg-success/10 text-success"
                          : t.status === "attention" ? "border-warning/30 bg-warning/10 text-warning"
                          : "border-destructive/30 bg-destructive/10 text-destructive"
                        }>{t.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" variant="outline" onClick={() => toast.success(`Impersonating ${t.name}`)}>Impersonate</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
