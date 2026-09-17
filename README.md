# 🏢 Estate CRM — Real Estate Lead & Booking CRM

A production-style CRM where a real-estate sales team manages **leads** (potential customers),
**properties** (projects → buildings → units), and **bookings** (a lead buying a unit).
It has two roles — **Admin** and **Sales Employee** — with all permissions enforced securely
in the database, not just hidden in the UI.

**Live demo:** https://id-preview--78c03abb-8fcd-4c37-b2d9-7ba2ab4230b6.lovable.app

> 📝 Note: the live link above is the preview link. Once the project is **Published**
> (Publish button, top-right of the editor) the app gets a permanent public URL —
> that is the link to submit with this assignment.

---

## 📑 What's inside

1. [Demo credentials](#-demo-credentials)
2. [Features](#-features)
3. [Tech stack (plain English)](#-tech-stack-plain-english)
4. [Setup — step by step for beginners](#️-setup--step-by-step-for-beginners)
5. [Project structure](#-project-structure)
6. [Database overview](#-database-overview)
7. [API overview](#-api-overview)
8. [Permissions](#-permissions)
9. [Important decisions & why](#-important-decisions--why)
10. [Troubleshooting](#-troubleshooting)

---

## 🔑 Demo credentials

| Role           | Email               | Password      |
| -------------- | ------------------- | ------------- |
| Admin          | admin@estatecrm.com | `Admin@123`   |
| Sales employee | sales@estatecrm.com | `Sales@123`   |

Demo data is already seeded: **2 projects, 4 buildings, 20 units, 6 leads and a sample booking** —
so every page has content the moment you sign in.

**Try this first:** sign in as the Admin and look around (everything is visible).
Then sign in as the Sales employee — you'll notice the Team page is gone, and you only
see the leads assigned to you. That's role-based access working end to end.

---

## ✨ Features

- **Leads** — create, edit, search (by name / email / phone), filter by stage, assign to a
  sales employee, add notes, set follow-up dates. Every lead moves through the pipeline:
  `New → Contacted → Site Visit → Interested → Negotiation → Booked / Lost`.
- **Properties** — projects contain buildings, buildings contain units. Each unit has a
  number, type (1BHK/2BHK/…), area, price and live availability status. Admins can add and
  edit units.
- **Bookings** — connect a lead to an available unit. The database **guarantees** one
  active booking per unit, even if two salespeople click at the same moment. Cancelling a
  booking releases the unit automatically.
- **Dashboard** — total leads, leads by stage, follow-ups due, total bookings, available
  units and recent activity — automatically scoped to what the signed-in user may see.
- **Team (Admin only)** — manage sales employees and their roles.
- **UX polish** — responsive sidebar/mobile drawer, show/hide password toggle, toast
  notifications, loading skeletons, friendly empty & error states, light and dark mode.

---

## 🧰 Tech stack (plain English)

| Layer      | Technology                             | What it does |
| ---------- | -------------------------------------- | ------------ |
| Frontend   | React 19 + TypeScript                  | The user interface you see in the browser |
| Routing    | TanStack Start (file-based routing)    | Maps URLs like `/leads` to page files |
| Data       | TanStack Query                         | Fetches, caches and refreshes server data |
| Styling    | Tailwind CSS v4 + shadcn/ui            | Design system: colors, spacing, components |
| Backend    | Postgres (Supabase)                    | Stores all data in tables |
| Security   | Row Level Security (RLS)               | The database itself decides who can read/write what |
| Auth       | Supabase Auth                          | Email + password sign-in, hashed passwords, JWT sessions |

No passwords are ever handled or stored by the app code — authentication is delegated to
Supabase Auth, which stores bcrypt-hashed passwords and issues JWT session tokens.

---

## ⚙️ Setup — step by step for beginners

### Step 0 — Prerequisites

- **Node.js 20+** — download from https://nodejs.org (the LTS version is fine).
- **A code editor** — VS Code is recommended.
- **Git** — for cloning/pushing the repository.

Check they're installed by opening a terminal and running:

```sh
node -v
git --version
```

### Step 1 — Get the code

```sh
git clone <repository-url>
cd <repository-name>
```

(or click **Code → Download ZIP** on the GitHub page and unzip it.)

### Step 2 — Install dependencies

```sh
npm install
```

This downloads all the libraries the app needs (one time only).

### Step 3 — Create your `.env` file

The app talks to a backend database. Copy the provided template:

```sh
cp .env.example .env
```

Then open `.env` and fill in **your own** backend values:

| Variable                        | Used by       | Purpose                                |
| ------------------------------- | ------------- | -------------------------------------- |
| `VITE_SUPABASE_URL`             | browser       | API base URL                           |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | browser       | Public (RLS-protected) API key         |
| `VITE_SUPABASE_PROJECT_ID`      | browser       | Project reference                      |
| `SUPABASE_URL`                  | server / SSR  | API base URL                           |
| `SUPABASE_PUBLISHABLE_KEY`      | server / SSR  | Public API key                         |

🔒 **Security note:** only *publishable* keys belong in `.env`. The secret service-role key
is never used by this app and never committed. `.env` is listed in `.gitignore`, so it
will never be pushed to GitHub — that's why `git clone` doesn't include it and you must
create it in this step.

### Step 4 — Run the app

```sh
npm run dev
```

Open **http://localhost:8080** in your browser. Sign in with the demo credentials above.
🎉 Done!

### Step 5 — Build for production (optional)

```sh
npm run build
```

Outputs an optimized production bundle.

---

## 📁 Project structure

```
src/
├── routes/                  # one file per page (file-based routing)
│   ├── index.tsx            # "/"  → redirects to /dashboard or /auth
│   ├── auth.tsx             # sign-in / sign-up page
│   ├── dashboard.tsx        # metrics overview
│   ├── leads.index.tsx      # leads list + search + filters
│   ├── leads.$leadId.tsx    # lead detail (edit, notes, stage, assignment)
│   ├── properties.tsx       # projects → buildings → units
│   ├── bookings.tsx         # bookings list + cancel
│   └── team.tsx             # admin-only role management
├── components/              # shared UI (AppLayout, loading/empty/error blocks)
├── lib/                     # helpers: labels, formatters, auth hook, error translation
└── integrations/supabase/   # generated backend clients (do not edit)
```

---

## 🗄️ Database overview

```
profiles (id → auth.users)      user_roles (user_id, role: admin | sales)
projects ──< buildings ──< units
leads ──< lead_notes
leads ──< bookings >── units
```

(`──<` means "one row has many child rows".)

| Table        | What it stores                    | Key columns |
| ------------ | --------------------------------- | ----------- |
| `profiles`   | People using the app              | `id`, `full_name`, `email` |
| `user_roles` | Who is admin vs sales             | `user_id`, `role` — unique per pair |
| `projects`   | Real-estate projects              | `name`, `location`, `description` |
| `buildings`  | Buildings inside a project        | `project_id`, `name`, `floors` (> 0) |
| `units`      | Flats/shops inside a building     | `unit_number`, `unit_type`, `area_sqft`, `price` (> 0), `status` |
| `leads`      | Potential customers               | `name`, `email`, `phone`, `source`, `budget`, `stage`, `assigned_to`, `follow_up_date` |
| `lead_notes` | Comments on a lead                | `lead_id`, `author_id`, `body` (non-empty) |
| `bookings`   | Lead × unit purchases             | `lead_id`, `unit_id`, `booked_by`, `booking_date`, `amount` (> 0), `status` |

**Enums** (columns restricted to fixed values):
`app_role` (admin, sales) · `lead_stage` (new, contacted, site_visit, interested,
negotiation, booked, lost) · `unit_status` (available, held, booked, sold) ·
`booking_status` (active, cancelled).

### The booking-safety rules (in the database)

1. A **partial unique index** `bookings_one_active_per_unit` (`unit_id WHERE status='active'`)
   makes a second *active* booking on the same unit physically impossible.
2. The `create_booking()` function **locks the unit row** (`SELECT ... FOR UPDATE`), re-checks
   availability, inserts the booking, marks the unit `booked` and moves the lead to `Booked`
   — all inside one transaction. If two people book simultaneously, exactly one wins and the
   other sees *"Unit is no longer available."*
3. `cancel_booking()` reverses the same: cancels the booking and sets the unit back to `available`.

---

## 🌐 API overview

There is **no hand-rolled REST layer** — the database *is* the API. Reads and writes go
through the auto-generated PostgREST data API, and every request is filtered by RLS
policies evaluated against the caller's JWT. Multi-step business operations are exposed as
RPC (remote procedure call) functions.

| Operation                | Endpoint                                       |
| ------------------------ | ---------------------------------------------- |
| Sign in / sign up        | `POST /auth/v1/token` · `POST /auth/v1/signup` |
| Leads CRUD + search      | `GET/POST/PATCH/DELETE /rest/v1/leads`         |
| Lead notes               | `GET/POST /rest/v1/lead_notes`                 |
| Inventory                | `GET /rest/v1/projects|buildings|units`, admin `POST/PATCH /rest/v1/units` |
| Create booking (atomic)  | `POST /rest/v1/rpc/create_booking`             |
| Cancel booking (atomic)  | `POST /rest/v1/rpc/cancel_booking`             |
| Dashboard metrics        | Aggregate reads over `leads`, `bookings`, `units` |

Because RLS does the filtering, a sales employee calling the exact same URL as an admin
automatically gets back *only their own leads*. There is no "admin endpoint" to leak.

---

## 🛡️ Permissions

| Capability                    | Admin | Sales employee              |
| ----------------------------- | ----- | --------------------------- |
| View leads                    | all   | assigned to / created by them |
| Create leads                  | ✅    | ✅ (assigned to themselves) |
| Edit leads, notes, follow-ups | all   | own leads only              |
| Reassign a lead               | ✅    | ❌ (blocked by DB trigger)  |
| Delete a lead                 | ✅    | ❌                          |
| Manage projects/buildings/units | ✅  | ❌ (read-only)              |
| Create bookings               | ✅    | own leads only              |
| View bookings                 | all   | their own                   |
| Manage team roles             | ✅    | ❌                          |

These rules are **enforced in SQL** (RLS + trigger + RPC checks). The UI *mirrors* them by
hiding admin-only buttons, but the server never trusts the client — even a crafted request
is rejected by the database.

---

## 💡 Important decisions & why

### 1. Booking uniqueness is guaranteed by the database, not the UI
A partial unique index (`bookings_one_active_per_unit`) plus a transactional
`create_booking()` function that locks the unit row make double-booking physically
impossible — even with two salespeople clicking at the same millisecond. **Why:** a
frontend check can be bypassed (or simply race another user); money and inventory are
involved, so the strongest possible guarantee must live in the database.

### 2. Authorization lives in the database (Row Level Security)
Every table has RLS policies keyed on the signed-in user, plus a `has_role()` helper.
**Why:** even if the frontend is compromised or a request is crafted by hand, the database
itself refuses to return or modify data the caller isn't allowed to touch. The UI hiding a
button is convenience; RLS is the actual security.

### 3. Roles are stored in a separate table, never on the profile
`user_roles` is its own table; `profiles` is fully editable by its owner. **Why:** if a
role column sat on `profiles` (which users can update), anyone could grant themselves
"admin" with one API call. Splitting the table closes that privilege-escalation hole.

### 4. Lead reassignment is trigger-guarded
A `BEFORE UPDATE` trigger rejects any change to `assigned_to` from a non-admin. **Why:**
without it, a salesperson could quietly steal colleagues' leads (or dump their own) while
still passing the "can edit own leads" check — reassignment is a management decision.

### 5. The `Booked` stage is system-owned
"Booked" can't be picked manually in the UI — it is only set by `create_booking()`, and
`cancel_booking()` releases the unit back to available. **Why:** pipeline reporting can
never disagree with the bookings table; a lead is marked Booked exactly when a real booking
exists, and never otherwise.

---

## 🧯 Troubleshooting

| Symptom | Likely cause / fix |
| ------- | ------------------ |
| "Missing Supabase environment variable(s)" | `.env` file missing or empty — redo Step 3. |
| Login fails but password is correct | The backend demo users don't exist in *your* backend — create them via sign-up, then insert matching `profiles` + `user_roles` rows. |
| Lists show "You don't have permission" | Your user has no row in `user_roles` — every user needs a role for RLS to allow reads. |
| Blank page after npm run dev | Hard-refresh (Ctrl+Shift+R) to clear a stale cache. |
| Port 8080 already in use | Another dev server is running — stop it, or run `npm run dev -- --port 3000`. |

---

## 🚀 Publishing / submission

- **GitHub repository** — connect via the Lovable editor (**+** menu → **GitHub** →
  **Connect project**) to push this whole project to your account. After that, every change
  syncs both ways automatically.
- **Deployed link** — click **Publish** (top-right of the editor) to get a permanent public
  URL. Use that link in your submission (the preview link at the top expires and requires a
  Lovable login).
- **README + setup** — this file covers setup, credentials, database and API overview.
- **Secrets** — `.env` is git-ignored; only the publishable key ships with the code.
