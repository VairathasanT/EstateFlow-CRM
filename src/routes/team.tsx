import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/auth";
import { Protected } from "@/components/Protected";
import { PageHeader } from "@/components/AppLayout";
import { EmptyState, QueryBoundary } from "@/components/StateBlocks";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { friendlyError } from "@/lib/crm";
import type { AppRole } from "@/lib/crm";

export const Route = createFileRoute("/team")({
  head: () => ({
    meta: [
      { title: "Team — Estate CRM" },
      { name: "description", content: "Administrators manage sales employees and their access levels." },
      { property: "og:title", content: "Team — Estate CRM" },
      { property: "og:description", content: "Manage sales employees and their access levels." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <Protected>
      <TeamPage />
    </Protected>
  ),
});

function TeamPage() {
  const { data: me, isLoading: meLoading } = useCurrentUser();
  const queryClient = useQueryClient();

  const team = useQuery({
    queryKey: ["team"],
    enabled: Boolean(me?.isAdmin),
    queryFn: async () => {
      const [profiles, roles] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email").order("full_name"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (profiles.error) throw profiles.error;
      if (roles.error) throw roles.error;
      return profiles.data.map((p) => ({
        ...p,
        role: (roles.data.some((r) => r.user_id === p.id && r.role === "admin") ? "admin" : "sales") as AppRole,
      }));
    },
  });

  const setRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const del = await supabase.from("user_roles").delete().eq("user_id", userId);
      if (del.error) throw del.error;
      const ins = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (ins.error) throw ins.error;
    },
    onSuccess: () => {
      toast.success("Role updated");
      queryClient.invalidateQueries({ queryKey: ["team"] });
    },
    onError: (err) => toast.error(friendlyError(err)),
  });

  if (!meLoading && !me?.isAdmin) {
    return (
      <>
        <PageHeader title="Team" />
        <Card>
          <EmptyState
            title="Administrators only"
            description="You don't have permission to manage team members."
          />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Team" description="Manage who can administer the CRM and who sells." />
      <QueryBoundary
        isLoading={meLoading || team.isLoading}
        error={team.error}
        isEmpty={(team.data ?? []).length === 0}
        onRetry={() => team.refetch()}
        empty={
          <Card>
            <EmptyState title="No team members yet" description="Invite colleagues to create their accounts." />
          </Card>
        }
      >
        <div className="grid gap-3">
          {(team.data ?? []).map((member) => (
            <div
              key={member.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"
            >
              <div>
                <p className="font-medium">{member.full_name}</p>
                <p className="text-sm text-muted-foreground">{member.email}</p>
              </div>
              <Select
                value={member.role}
                onValueChange={(v) => setRole.mutate({ userId: member.id, role: v as AppRole })}
                disabled={member.id === me?.id}
              >
                <SelectTrigger className="w-[190px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrator</SelectItem>
                  <SelectItem value="sales">Sales employee</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </QueryBoundary>
    </>
  );
}
