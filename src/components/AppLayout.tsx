import { useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  CalendarCheck,
  LayoutDashboard,
  LogOut,
  Menu,
  Users,
  UserCog,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, adminOnly: false },
  { to: "/leads", label: "Leads", icon: Users, adminOnly: false },
  { to: "/properties", label: "Properties", icon: Building2, adminOnly: false },
  { to: "/bookings", label: "Bookings", icon: CalendarCheck, adminOnly: false },
  { to: "/team", label: "Team", icon: UserCog, adminOnly: true },
] as const;

export function AppLayout({ children }: { children: ReactNode }) {
  const { data: me, isLoading } = useCurrentUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const items = NAV.filter((item) => !item.adminOnly || me?.isAdmin);

  const nav = (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-sidebar p-4 lg:flex">
        <Brand />
        <div className="mt-6 flex-1">{nav}</div>
        <UserCard
          name={me?.fullName}
          role={me?.role}
          loading={isLoading}
          onSignOut={signOut}
        />
      </aside>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-sidebar p-4">
            <div className="flex items-center justify-between">
              <Brand />
              <button
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-sidebar-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-6 flex-1">{nav}</div>
            <UserCard
              name={me?.fullName}
              role={me?.role}
              loading={isLoading}
              onSignOut={signOut}
            />
          </aside>
        </div>
      ) : null}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur lg:hidden">
          <button aria-label="Open menu" onClick={() => setOpen(true)} className="rounded-md p-1">
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-display text-sm font-semibold">Estate CRM</span>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2 px-1">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
        <Building2 className="h-5 w-5" />
      </span>
      <span className="font-display text-base font-semibold text-sidebar-foreground">Estate CRM</span>
    </div>
  );
}

function UserCard({
  name,
  role,
  loading,
  onSignOut,
}: {
  name?: string | undefined;
  role?: string | undefined;
  loading: boolean;
  onSignOut: () => void;
}) {
  return (
    <div className="rounded-xl bg-sidebar-accent/50 p-3">
      {loading ? (
        <Skeleton className="h-8 w-full" />
      ) : (
        <>
          <p className="truncate text-sm font-medium text-sidebar-accent-foreground">{name}</p>
          <p className="text-xs capitalize text-sidebar-foreground/70">
            {role === "admin" ? "Administrator" : "Sales employee"}
          </p>
        </>
      )}
      <Button variant="secondary" size="sm" className="mt-3 w-full" onClick={onSignOut}>
        <LogOut className="mr-2 h-4 w-4" /> Sign out
      </Button>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string | undefined;
  action?: ReactNode | undefined;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
