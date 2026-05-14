import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader, PageBody } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { reservations as seed, type Reservation, type ReservationStatus } from "@/data/mock";
import {
  AlertTriangle,
  CalendarDays,
  CalendarPlus,
  Check,
  Clock,
  RefreshCw,
  Utensils,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  createReservationInSupabase,
  fetchReservationsFromSupabase,
  isReservationPersistenceConfigured,
  type CreateReservationInput,
  updateReservationStatusInSupabase,
} from "@/lib/supabase-rest";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ReservationTab = "confirmed" | "requests" | "all";

const emptyReservationForm: CreateReservationInput = {
  date: getTodayDate(),
  guest: "",
  notes: "",
  partySize: 2,
  phone: "",
  provider: "",
  source: "ai_host",
  status: "pending",
  time: "19:00",
};

export default function Reservations() {
  const queryClient = useQueryClient();
  const [sampleReservations, setSampleReservations] = useState<Reservation[]>(seed);
  const [tab, setTab] = useState<ReservationTab>("requests");
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<CreateReservationInput>(emptyReservationForm);
  const reservationPersistenceConfigured = isReservationPersistenceConfigured();
  const reservationQuery = useQuery({
    enabled: reservationPersistenceConfigured,
    queryFn: fetchReservationsFromSupabase,
    queryKey: ["reservations", "supabase"],
    refetchInterval: 30_000,
  });
  const usingSupabase = Boolean(reservationPersistenceConfigured && reservationQuery.isSuccess);
  const reservations = usingSupabase ? (reservationQuery.data ?? []) : sampleReservations;

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ReservationStatus }) =>
      updateReservationStatusInSupabase(id, status),
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Reservation update failed.");
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["reservations", "supabase"] });
      toast.success("Reservation updated.");
    },
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateReservationInput) => createReservationInSupabase(input),
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Reservation creation failed.");
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["reservations", "supabase"] });
      setAddOpen(false);
      setForm(emptyReservationForm);
      toast.success("Reservation saved.");
    },
  });

  const requests = reservations.filter(isManualRequest);
  const confirmed = reservations.filter((reservation) => !isManualRequest(reservation) && reservation.status !== "declined");

  const updateStatus = (id: string, status: ReservationStatus) => {
    if (usingSupabase) {
      statusMutation.mutate({ id, status });
      return;
    }

    setSampleReservations((currentReservations) =>
      currentReservations.map((reservation) =>
        reservation.id === id
          ? {
              ...reservation,
              manual: status === "pending",
              status,
            }
          : reservation,
      ),
    );
    toast.success("Reservation updated.");
  };

  const createReservation = () => {
    const validationError = validateReservationForm(form);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const input: CreateReservationInput = {
      ...form,
      guest: form.guest.trim(),
      manual: form.status === "pending",
      notes: form.notes?.trim(),
      phone: form.phone?.trim(),
      provider: form.provider?.trim() || undefined,
    };

    if (usingSupabase) {
      createMutation.mutate(input);
      return;
    }

    setSampleReservations((currentReservations) => [
      {
        date: input.date,
        guest: input.guest,
        id: crypto.randomUUID(),
        manual: input.status === "pending",
        notes: input.notes || undefined,
        partySize: input.partySize,
        phone: input.phone || "Unknown",
        provider: input.provider,
        source: input.source ?? "ai_host",
        status: input.status ?? "pending",
        time: input.time,
      },
      ...currentReservations,
    ]);
    setAddOpen(false);
    setForm(emptyReservationForm);
    toast.success("Reservation saved locally.");
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
            <TableRow>
              <TableCell colSpan={includeActions ? 8 : 7} className="py-12 text-center">
                <CalendarDays className="mx-auto h-8 w-8 text-muted-foreground/50" />
                <p className="mt-2 text-sm font-medium">No reservations</p>
              </TableCell>
            </TableRow>
          )}
          {rows.map((reservation) => (
            <TableRow key={reservation.id}>
              <TableCell>
                <div className="font-medium">{reservation.guest}</div>
                <div className="text-xs text-muted-foreground tabular-nums">{reservation.phone}</div>
              </TableCell>
              <TableCell className="tabular-nums">{reservation.partySize}</TableCell>
              <TableCell className="text-sm tabular-nums">{reservation.date}</TableCell>
              <TableCell className="text-sm tabular-nums">{reservation.time}</TableCell>
              <TableCell className="max-w-xs truncate text-sm text-muted-foreground">{reservation.notes || "-"}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary" className="text-[11px] capitalize">
                    {reservation.source.replace(/_/g, " ")}
                  </Badge>
                  {reservation.provider && (
                    <Badge variant="outline" className="text-[11px] capitalize">
                      {formatProvider(reservation.provider)}
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={statusBadgeClass(reservation.status)}>
                  {reservation.status}
                </Badge>
              </TableCell>
              {includeActions && (
                <TableCell className="text-right">
                  <div className="inline-flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7"
                      disabled={statusMutation.isPending}
                      onClick={() => updateStatus(reservation.id, "confirmed")}
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7"
                      onClick={() => toast("Alternative-time workflow is queued for the staff notification slice.")}
                    >
                      <Clock className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-destructive"
                      disabled={statusMutation.isPending}
                      onClick={() => updateStatus(reservation.id, "declined")}
                    >
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
        description={`${requests.length} staff request${requests.length === 1 ? "" : "s"} / ${confirmed.length} confirmed or seated`}
        actions={
          <>
            <Badge
              variant="outline"
              className={usingSupabase ? "border-success/20 bg-success/10 text-success" : "bg-muted text-muted-foreground"}
            >
              {usingSupabase ? "Live Supabase" : "Sample data"}
            </Badge>
            {reservationPersistenceConfigured && (
              <Button variant="outline" size="sm" onClick={() => reservationQuery.refetch()} disabled={reservationQuery.isFetching}>
                <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${reservationQuery.isFetching ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            )}
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <CalendarPlus className="mr-1.5 h-3.5 w-3.5" />
              Add reservation
            </Button>
          </>
        }
      />
      <PageBody>
        <div className="mb-4 grid gap-3 lg:grid-cols-3">
          <Card className="p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Manual requests</div>
            <div className="mt-2 text-3xl font-semibold tabular-nums">{requests.length}</div>
            <div className="mt-1 text-xs text-muted-foreground">SignalHost-captured requests waiting on staff confirmation.</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Confirmed</div>
            <div className="mt-2 text-3xl font-semibold tabular-nums">{confirmed.length}</div>
            <div className="mt-1 text-xs text-muted-foreground">Bookings staff can trust operationally.</div>
          </Card>
          <Card className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Utensils className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-semibold">OpenTable path</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Staff-confirmed requests are saved now. OpenTable is the preferred first live-availability integration once API access is approved.
                </div>
              </div>
            </div>
          </Card>
        </div>

        {reservationQuery.isError && (
          <Card className="mb-4 border-warning/30 bg-warning/10 p-3 text-sm text-muted-foreground">
            Supabase reservations could not be loaded, so this page is showing sample data.{" "}
            {reservationQuery.error instanceof Error ? reservationQuery.error.message : ""}
          </Card>
        )}
        {!reservationPersistenceConfigured && (
          <Card className="mb-4 border-dashed bg-muted/20 p-3 text-sm text-muted-foreground">
            Set VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, and VITE_SUPABASE_DEMO_LOCATION_ID to show live reservations.
          </Card>
        )}

        <Tabs value={tab} onValueChange={(value) => setTab(value as ReservationTab)}>
          <TabsList>
            <TabsTrigger value="requests">
              Manual requests
              <Badge variant="secondary" className="ml-2 h-4 bg-warning/15 text-[10px] text-warning">
                {requests.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="confirmed">
              Confirmed
              <Badge variant="secondary" className="ml-2 h-4 text-[10px]">
                {confirmed.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="all">
              All
              <Badge variant="secondary" className="ml-2 h-4 text-[10px]">
                {reservations.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="requests" className="mt-4 space-y-3">
            <div className="flex items-start gap-3 rounded-md border border-warning/30 bg-warning/10 px-4 py-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <div className="text-sm">
                <div className="font-medium text-warning-foreground">Staff confirmation required</div>
                <div className="text-xs text-muted-foreground">
                  These requests came in through SignalHost but are not confirmed until a person approves them.
                </div>
              </div>
            </div>
            {renderTable(requests, true)}
          </TabsContent>

          <TabsContent value="confirmed" className="mt-4">
            {renderTable(confirmed)}
          </TabsContent>

          <TabsContent value="all" className="mt-4">
            {renderTable(reservations)}
          </TabsContent>
        </Tabs>
      </PageBody>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add reservation</DialogTitle>
            <DialogDescription>
              Create a confirmed booking or a staff-confirmed request captured outside the live voice flow.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Guest name</Label>
              <Input value={form.guest} onChange={(event) => setForm({ ...form, guest: event.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Party size</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={form.partySize}
                onChange={(event) => setForm({ ...form, partySize: Number(event.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(value) => setForm({ ...form, status: value as ReservationStatus })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending staff confirmation</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="seated">Seated</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Time</Label>
              <Input type="time" value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Source</Label>
              <Select
                value={form.source}
                onValueChange={(value) => setForm({ ...form, source: value as Reservation["source"] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ai_host">SignalHost</SelectItem>
                  <SelectItem value="web">Web</SelectItem>
                  <SelectItem value="walk_in">Walk-in</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Provider</Label>
              <Select
                value={form.provider || "none"}
                onValueChange={(value) => setForm({ ...form, provider: value === "none" ? "" : value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Manual</SelectItem>
                  <SelectItem value="opentable">OpenTable</SelectItem>
                  <SelectItem value="yelp">Yelp Guest Manager</SelectItem>
                  <SelectItem value="sevenrooms">SevenRooms</SelectItem>
                  <SelectItem value="resy">Resy</SelectItem>
                  <SelectItem value="tock">Tock</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Notes</Label>
              <Textarea
                rows={3}
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                placeholder="Birthday, high chair, patio request, allergy note..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createReservation} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Saving..." : "Save reservation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function isManualRequest(reservation: Reservation) {
  return reservation.manual || reservation.status === "pending";
}

function statusBadgeClass(status: ReservationStatus) {
  if (status === "confirmed") return "border-success/20 bg-success/10 text-success";
  if (status === "pending") return "border-warning/20 bg-warning/10 text-warning";
  if (status === "seated") return "border-info/20 bg-info/10 text-info";
  if (status === "canceled") return "border-muted-foreground/20 bg-muted text-muted-foreground";
  return "border-destructive/20 bg-destructive/10 text-destructive";
}

function formatProvider(provider: string) {
  const labels: Record<string, string> = {
    opentable: "OpenTable",
    resy: "Resy",
    sevenrooms: "SevenRooms",
    tock: "Tock",
    yelp: "Yelp",
  };
  return labels[provider] ?? provider;
}

function validateReservationForm(form: CreateReservationInput) {
  if (!form.guest.trim()) return "Guest name is required.";
  if (!form.date) return "Date is required.";
  if (!form.time) return "Time is required.";
  if (!Number.isFinite(form.partySize) || form.partySize < 1) return "Party size must be at least 1.";
  return null;
}

function getTodayDate() {
  const date = new Date();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
