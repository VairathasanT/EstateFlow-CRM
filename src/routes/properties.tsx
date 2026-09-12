import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/auth";
import { Protected } from "@/components/Protected";
import { PageHeader } from "@/components/AppLayout";
import { EmptyState, QueryBoundary } from "@/components/StateBlocks";
import { Field } from "@/routes/leads.index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  UNIT_STATUSES,
  UNIT_STATUS_LABEL,
  UNIT_STATUS_TONE,
  UNIT_TYPES,
  formatMoney,
  friendlyError,
  todayISO,
} from "@/lib/crm";
import type { UnitStatus } from "@/lib/crm";

export const Route = createFileRoute("/properties")({
  head: () => ({
    meta: [
      { title: "Properties — Estate CRM" },
      { name: "description", content: "Projects, buildings and unit inventory with live availability and pricing." },
      { property: "og:title", content: "Properties — Estate CRM" },
      { property: "og:description", content: "Projects, buildings and units with live availability and pricing." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <Protected>
      <PropertiesPage />
    </Protected>
  ),
});

type UnitRow = {
  id: string;
  unit_number: string;
  unit_type: string;
  area_sqft: number | null;
  price: number;
  status: UnitStatus;
  building_id: string;
};

function PropertiesPage() {
  const { data: me } = useCurrentUser();
  const [status, setStatus] = useState<string>("all");
  const [type, setType] = useState<string>("all");
  const [bookUnit, setBookUnit] = useState<UnitRow | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editUnit, setEditUnit] = useState<UnitRow | null>(null);

  const inventory = useQuery({
    queryKey: ["inventory"],
    queryFn: async () => {
      const [projects, buildings, units] = await Promise.all([
        supabase.from("projects").select("id, name, location, description").order("name"),
        supabase.from("buildings").select("id, project_id, name, floors").order("name"),
        supabase
          .from("units")
          .select("id, building_id, unit_number, unit_type, area_sqft, price, status")
          .order("unit_number"),
      ]);
      if (projects.error) throw projects.error;
      if (buildings.error) throw buildings.error;
      if (units.error) throw units.error;
      return { projects: projects.data, buildings: buildings.data, units: units.data as UnitRow[] };
    },
  });

  const visibleUnits = useMemo(
    () =>
      (inventory.data?.units ?? []).filter(
        (u) => (status === "all" || u.status === status) && (type === "all" || u.unit_type === type),
      ),
    [inventory.data, status, type],
  );

  return (
    <>
      <PageHeader
        title="Properties"
        description="Projects, buildings and unit availability."
        action={
          me?.isAdmin ? (
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Add unit
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {UNIT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {UNIT_STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All unit types</SelectItem>
            {UNIT_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <QueryBoundary
        isLoading={inventory.isLoading}
        error={inventory.error}
        isEmpty={(inventory.data?.projects ?? []).length === 0}
        onRetry={() => inventory.refetch()}
        empty={
          <Card>
            <EmptyState title="No properties yet" description="An administrator can add projects, buildings and units." />
          </Card>
        }
      >
        <div className="space-y-6">
          {(inventory.data?.projects ?? []).map((project) => {
            const buildings = (inventory.data?.buildings ?? []).filter((b) => b.project_id === project.id);
            return (
              <Card key={project.id}>
                <CardHeader>
                  <CardTitle className="text-base">
                    {project.name}
                    <span className="ml-2 text-sm font-normal text-muted-foreground">{project.location}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  {buildings.map((building) => {
                    const units = visibleUnits.filter((u) => u.building_id === building.id);
                    return (
                      <div key={building.id}>
                        <p className="mb-2 text-sm font-medium">
                          {building.name} · {building.floors} floors
                        </p>
                        {units.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No units match the filters.</p>
                        ) : (
                          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                            {units.map((unit) => (
                              <div key={unit.id} className="rounded-xl border border-border p-3">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="font-medium">{unit.unit_number}</p>
                                  <Badge variant="secondary" className={UNIT_STATUS_TONE[unit.status]}>
                                    {UNIT_STATUS_LABEL[unit.status]}
                                  </Badge>
                                </div>
                                <p className="mt-1 text-sm text-muted-foreground">
                                  {unit.unit_type} · {unit.area_sqft ?? "—"} sq ft
                                </p>
                                <p className="mt-1 font-display text-sm font-semibold">{formatMoney(unit.price)}</p>
                                <div className="mt-3 flex gap-2">
                                  {unit.status === "available" ? (
                                    <Button size="sm" variant="outline" className="flex-1" onClick={() => setBookUnit(unit)}>
                                      Book this unit
                                    </Button>
                                  ) : null}
                                  {me?.isAdmin ? (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className={unit.status === "available" ? "" : "flex-1"}
                                      onClick={() => setEditUnit(unit)}
                                    >
                                      <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                                    </Button>
                                  ) : null}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {buildings.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No buildings in this project yet.</p>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </QueryBoundary>

      <BookUnitDialog unit={bookUnit} onClose={() => setBookUnit(null)} />
      {me?.isAdmin ? (
        <>
          <AddUnitDialog
            open={addOpen}
            onOpenChange={setAddOpen}
            buildings={inventory.data?.buildings ?? []}
          />
          <EditUnitDialog unit={editUnit} onClose={() => setEditUnit(null)} />
        </>
      ) : null}
    </>
  );
}

function BookUnitDialog({ unit, onClose }: { unit: UnitRow | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [leadId, setLeadId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const leads = useQuery({
    queryKey: ["bookable-leads"],
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from("leads")
        .select("id, name, stage")
        .neq("stage", "booked")
        .neq("stage", "lost")
        .order("name");
      if (err) throw err;
      return data;
    },
  });

  const book = useMutation({
    mutationFn: async () => {
      if (!unit) return;
      if (!leadId) throw new Error("Choose the lead this unit is booked for.");
      const value = amount ? Number(amount) : unit.price;
      if (!(value > 0)) throw new Error("Booking amount must be greater than zero.");
      const { error: err } = await supabase.rpc("create_booking", {
        p_lead_id: leadId,
        p_unit_id: unit.id,
        p_amount: value,
        p_booking_date: date,
        ...(notes.trim() ? { p_notes: notes.trim() } : {}),
      });
      if (err) throw err;
    },
    onSuccess: () => {
      toast.success("Booking confirmed");
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setError(null);
      setLeadId("");
      setAmount("");
      setNotes("");
      onClose();
    },
    onError: (err) => setError(friendlyError(err)),
  });

  return (
    <Dialog open={Boolean(unit)} onOpenChange={(v) => (v ? null : onClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Book unit {unit?.unit_number}</DialogTitle>
          <DialogDescription>
            The unit is reserved atomically — if someone books it first, this will be rejected.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Lead">
            <Select value={leadId} onValueChange={setLeadId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a lead" />
              </SelectTrigger>
              <SelectContent>
                {(leads.data ?? []).map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Amount (₹)">
            <Input
              type="number"
              min="1"
              placeholder={unit ? String(unit.price) : ""}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
          <Field label="Booking date">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Notes">
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
          </Field>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => book.mutate()} disabled={book.isPending}>
            {book.isPending ? "Booking…" : "Confirm booking"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddUnitDialog({
  open,
  onOpenChange,
  buildings,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  buildings: { id: string; name: string }[];
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ building_id: "", unit_number: "", unit_type: "2BHK", area: "", price: "" });
  const [error, setError] = useState<string | null>(null);

  const add = useMutation({
    mutationFn: async () => {
      if (!form.building_id) throw new Error("Choose a building.");
      if (!form.unit_number.trim()) throw new Error("Unit number is required.");
      if (!(Number(form.price) > 0)) throw new Error("Price must be greater than zero.");
      const { error: err } = await supabase.from("units").insert({
        building_id: form.building_id,
        unit_number: form.unit_number.trim(),
        unit_type: form.unit_type,
        ...(form.area ? { area_sqft: Number(form.area) } : {}),
        price: Number(form.price),
        status: "available",
      });
      if (err) throw err;
    },
    onSuccess: () => {
      toast.success("Unit added");
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      onOpenChange(false);
      setError(null);
    },
    onError: (err) => setError(friendlyError(err)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add unit</DialogTitle>
          <DialogDescription>Add inventory to an existing building.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Building">
            <Select value={form.building_id} onValueChange={(v) => setForm({ ...form, building_id: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Select a building" />
              </SelectTrigger>
              <SelectContent>
                {buildings.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Unit number">
            <Input value={form.unit_number} onChange={(e) => setForm({ ...form, unit_number: e.target.value })} />
          </Field>
          <Field label="Unit type">
            <Select value={form.unit_type} onValueChange={(v) => setForm({ ...form, unit_type: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UNIT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Area (sq ft)">
            <Input type="number" min="0" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} />
          </Field>
          <Field label="Price (₹)">
            <Input type="number" min="1" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          </Field>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => add.mutate()} disabled={add.isPending}>
            {add.isPending ? "Saving…" : "Add unit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
