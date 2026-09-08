import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
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
                <Badge variant="secondary" className={STAGE_TONE[l.stage as LeadStage]}>
                  {STAGE_LABEL[l.stage as LeadStage]}
                </Badge>
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
                      onValueChange={(v) => update.mutate({ stage: v })}
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
          </>
        ) : null}
      </QueryBoundary>
    </>
  );
}
