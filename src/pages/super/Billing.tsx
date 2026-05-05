import { PageHeader, PageBody } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { tenants } from "@/data/tenants";
import { toast } from "sonner";

export default function SuperBilling() {
  const mrr = tenants.reduce((s, t) => s + t.mrrCents, 0) / 100;
  return (
    <>
      <PageHeader title="Billing" description="Plans, usage, manual credits" />
      <PageBody>
        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">MRR</div><div className="mt-1 text-2xl font-semibold tabular-nums">${mrr.toLocaleString()}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">ARR (run-rate)</div><div className="mt-1 text-2xl font-semibold tabular-nums">${(mrr * 12).toLocaleString()}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Tenants over plan</div><div className="mt-1 text-2xl font-semibold tabular-nums">{tenants.filter(t => t.callsThisMonth > t.includedCalls).length}</div></CardContent></Card>
        </div>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Tenant usage</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-y border-border bg-muted/30 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium">Restaurant</th>
                    <th className="px-4 py-2.5 text-left font-medium">Plan</th>
                    <th className="px-4 py-2.5 text-right font-medium">Calls / Included</th>
                    <th className="px-4 py-2.5 text-right font-medium">MRR</th>
                    <th className="px-4 py-2.5 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {tenants.map((t) => {
                    const over = t.callsThisMonth > t.includedCalls;
                    return (
                      <tr key={t.id}>
                        <td className="px-4 py-3 font-medium">{t.name}</td>
                        <td className="px-4 py-3"><Badge variant="outline">{t.plan}</Badge></td>
                        <td className={`px-4 py-3 text-right tabular-nums ${over ? "text-destructive font-medium" : ""}`}>
                          {t.callsThisMonth.toLocaleString()} / {t.includedCalls.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">${(t.mrrCents / 100).toFixed(2)}</td>
                        <td className="px-4 py-3 text-right">
                          <Button size="sm" variant="outline" onClick={() => toast.success(`Credit issued to ${t.name}`)}>Issue credit</Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
