import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Building2, CalendarClock, CheckCircle2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/auth";
import { Protected } from "@/components/Protected";
import { PageHeader } from "@/components/AppLayout";
import { QueryBoundary } from "@/components/StateBlocks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LEAD_STAGES, STAGE_LABEL, STAGE_TONE, formatDate, formatMoney, todayISO } from "@/lib/crm";
import type { LeadStage } from "@/lib/crm";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Estate CRM" },
      { name: "description", content: "Pipeline health, follow-ups due, bookings and available inventory at a glance." },
      { property: "og:title", content: "Dashboard — Estate CRM" },
      { property: "og:description", content: "Pipeline health, follow-ups due, bookings and available inventory." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <Protected>
      <DashboardPage />
    </Protected>
  ),
});

function DashboardPage() {
  const { data: me } = useCurrentUser();

  const query = useQuery({
    queryKey: ["dashboard", me?.id],
    enabled: Boolean(me),
    queryFn: async () => {
      const today = todayISO();
      const [leads, units, bookings] = await Promise.all([
        supabase.from("leads").select("id, name, stage, follow_up_date, created_at").order("created_at", { ascending: false }),
        supabase.from("units").select("id, status"),
        supabase
          .from("bookings")
          .select("id, amount, status, booking_date, leads(name), units(unit_number)")
          .order("booking_date", { ascending: false })
          .limit(5),
      ]);
      if (leads.error) throw leads.error;
      if (units.error) throw units.error;
      if (bookings.error) throw bookings.error;

      const byStage = Object.fromEntries(LEAD_STAGES.map((s) => [s, 0])) as Record<LeadStage, number>;
      for (const lead of leads.data) byStage[lead.stage as LeadStage] += 1;

      return {
        totalLeads: leads.data.length,
        byStage,
        dueFollowUps: leads.data.filter((l) => l.follow_up_date && l.follow_up_date <= today && l.stage !== "booked" && l.stage !== "lost"),
        availableUnits: units.data.filter((u) => u.status === "available").length,
        totalUnits: units.data.length,
        recentLeads: leads.data.slice(0, 5),
        recentBookings: bookings.data,
      };
    },
  });

  const d = query.data;

  return (
    <>
      <PageHeader
        title={me ? `Hello, ${me.fullName.split(" ")[0]}` : "Dashboard"}
        description={
          me?.isAdmin
            ? "Company-wide pipeline, inventory and bookings."
            : "Your assigned pipeline, follow-ups and bookings."
        }
      />
      <QueryBoundary isLoading={query.isLoading} error={query.error} onRetry={() => query.refetch()}>
        {d ? (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Stat icon={<Users className="h-4 w-4" />} label="Total leads" value={d.totalLeads} />
              <Stat icon={<CalendarClock className="h-4 w-4" />} label="Follow-ups due" value={d.dueFollowUps.length} />
              <Stat icon={<CheckCircle2 className="h-4 w-4" />} label="Bookings" value={d.byStage.booked} />
              <Stat
                icon={<Building2 className="h-4 w-4" />}
                label="Available units"
                value={`${d.availableUnits}/${d.totalUnits}`}
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Leads by stage</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {LEAD_STAGES.map((stage) => (
                  <Link key={stage} to="/leads" search={{ stage }} className="no-underline">
                    <Badge variant="secondary" className={`${STAGE_TONE[stage]} gap-2 px-3 py-1.5 text-xs`}>
                      {STAGE_LABEL[stage]}
                      <span className="font-semibold">{d.byStage[stage]}</span>
                    </Badge>
                  </Link>
                ))}
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Follow-ups due</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {d.dueFollowUps.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nothing due. Nice work.</p>
                  ) : (
                    d.dueFollowUps.slice(0, 6).map((lead) => (
                      <Link
                        key={lead.id}
                        to="/leads/$leadId"
                        params={{ leadId: lead.id }}
                        className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted/60"
                      >
                        <span className="font-medium">{lead.name}</span>
                        <span className="text-muted-foreground">{formatDate(lead.follow_up_date)}</span>
                      </Link>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Recent activity</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {d.recentBookings.length === 0 && d.recentLeads.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No activity yet.</p>
                  ) : null}
                  {d.recentBookings.map((b) => (
                    <div key={b.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                      <p className="font-medium">
                        Booking · {(b.leads as { name: string } | null)?.name ?? "Lead"} →{" "}
                        {(b.units as { unit_number: string } | null)?.unit_number ?? "Unit"}
                      </p>
                      <p className="text-muted-foreground">
                        {formatMoney(Number(b.amount))} · {formatDate(b.booking_date)} · {b.status}
                      </p>
                    </div>
                  ))}
                  {d.recentLeads.map((l) => (
                    <div key={l.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                      <p className="font-medium">New lead · {l.name}</p>
                      <p className="text-muted-foreground">
                        {STAGE_LABEL[l.stage as LeadStage]} · {formatDate(l.created_at)}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        ) : null}
      </QueryBoundary>
    </>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-5">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</span>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="font-display text-xl font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
