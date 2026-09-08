import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useSession } from "@/lib/auth";
import { LoadingRows } from "@/components/StateBlocks";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Estate CRM — Leads, properties & bookings" },
      {
        name: "description",
        content:
          "Estate CRM helps real estate teams track leads, manage inventory and close bookings without double-selling a unit.",
      },
      { property: "og:title", content: "Estate CRM — Leads, properties & bookings" },
      {
        property: "og:description",
        content: "Track leads, manage inventory and close bookings in one real estate workspace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  const { session, loading } = useSession();
  if (loading) {
    return (
      <div className="mx-auto w-full max-w-3xl p-8">
        <LoadingRows rows={4} />
      </div>
    );
  }
  return <Navigate to={session ? "/dashboard" : "/auth"} replace />;
}
