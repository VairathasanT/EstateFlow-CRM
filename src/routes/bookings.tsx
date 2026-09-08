import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Protected } from "@/components/Protected";
import { PageHeader } from "@/components/AppLayout";
import { EmptyState, QueryBoundary } from "@/components/StateBlocks";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatDate, formatMoney, friendlyError } from "@/lib/crm";

export const Route = createFileRoute("/bookings")({
  head: () => ({
    meta: [
      { title: "Bookings — Estate CRM" },
      { name: "description", content: "Every confirmed unit booking with lead, amount and status." },
      { property: "og:title", content: "Bookings — Estate CRM" },
      { property: "og:description", content: "Every confirmed unit booking with lead, amount and status." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <Protected>
      <BookingsPage />
    </Protected>
  ),
});

function BookingsPage() {
  const queryClient = useQueryClient();

  const bookings = useQuery({
    queryKey: ["bookings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(
          "id, amount, booking_date, status, notes, lead_id, leads(name, phone), units(unit_number, unit_type, buildings(name, projects(name)))",
        )
        .order("booking_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const cancel = useMutation({
    mutationFn: async (bookingId: string) => {
      const { error } = await supabase.rpc("cancel_booking", { p_booking_id: bookingId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Booking cancelled and unit released");
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err) => toast.error(friendlyError(err)),
  });

  return (
    <>
      <PageHeader title="Bookings" description="Confirmed unit bookings and their status." />
      <QueryBoundary
        isLoading={bookings.isLoading}
        error={bookings.error}
        isEmpty={(bookings.data ?? []).length === 0}
        onRetry={() => bookings.refetch()}
        empty={
          <Card>
            <EmptyState
              title="No bookings yet"
              description="Bookings appear here once a lead is matched to an available unit."
              action={
                <Link to="/properties">
                  <Button>Browse properties</Button>
                </Link>
              }
            />
          </Card>
        }
      >
        <div className="grid gap-3">
          {(bookings.data ?? []).map((b) => {
            const unit = b.units as
              | { unit_number: string; unit_type: string; buildings?: { name?: string; projects?: { name?: string } } }
              | null;
            const lead = b.leads as { name: string; phone?: string } | null;
            return (
              <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
                <div>
                  <p className="font-medium">
                    {unit?.buildings?.projects?.name ? `${unit.buildings.projects.name} · ` : ""}
                    {unit?.buildings?.name} {unit?.unit_number}
                    <span className="ml-2 text-sm font-normal text-muted-foreground">{unit?.unit_type}</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {lead ? (
                      <Link to="/leads/$leadId" params={{ leadId: b.lead_id }} className="hover:text-foreground">
                        {lead.name}
                      </Link>
                    ) : (
                      "Lead"
                    )}{" "}
                    · {formatDate(b.booking_date)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-display font-semibold">{formatMoney(Number(b.amount))}</span>
                  <Badge
                    variant="secondary"
                    className={b.status === "active" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}
                  >
                    {b.status === "active" ? "Active" : "Cancelled"}
                  </Badge>
                  {b.status === "active" ? (
                    <Button size="sm" variant="outline" onClick={() => cancel.mutate(b.id)} disabled={cancel.isPending}>
                      Cancel
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </QueryBoundary>
    </>
  );
}
