import type { ReactNode } from "react";
import { Navigate } from "@tanstack/react-router";
import { useSession } from "@/lib/auth";
import { AppLayout } from "@/components/AppLayout";
import { LoadingRows } from "@/components/StateBlocks";

export function Protected({ children }: { children: ReactNode }) {
  const { session, loading } = useSession();

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-3xl p-8">
        <LoadingRows rows={5} />
      </div>
    );
  }
  if (!session) return <Navigate to="/auth" replace />;
  return <AppLayout>{children}</AppLayout>;
}
