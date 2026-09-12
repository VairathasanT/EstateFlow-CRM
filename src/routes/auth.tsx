import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Building2, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { friendlyError } from "@/lib/crm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Estate CRM" },
      { name: "description", content: "Sign in to Estate CRM to manage leads, properties and bookings." },
      { property: "og:title", content: "Sign in — Estate CRM" },
      { property: "og:description", content: "Sign in to Estate CRM to manage leads, properties and bookings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { session, loading } = useSession();
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  useEffect(() => {
    if (!loading && session) navigate({ to: "/dashboard", replace: true });
  }, [loading, session, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10 font-sans">
      <div className="w-full max-w-[420px]">
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <Building2 className="h-6 w-6" />
          </span>
          <span className="font-display text-xl font-bold tracking-tight">Estate CRM</span>
        </div>

        <div className="rounded-2xl border border-border bg-card shadow-[0_20px_50px_oklch(0.2_0.03_220_/_0.06)] p-8 sm:p-10">
          <div className="mb-8 text-center">
            <h1 className="font-display text-2xl font-bold text-card-foreground">Welcome back</h1>
            <p className="mt-1 text-sm text-muted-foreground">Please enter your details to sign in.</p>
          </div>

          <Tabs value={mode} onValueChange={(v) => setMode(v as "signin" | "signup")}>
            <TabsList className="mb-8 grid h-auto w-full grid-cols-2 gap-0 rounded-xl bg-muted p-1">
              <TabsTrigger
                value="signin"
                className="rounded-lg text-sm font-semibold data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-foreground/5"
              >
                Sign in
              </TabsTrigger>
              <TabsTrigger
                value="signup"
                className="rounded-lg text-sm font-medium text-muted-foreground data-[state=active]:bg-card data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-foreground/5"
              >
                Create account
              </TabsTrigger>
            </TabsList>
            <TabsContent value="signin">
              <AuthForm mode="signin" onModeChange={setMode} />
            </TabsContent>
            <TabsContent value="signup">
              <AuthForm mode="signup" onModeChange={setMode} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function AuthForm({
  mode,
  onModeChange,
}: {
  mode: "signin" | "signup";
  onModeChange: (mode: "signin" | "signup") => void;
}) {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (mode === "signup" && fullName.trim().length < 2) {
      setError("Please enter your full name.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        navigate({ to: "/dashboard", replace: true });
      } else {
        const { error: err } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { full_name: fullName.trim() },
          },
        });
        if (err) throw err;
        setNotice("Account created. You can sign in now.");
        setFullName("");
        setEmail("");
        setPassword("");
      }
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {mode === "signup" ? (
        <div className="space-y-2">
          <Label htmlFor={`${mode}-name`} className="text-sm font-medium text-foreground/80">
            Full name
          </Label>
          <Input
            id={`${mode}-name`}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Priya Sharma"
            autoComplete="name"
            className="rounded-xl border-input bg-card px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-4 focus:ring-ring/10"
          />
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor={`${mode}-email`} className="text-sm font-medium text-foreground/80">
          Email address
        </Label>
        <Input
          id={`${mode}-email`}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@company.com"
          autoComplete="email"
          className="rounded-xl border-input bg-card px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-4 focus:ring-ring/10"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor={`${mode}-password`} className="text-sm font-medium text-foreground/80">
            Password
          </Label>
          {mode === "signin" ? (
            <button
              type="button"
              onClick={() => setNotice("Please contact your admin to reset your password.")}
              className="text-xs font-semibold text-primary hover:text-primary/80"
            >
              Forgot password?
            </button>
          ) : null}
        </div>
        <div className="relative">
          <Input
            id={`${mode}-password`}
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            className="rounded-xl border-input bg-card px-4 py-3 pr-11 text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-4 focus:ring-ring/10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {mode === "signin" ? (
        <div className="flex items-center">
          <input
            type="checkbox"
            id="remember_me"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="h-4 w-4 rounded border-input text-primary accent-primary focus:ring-ring"
          />
          <label htmlFor="remember_me" className="ml-2 block text-sm text-muted-foreground">
            Remember for 30 days
          </label>
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {notice ? <p className="text-sm text-success">{notice}</p> : null}

      <Button
        type="submit"
        disabled={busy}
        className="w-full rounded-xl bg-primary py-3.5 font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-all active:scale-[0.98] hover:bg-primary/90"
      >
        {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {mode === "signin" ? "Don't have an account?" : "Already have an account?"}{" "}
        <button
          type="button"
          onClick={() => {
            setError(null);
            setNotice(null);
            onModeChange(mode === "signin" ? "signup" : "signin");
          }}
          className="font-semibold text-primary hover:text-primary/80"
        >
          {mode === "signin" ? "Sign up" : "Sign in"}
        </button>
      </p>
    </form>
  );
}
