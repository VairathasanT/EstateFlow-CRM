import type { Database } from "@/integrations/supabase/types";

export type LeadStage = Database["public"]["Enums"]["lead_stage"];
export type UnitStatus = Database["public"]["Enums"]["unit_status"];
export type AppRole = Database["public"]["Enums"]["app_role"];

export const LEAD_STAGES: LeadStage[] = [
  "new",
  "contacted",
  "site_visit",
  "interested",
  "negotiation",
  "booked",
  "lost",
];

export const STAGE_LABEL: Record<LeadStage, string> = {
  new: "New",
  contacted: "Contacted",
  site_visit: "Site Visit",
  interested: "Interested",
  negotiation: "Negotiation",
  booked: "Booked",
  lost: "Lost",
};

export const STAGE_TONE: Record<LeadStage, string> = {
  new: "bg-muted text-muted-foreground",
  contacted: "bg-info/15 text-info",
  site_visit: "bg-accent/15 text-accent",
  interested: "bg-warning/15 text-warning",
  negotiation: "bg-warning/25 text-warning",
  booked: "bg-success/15 text-success",
  lost: "bg-destructive/15 text-destructive",
};

export const UNIT_STATUSES: UnitStatus[] = ["available", "held", "booked", "sold"];

export const UNIT_STATUS_LABEL: Record<UnitStatus, string> = {
  available: "Available",
  held: "On hold",
  booked: "Booked",
  sold: "Sold",
};

export const UNIT_STATUS_TONE: Record<UnitStatus, string> = {
  available: "bg-success/15 text-success",
  held: "bg-warning/15 text-warning",
  booked: "bg-info/15 text-info",
  sold: "bg-muted text-muted-foreground",
};

export const UNIT_TYPES = ["1BHK", "2BHK", "3BHK", "4BHK", "Penthouse", "Studio", "Shop"];

export const LEAD_SOURCES = ["walk_in", "website", "referral", "portal", "campaign"];

export const SOURCE_LABEL: Record<string, string> = {
  walk_in: "Walk-in",
  website: "Website",
  referral: "Referral",
  portal: "Property portal",
  campaign: "Campaign",
};

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return currency.format(Number(value));
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/** Turns a database/network failure into something a salesperson can read. */
export function friendlyError(error: unknown, fallback = "Something went wrong. Please try again.") {
  if (!error) return fallback;
  const message =
    typeof error === "string"
      ? error
      : ((error as { message?: string }).message ?? "");
  if (!message) return fallback;
  if (/fetch|network/i.test(message)) return "Can't reach the server. Check your connection and retry.";
  if (/no longer available/i.test(message)) return "Unit is no longer available.";
  if (/row-level security|permission denied|42501/i.test(message))
    return "You don't have permission to do that.";
  if (/duplicate key|unique constraint/i.test(message)) return "That record already exists.";
  if (/violates foreign key/i.test(message))
    return "This record is still linked to other records and can't be removed.";
  return message;
}
