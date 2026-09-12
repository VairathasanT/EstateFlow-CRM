import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Pencil } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/auth";
import { Protected } from "@/components/Protected";
import { PageHeader } from "@/components/AppLayout";
import { QueryBoundary } from "@/components/StateBlocks";
import { Field, usePeople } from "@/routes/leads.index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  LEAD_SOURCES,
  LEAD_STAGES,
  SOURCE_LABEL,
  STAGE_LABEL,
  STAGE_TONE,
  formatDate,
  formatMoney,
  friendlyError,
  todayISO,
} from "@/lib/crm";
import type { LeadStage } from "@/lib/crm";

export const Route = createFileRoute("/leads/$leadId")({
  head: () => ({
    meta: [
      { title: "Lead details — Estate CRM" },
      { name: "description", content: "Lead profile, notes, follow-ups, stage history and booking." },
      { property: "og:title", content: "Lead details — Estate CRM" },
      { property: "og:description", content: "Lead profile, notes, follow-ups and booking." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <Protected>
      <LeadDetail />
    </Protected>
  ),
});

function LeadDetail() {
  const { leadId } = Route.useParams();
  const queryClient = useQueryClient();
  const { data: me } = useCurrentUser();
  const people = usePeople();

  const lead = useQuery({
    queryKey: ["lead", leadId],
    queryFn: async () => {
      const { data, error } = await supabase.from("leads").select("*").eq("id", leadId).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Lead not found or you don't have access to it.");
      return data;
    },
  });

  const notes = useQuery({
    queryKey: ["lead-notes", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_notes")
        .select("id, body, created_at, author_id")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const booking = useQuery({
    queryKey: ["lead-booking", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("id, amount, booking_date, status, units(unit_number, unit_type, buildings(name))")
        .eq("lead_id", leadId)
        .eq("status", "active")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [note, setNote] = useState("");
  const [editOpen, setEditOpen] = useState(false);

  const update = useMutation({
    mutationFn: async (patch: {
      stage?: LeadStage;
      follow_up_date?: string | null;
      budget?: number | null;
      assigned_to?: string | null;
    }) => {
      const { error } = await supabase.from("leads").update(patch).eq("id", leadId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lead updated");
      queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err) => toast.error(friendlyError(err)),
  });

  const addNote = useMutation({
    mutationFn: async () => {
      if (note.trim().length < 2) throw new Error("Write a note first.");
      const { error } = await supabase
        .from("lead_notes")
        .insert({ lead_id: leadId, body: note.trim(), author_id: me?.id ?? null });
      if (error) throw error;
    },
    onSuccess: () => {
      setNote("");
      queryClient.invalidateQueries({ queryKey: ["lead-notes", leadId] });
    },
    onError: (err) => toast.error(friendlyError(err)),
  });

  const l = lead.data;

  return (
    <>
      <Link to="/leads" className="mb-3 inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1 h-4 w-4" /> All leads
      </Link>
      <QueryBoundary isLoading={lead.isLoading} error={lead.error} onRetry={() => lead.refetch()}>
        {l ? (
          <>
            <PageHeader
              title={l.name}
              description={`${l.phone ?? "—"} · ${l.email ?? "—"} · ${SOURCE_LABEL[l.source ?? ""] ?? "—"}`}
              action={
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className={STAGE_TONE[l.stage as LeadStage]}>
                    {STAGE_LABEL[l.stage as LeadStage]}
                  </Badge>
                  <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit details
                  </Button>
                </div>
              }
            />
            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">Pipeline</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <Field label="Stage">
                    <Select
                      value={l.stage}
                      onValueChange={(v) => update.mutate({ stage: v as LeadStage })}
                      disabled={l.stage === "booked"}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LEAD_STAGES.map((s) => (
                          <SelectItem key={s} value={s} disabled={s === "booked"}>
                            {STAGE_LABEL[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Follow-up date">
                    <Input
                      type="date"
                      defaultValue={l.follow_up_date ?? ""}
                      min={todayISO()}
                      onChange={(e) => update.mutate({ follow_up_date: e.target.value || null })}
                    />
                  </Field>
                  <Field label="Budget">
                    <Input
                      type="number"
                      min="0"
                      defaultValue={l.budget ?? ""}
                      onBlur={(e) =>
                        update.mutate({ budget: e.target.value ? Number(e.target.value) : null })
                      }
                    />
                  </Field>
                  <Field label="Assigned to">
                    {me?.isAdmin ? (
                      <Select
                        value={l.assigned_to ?? ""}
                        onValueChange={(v) => update.mutate({ assigned_to: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Unassigned" />
                        </SelectTrigger>
                        <SelectContent>
                          {(people.data ?? []).map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {people.data?.find((p) => p.id === l.assigned_to)?.full_name ?? "Unassigned"}
                      </p>
                    )}
                  </Field>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Booking</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {booking.data ? (
                    <>
                      <p className="font-medium">
                        {(booking.data.units as { buildings?: { name?: string } } | null)?.buildings?.name ?? ""}{" "}
                        {(booking.data.units as { unit_number?: string } | null)?.unit_number}
                      </p>
                      <p className="text-muted-foreground">
                        {formatMoney(Number(booking.data.amount))} · {formatDate(booking.data.booking_date)}
                      </p>
                      <Link to="/bookings" className="text-primary underline-offset-4 hover:underline">
                        View all bookings
                      </Link>
                    </>
                  ) : (
                    <>
                      <p className="text-muted-foreground">No booking yet for this lead.</p>
                      <Link to="/properties">
                        <Button size="sm" className="mt-2">
                          Book a unit
                        </Button>
                      </Link>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="lg:col-span-3">
                <CardHeader>
                  <CardTitle className="text-base">Notes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Log a call, site visit or negotiation update…"
                    rows={3}
                  />
                  <Button size="sm" onClick={() => addNote.mutate()} disabled={addNote.isPending}>
                    {addNote.isPending ? "Saving…" : "Add note"}
                  </Button>
                  <QueryBoundary
                    isLoading={notes.isLoading}
                    error={notes.error}
                    isEmpty={(notes.data ?? []).length === 0}
                    empty={<p className="text-sm text-muted-foreground">No notes yet.</p>}
                  >
                    <ul className="space-y-2">
                      {(notes.data ?? []).map((n) => (
                        <li key={n.id} className="rounded-lg border border-border p-3 text-sm">
                          <p>{n.body}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {people.data?.find((p) => p.id === n.author_id)?.full_name ?? "Team"} ·{" "}
                            {formatDate(n.created_at)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </QueryBoundary>
                </CardContent>
              </Card>
            </div>
            <EditLeadDialog
              open={editOpen}
              onOpenChange={setEditOpen}
              lead={{
                id: l.id,
                name: l.name,
                email: l.email ?? "",
                phone: l.phone ?? "",
                source: l.source ?? "website",
              }}
            />
          </>
        ) : null}
      </QueryBoundary>
    </>
  );
}

function EditLeadDialog({
  open,
  onOpenChange,
  lead,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lead: { id: string; name: string; email: string; phone: string; source: string };
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(lead);
  const [loadedId, setLoadedId] = useState(lead.id);
  const [error, setError] = useState<string | null>(null);

  if (lead.id !== loadedId) {
    setLoadedId(lead.id);
    setForm(lead);
  }

  const save = useMutation({
    mutationFn: async () => {
      if (form.name.trim().length < 2) throw new Error("Lead name is required.");
      if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) throw new Error("Enter a valid email address.");
      if (!/^[0-9+\-\s]{7,15}$/.test(form.phone.trim())) throw new Error("Enter a valid phone number.");
      const { error: err } = await supabase
        .from("leads")
        .update({
          name: form.name.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim(),
          source: form.source,
        })
        .eq("id", lead.id);
      if (err) throw err;
    },
    onSuccess: () => {
      toast.success("Lead details updated");
      queryClient.invalidateQueries({ queryKey: ["lead", lead.id] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      setError(null);
      onOpenChange(false);
    },
    onError: (err) => setError(friendlyError(err)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit lead details</DialogTitle>
          <DialogDescription>Correct the contact information captured for this lead.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Full name">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Phone">
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Source">
            <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEAD_SOURCES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {SOURCE_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
