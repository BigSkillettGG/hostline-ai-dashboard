import { useMemo, useState } from "react";
import { PageHeader, PageBody } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { calls } from "@/data/mock";
import { formatTime } from "@/lib/format";
import { AlertTriangle, Mail, MessageSquareText, ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

type TabKey = "all" | "complaint" | "sales" | "pending";

export default function Escalations() {
  const [tab, setTab] = useState<TabKey>("all");

  const escalated = useMemo(
    () => calls.filter((c) => c.escalation).sort((a, b) => b.time.localeCompare(a.time)),
    []
  );

  const filtered = escalated.filter((c) => {
    const e = c.escalation!;
    if (tab === "complaint") return e.type === "complaint";
    if (tab === "sales") return e.type === "sales";
    if (tab === "pending") return e.status === "pending_callback";
    return true;
  });

  const counts = {
    all: escalated.length,
    complaint: escalated.filter((c) => c.escalation!.type === "complaint").length,
    sales: escalated.filter((c) => c.escalation!.type === "sales").length,
    pending: escalated.filter((c) => c.escalation!.status === "pending_callback").length,
  };

  return (
    <>
      <PageHeader
        title="Escalations"
        description="Customer complaints and sales/vendor calls handed off to a manager"
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to="/app/settings/alerts"><ShieldAlert className="mr-1.5 h-3.5 w-3.5" />Alert routing</Link>
          </Button>
        }
      />
      <PageBody className="space-y-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
          <TabsList>
            <TabsTrigger value="all">All <span className="ml-1.5 text-muted-foreground tabular-nums">{counts.all}</span></TabsTrigger>
            <TabsTrigger value="complaint">Complaints <span className="ml-1.5 text-muted-foreground tabular-nums">{counts.complaint}</span></TabsTrigger>
            <TabsTrigger value="sales">Sales / Vendor <span className="ml-1.5 text-muted-foreground tabular-nums">{counts.sales}</span></TabsTrigger>
            <TabsTrigger value="pending">Awaiting callback <span className="ml-1.5 text-muted-foreground tabular-nums">{counts.pending}</span></TabsTrigger>
          </TabsList>
        </Tabs>

        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>Time</TableHead>
                <TableHead>Caller</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Summary</TableHead>
                <TableHead>Alerted</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-32 text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={8} className="py-12 text-center">
                  <AlertTriangle className="mx-auto h-8 w-8 text-muted-foreground/50" />
                  <p className="mt-2 text-sm font-medium">No escalations yet</p>
                  <p className="text-xs text-muted-foreground">When the AI host hands a caller off, it'll show up here.</p>
                </TableCell></TableRow>
              )}
              {filtered.map((c) => {
                const e = c.escalation!;
                return (
                  <TableRow key={c.id}>
                    <TableCell className="text-xs text-muted-foreground tabular-nums">{formatTime(c.time)}</TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{c.caller}</div>
                      <div className="text-xs text-muted-foreground tabular-nums">{c.phone}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={e.type === "complaint" ? "bg-destructive/10 text-destructive border-destructive/20" : "bg-warning/15 text-warning border-warning/20"}>
                        {e.type === "complaint" ? "Complaint" : "Sales / vendor"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs capitalize text-muted-foreground">{e.severity ?? "—"}</TableCell>
                    <TableCell className="max-w-xs">
                      <p className="text-sm line-clamp-2">{e.summary}</p>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        {e.channels.includes("sms") && <MessageSquareText className="h-3 w-3" />}
                        {e.channels.includes("email") && <Mail className="h-3 w-3" />}
                        <span>{e.alertedTo[0]}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={e.status === "callback_made" ? "bg-success/15 text-success border-success/20" : e.status === "closed" ? "bg-muted text-muted-foreground" : "bg-warning/15 text-warning border-warning/20"}>
                        {e.status.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {e.status !== "callback_made" ? (
                        <Button size="sm" variant="outline" onClick={() => toast.success("Marked as callback made")}>Mark done</Button>
                      ) : (
                        <Button size="sm" variant="ghost" asChild><Link to={`/app/calls?id=${c.id}`}>View</Link></Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </PageBody>
    </>
  );
}
