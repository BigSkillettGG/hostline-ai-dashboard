import { PageHeader, PageBody } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Link } from "react-router-dom";

export default function Billing() {
  const used = 612;
  const included = 800;
  return (
    <>
      <PageHeader title="Billing" description="Plan, usage, and invoices" />
      <PageBody>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Current plan</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-semibold">Growth</div>
                  <div className="text-sm text-muted-foreground">$249 / mo · billed monthly</div>
                </div>
                <Badge>Active</Badge>
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span>Calls this month</span>
                  <span className="tabular-nums text-muted-foreground">{used.toLocaleString()} / {included.toLocaleString()}</span>
                </div>
                <Progress value={(used / included) * 100} />
                <div className="mt-2 text-xs text-muted-foreground">Overage: $0.40 / call after {included.toLocaleString()}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm"><Link to="/pricing">Change plan</Link></Button>
                <Button variant="outline" size="sm">Update payment method</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Invoices</CardTitle></CardHeader>
            <CardContent>
              <div className="divide-y divide-border rounded-md border border-border">
                {[
                  { d: "Apr 1, 2026", amt: "$249.00" },
                  { d: "Mar 1, 2026", amt: "$249.00" },
                  { d: "Feb 1, 2026", amt: "$229.00" },
                ].map((i) => (
                  <div key={i.d} className="flex items-center justify-between p-3 text-sm">
                    <span>{i.d}</span>
                    <span className="tabular-nums">{i.amt}</span>
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
