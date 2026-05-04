import { useState } from "react";
import { PageHeader, PageBody } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { reservations as seed, type Reservation } from "@/data/mock";
import { AlertTriangle, Check, Clock, X, CalendarDays } from "lucide-react";
import { toast } from "sonner";

export default function Reservations() {
  const [list, setList] = useState<Reservation[]>(seed);
  const confirmed = list.filter(r => !r.manual);
  const manual = list.filter(r => r.manual);

  const updateStatus = (id: string, status: Reservation["status"]) => {
    setList(rs => rs.map(r => r.id === id ? { ...r, status, manual: status === "confirmed" ? false : r.manual } : r));
    toast.success(`Reservation ${status}`);
  };

  const renderTable = (rows: Reservation[], includeActions = false) => (
    <Card className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead>Guest</TableHead>
            <TableHead>Party</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Time</TableHead>
            <TableHead>Notes</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Status</TableHead>
            {includeActions && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow><TableCell colSpan={includeActions ? 8 : 7} className="py-12 text-center">
              <CalendarDays className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="mt-2 text-sm font-medium">No reservations</p>
            </TableCell></TableRow>
          )}
          {rows.map(r => (
            <TableRow key={r.id}>
              <TableCell>
                <div className="font-medium">{r.guest}</div>
                <div className="text-xs text-muted-foreground tabular-nums">{r.phone}</div>
              </TableCell>
              <TableCell className="tabular-nums">{r.partySize}</TableCell>
              <TableCell className="text-sm tabular-nums">{r.date}</TableCell>
              <TableCell className="text-sm tabular-nums">{r.time}</TableCell>
              <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{r.notes || "—"}</TableCell>
              <TableCell><Badge variant="secondary" className="text-[11px] capitalize">{r.source.replace(/_/g, " ")}</Badge></TableCell>
              <TableCell>
                <Badge variant="outline" className={
                  r.status === "confirmed" ? "border-success/20 bg-success/10 text-success" :
                  r.status === "pending" ? "border-warning/20 bg-warning/10 text-warning" :
                  r.status === "seated" ? "border-info/20 bg-info/10 text-info" :
                  "border-destructive/20 bg-destructive/10 text-destructive"
                }>{r.status}</Badge>
              </TableCell>
              {includeActions && (
                <TableCell className="text-right">
                  <div className="inline-flex gap-1">
                    <Button size="sm" variant="outline" className="h-7" onClick={() => updateStatus(r.id, "confirmed")}>
                      <Check className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="outline" className="h-7" onClick={() => toast("Suggested alternative time")}>
                      <Clock className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-destructive" onClick={() => updateStatus(r.id, "declined")}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );

  return (
    <>
      <PageHeader
        title="Reservations"
        description="Confirmed bookings and manual requests"
        actions={<Button size="sm">Add reservation</Button>}
      />
      <PageBody>
        <Tabs defaultValue="confirmed">
          <TabsList>
            <TabsTrigger value="confirmed">Confirmed <Badge variant="secondary" className="ml-2 h-4 text-[10px]">{confirmed.length}</Badge></TabsTrigger>
            <TabsTrigger value="manual">Manual requests <Badge variant="secondary" className="ml-2 h-4 text-[10px] bg-warning/15 text-warning">{manual.length}</Badge></TabsTrigger>
          </TabsList>

          <TabsContent value="confirmed" className="mt-4">
            {renderTable(confirmed)}
          </TabsContent>

          <TabsContent value="manual" className="mt-4 space-y-3">
            <div className="flex items-start gap-3 rounded-md border border-warning/30 bg-warning/10 px-4 py-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-warning shrink-0" />
              <div className="text-sm">
                <div className="font-medium text-warning-foreground">Staff confirmation required</div>
                <div className="text-muted-foreground text-xs">
                  These requests came in through the AI host but need a person to confirm — usually large parties, special occasions, or out-of-policy requests.
                </div>
              </div>
            </div>
            {renderTable(manual, true)}
          </TabsContent>
        </Tabs>
      </PageBody>
    </>
  );
}
