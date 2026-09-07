import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "./crm";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
      queryClient.invalidateQueries({ queryKey: ["me"] });
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, [queryClient]);

  return { session, loading };
}

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string;
  role: AppRole;
  isAdmin: boolean;
};

export function useCurrentUser() {
  return useQuery<CurrentUser | null>({
    queryKey: ["me"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) return null;
      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);
      const role: AppRole = roles?.some((r) => r.role === "admin") ? "admin" : "sales";
      return {
        id: user.id,
        email: profile?.email || user.email || "",
        fullName: profile?.full_name || user.email?.split("@")[0] || "User",
        role,
        isAdmin: role === "admin",
      };
    },
  });
}
