import type { ReactNode } from "react";
import { AlertTriangle, Inbox, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { friendlyError } from "@/lib/crm";

export function LoadingRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-1">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-lg" />
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <div className="rounded-full bg-muted p-3 text-muted-foreground">
        <Inbox className="h-5 w-5" />
      </div>
      <p className="font-medium text-foreground">{title}</p>
      {description ? <p className="max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <div className="rounded-full bg-destructive/10 p-3 text-destructive">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <p className="font-medium text-foreground">We couldn't load this</p>
      <p className="max-w-sm text-sm text-muted-foreground">{friendlyError(error)}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          <RefreshCw className="mr-2 h-4 w-4" /> Try again
        </Button>
      ) : null}
    </div>
  );
}

export function QueryBoundary({
  isLoading,
  error,
  isEmpty,
  onRetry,
  empty,
  children,
}: {
  isLoading: boolean;
  error: unknown;
  isEmpty?: boolean;
  onRetry?: () => void;
  empty?: ReactNode;
  children: ReactNode;
}) {
  if (isLoading) return <LoadingRows />;
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  if (isEmpty) return <>{empty ?? <EmptyState title="Nothing here yet" />}</>;
  return <>{children}</>;
}
