import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/auth";
import { Protected } from "@/components/Protected";
import { PageHeader } from "@/components/AppLayout";
import { QueryBoundary, EmptyState } from "@/components/StateBlocks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
  LEAD_SOURCES,
  LEAD_STAGES,
  SOURCE_LABEL,
  STAGE_LABEL,
  STAGE_TONE,
  formatDate,
  formatMoney,
  friendlyError,
} from "@/lib/crm";
import type { LeadStage } from "@/lib/crm";

type LeadSearch = { stage?: LeadStage | undefined; q?: string | undefined };

export const Route = createFileRoute("/leads/")({
  validateSearch: (search: Record<string, unknown>): LeadSearch => ({
    stage: LEAD_STAGES.includes(search.stage as LeadStage) ? (search.stage as LeadStage) : undefined,
    q: typeof search.q === "string" && search.q ? search.q : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Leads — Estate CRM" },
      { name: "description", content: "Search, filter and manage every lead in your real estate pipeline." },
      { property: "og:title", content: "Leads — Estate CRM" },
      { property: "og:description", content: "Search, filter and manage every lead in your pipeline." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <Protected>
      <LeadsPage />
    </Protected>
  ),
});

function LeadsPage() {
  const { stage, q } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data: me } = useCurrentUser();
  const [open, setOpen] = useState(false);

  const leads = useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("id, name, email, phone, source, budget, stage, follow_up_date, assigned_to, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const people = usePeople();

  const filtered = useMemo(() => {
    const term = (q ?? "").trim().toLowerCase();
    return (leads.data ?? []).filter((lead) => {
      if (stage && lead.stage !== stage) return false;
      if (!term) return true;
      return [lead.name, lead.email, lead.phone].some((v) => (v ?? "").toLowerCase().includes(term));
    });
  }, [leads.data, stage, q]);

  return (
    <>
      <PageHeader
        title="Leads"
        description={me?.isAdmin ? "Every lead across the team." : "Leads assigned to you."}
        action={
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> New lead
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search name, email or phone"
            value={q ?? ""}
            onChange={(e) =>
              navigate({ to: ".", search: (prev) => ({ ...prev, q: e.target.value || undefined }) })
            }
          />
        </div>
        <Select
          value={stage ?? "all"}
          onValueChange={(value) =>
            navigate({
              to: ".",
              search: (prev) => ({ ...prev, stage: value === "all" ? undefined : (value as LeadStage) }),
            })
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All stages" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stages</SelectItem>
            {LEAD_STAGES.map((s) => (
              <SelectItem key={s} value={s}>
                {STAGE_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <QueryBoundary
        isLoading={leads.isLoading}
        error={leads.error}
        isEmpty={filtered.length === 0}
        onRetry={() => leads.refetch()}
        empty={
          <Card>
            <EmptyState
              title="No leads match"
              description="Try a different search or stage, or add your first lead."
              action={<Button onClick={() => setOpen(true)}>Add lead</Button>}
            />
          </Card>
        }
      >
        <div className="grid gap-3">
          {filtered.map((lead) => (
            <Link
              key={lead.id}
              to="/leads/$leadId"
              params={{ leadId: lead.id }}
              className="surface-card flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/50"
            >
              <div className="min-w-0">
                <p className="font-medium">{lead.name}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {lead.phone ?? "—"} · {lead.email ?? "—"} · {SOURCE_LABEL[lead.source ?? ""] ?? lead.source ?? "—"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="text-muted-foreground">{formatMoney(lead.budget)}</span>
                <span className="text-muted-foreground">Follow-up {formatDate(lead.follow_up_date)}</span>
                <span className="text-muted-foreground">
                  {people.data?.find((p) => p.id === lead.assigned_to)?.full_name ?? "Unassigned"}
                </span>
                <Badge variant="secondary" className={STAGE_TONE[lead.stage as LeadStage]}>
                  {STAGE_LABEL[lead.stage as LeadStage]}
                </Badge>
              </div>
            </Link>
          ))}
        </div>
      </QueryBoundary>

      <NewLeadDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

export function usePeople() {
  return useQuery({
    queryKey: ["people"],
    staleTime: 300_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, email").order("full_name");
      if (error) throw error;
      return data;
    },
  });
}

function NewLeadDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const queryClient = useQueryClient();
  const { data: me } = useCurrentUser();
  const people = usePeople();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    source: "website",
    budget: "",
    stage: "new" as LeadStage,
    assigned_to: "",
    follow_up_date: "",
  });
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: async () => {
      if (form.name.trim().length < 2) throw new Error("Lead name is required.");
      if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) throw new Error("Enter a valid email address.");
      if (form.phone && !/^[0-9+\-\s]{7,15}$/.test(form.phone)) throw new Error("Enter a valid phone number.");
      if (form.budget && Number(form.budget) <= 0) throw new Error("Budget must be greater than zero.");
      const { error: err } = await supabase.from("leads").insert({
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        source: form.source,
        budget: form.budget ? Number(form.budget) : null,
        stage: form.stage,
        assigned_to: form.assigned_to || me?.id || null,
        follow_up_date: form.follow_up_date || null,
        created_by: me?.id ?? null,
      });
      if (err) throw err;
    },
    onSuccess: () => {
      toast.success("Lead created");
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      onOpenChange(false);
      setForm({ name: "", email: "", phone: "", source: "website", budget: "", stage: "new", assigned_to: "", follow_up_date: "" });
      setError(null);
    },
    onError: (err) => setError(friendlyError(err)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New lead</DialogTitle>
          <DialogDescription>Capture an enquiry and set the first follow-up.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" className="sm:col-span-2">
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
          <Field label="Budget (₹)">
            <Input
              type="number"
              min="0"
              value={form.budget}
              onChange={(e) => setForm({ ...form, budget: e.target.value })}
            />
          </Field>
          <Field label="Stage">
            <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v as LeadStage })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEAD_STAGES.filter((s) => s !== "booked").map((s) => (
                  <SelectItem key={s} value={s}>
                    {STAGE_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Follow-up date">
            <Input
              type="date"
              value={form.follow_up_date}
              onChange={(e) => setForm({ ...form, follow_up_date: e.target.value })}
            />
          </Field>
          {me?.isAdmin ? (
            <Field label="Assign to" className="sm:col-span-2">
              <Select value={form.assigned_to || me.id} onValueChange={(v) => setForm({ ...form, assigned_to: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a team member" />
                </SelectTrigger>
                <SelectContent>
                  {(people.data ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending ? "Saving…" : "Create lead"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
