# Estate CRM — Real Estate Lead & Booking CRM

A production-style CRM where a real-estate sales team manages leads, property inventory
(projects → buildings → units) and unit bookings, with Admin and Sales Employee roles.

**Live demo:** https://id-preview--78c03abb-8fcd-4c37-b2d9-7ba2ab4230b6.lovable.app

## Demo credentials

| Role           | Email                   | Password       |
| -------------- | ----------------------- | -------------- |
| Admin          | admin@estatecrm.com     | `Password123!` |
| Sales employee | sales@estatecrm.com     | `Password123!` |

Demo data is seeded: 2 projects, 4 buildings, 20 units, 6 leads and a sample booking.

## Tech stack

- **Frontend:** React 19 + TypeScript, TanStack Start (file-based routing, SSR), TanStack Query
  for all server state, Tailwind CSS v4 with a semantic design-token system, shadcn/ui primitives.
- **Backend:** Postgres (Supabase) with Row Level Security as the authorization layer, plus
  `SECURITY DEFINER` SQL functions for transactional business logic. Auth is Supabase Auth
  (bcrypt-hashed passwords, JWT sessions) — no password handling in app code.

## Setup

```sh
git clone <repository-url>
cd <repository-name>
npm install
cp .env.example .env   # fill in your own backend URL + publishable key
npm run dev            # http://localhost:8080
npm run build          # production build
```

Environment variables (never committed; `.env` is git-ignored):

| Variable                        | Used by         | Purpose                       |
| ------------------------------- | --------------- | ----------------------------- |
| `VITE_SUPABASE_URL`             | browser         | API base URL                  |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | browser         | public (RLS-protected) API key |
| `SUPABASE_URL`                  | server / SSR    | API base URL                  |
| `SUPABASE_PUBLISHABLE_KEY`      | server / SSR    | public API key                |

Only publishable keys reach the client; the service-role key is never used in app code.

## Database overview

```
profiles (id → auth.users)      user_roles (user_id, role: admin | sales)
projects ──< buildings ──< units
leads ──< lead_notes
leads ──< bookings >── units
```

| Table        | Key columns                                                                              |
| ------------ | ---------------------------------------------------------------------------------------- |
| `profiles`   | `id`, `full_name`, `email`                                                                |
| `user_roles` | `user_id`, `role` (`app_role` enum), unique per pair                                      |
| `projects`   | `name`, `location`, `description`                                                         |
| `buildings`  | `project_id`, `name`, `floors` (> 0)                                                      |
| `units`      | `building_id`, `unit_number`, `unit_type`, `area_sqft`, `price` (> 0), `status`, unique `(building_id, unit_number)` |
| `leads`      | `name`, `email`, `phone`, `source`, `budget`, `stage`, `assigned_to`, `follow_up_date`, `created_by` |
| `lead_notes` | `lead_id`, `author_id`, `body` (non-empty)                                                 |
| `bookings`   | `lead_id`, `unit_id`, `booked_by`, `booking_date`, `amount` (> 0), `status`, `notes`       |

Enums: `app_role` (admin, sales) · `lead_stage` (new, contacted, site_visit, interested,
negotiation, booked, lost) · `unit_status` (available, held, booked, sold) ·
`booking_status` (active, cancelled).

### API surface

There is no hand-rolled REST layer: the database *is* the API. Reads/writes go through the
auto-generated PostgREST data API, and every request is filtered by RLS policies evaluated
with the caller's JWT. Multi-step business operations are exposed as RPCs:

| Operation                | Endpoint                                                              |
| ------------------------ | --------------------------------------------------------------------- |
| Sign in / sign up        | `POST /auth/v1/token`, `POST /auth/v1/signup`                          |
| Leads CRUD + search      | `GET/POST/PATCH/DELETE /rest/v1/leads`                                 |
| Notes                    | `GET/POST /rest/v1/lead_notes`                                          |
| Inventory                | `GET /rest/v1/projects|buildings|units`, admin `POST/PATCH /rest/v1/units` |
| Create booking (atomic)  | `POST /rest/v1/rpc/create_booking`                                     |
| Cancel booking (atomic)  | `POST /rest/v1/rpc/cancel_booking`                                     |
| Dashboard metrics        | aggregate reads over `leads`, `bookings`, `units`                       |

### Permissions

| Capability                        | Admin | Sales employee                |
| --------------------------------- | ----- | ----------------------------- |
| View leads                        | all   | assigned to / created by them |
| Create leads                      | ✅    | ✅ (assigned to themselves)   |
| Edit leads, notes, follow-ups     | all   | own leads only                |
| Reassign a lead                   | ✅    | ❌ (blocked by DB trigger)    |
| Delete a lead                     | ✅    | ❌                            |
| Manage projects/buildings/units   | ✅    | ❌ (read-only)                |
| Create bookings                   | ✅    | own leads only                |
| View bookings                     | all   | their own                     |
| Manage team roles                 | ✅    | ❌                            |

These rules are enforced in SQL (RLS + trigger + RPC checks). The UI mirrors them by hiding
admin-only controls, but the server never trusts the client.

## Key decisions

1. **Booking uniqueness is guaranteed by the database, not the UI.** A partial unique index
   (`bookings_one_active_per_unit` on `unit_id WHERE status = 'active'`) makes a second active
   booking physically impossible. `create_booking()` additionally locks the unit row
   `FOR UPDATE`, re-checks availability, inserts the booking, flips the unit to `booked` and
   moves the lead to the `Booked` stage — all in one transaction. Two concurrent bookers
   produce exactly one winner; the loser gets "Unit is no longer available."

2. **Authorization lives in the database.** Rather than trusting an API layer, every table has
   RLS policies keyed on `auth.uid()` and a `has_role()` `SECURITY DEFINER` helper. Roles are
   stored in a separate `user_roles` table (never on `profiles`) so a user cannot escalate
   privileges by editing their own profile row.

3. **Lead reassignment is trigger-guarded.** Sales employees can fully manage their leads but a
   `BEFORE UPDATE` trigger rejects any change to `assigned_to` from a non-admin — otherwise a
   salesperson could quietly steal or dump pipeline while still passing the RLS check.

4. **Stage changes to `Booked` are system-owned.** `Booked` cannot be picked manually in the
   UI; it is only set by `create_booking()`, so pipeline reporting can never disagree with the
   bookings table. `cancel_booking()` releases the unit back to `available`.

5. **Server state through TanStack Query with explicit states everywhere.** A single
   `QueryBoundary` component renders loading skeletons, empty states and retryable errors, and
   `friendlyError()` translates database/RLS/network failures into sentences a salesperson can
   act on instead of raw Postgres codes.

## Feature walkthrough

- **Leads** — searchable by name/email/phone, filterable by stage (state lives in the URL, so
  a filtered view is shareable), create dialog with validation, detail page with stage,
  follow-up date, budget, assignment, editable contact details and a notes timeline.
- **Properties** — projects → buildings → units with price, type, area and live status;
  status/type filters; admins can add units and edit any unit (price, type, area, availability).
- **Bookings** — one active booking per unit, booking dialog with conflict handling, bookings
  list with amounts, dates, status and cancel (which releases the unit).
- **Dashboard** — total leads, leads by stage, follow-ups due, total bookings, available units
  and recent activity; scoped automatically to the signed-in user's permissions.
- **Team** — admin-only role management for sales employees.
- **UX details** — responsive sidebar/drawer layout, show/hide password toggle, toast feedback,
  keyboard-accessible dialogs, consistent design tokens with light and dark support.
