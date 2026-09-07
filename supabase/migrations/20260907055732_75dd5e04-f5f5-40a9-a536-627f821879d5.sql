-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin','sales');
CREATE TYPE public.lead_stage AS ENUM ('new','contacted','site_visit','interested','negotiation','booked','lost');
CREATE TYPE public.unit_status AS ENUM ('available','held','booked','sold');
CREATE TYPE public.booking_status AS ENUM ('active','cancelled');

-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin');
$$;

CREATE POLICY "profiles readable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles update own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles insert own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "roles readable by authenticated" ON public.user_roles FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- PROPERTIES
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  location text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.buildings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
  name text NOT NULL,
  floors int NOT NULL DEFAULT 1 CHECK (floors > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL REFERENCES public.buildings(id) ON DELETE RESTRICT,
  unit_number text NOT NULL,
  unit_type text NOT NULL DEFAULT '2BHK',
  area_sqft int NOT NULL DEFAULT 0 CHECK (area_sqft >= 0),
  price numeric(14,2) NOT NULL CHECK (price > 0),
  status public.unit_status NOT NULL DEFAULT 'available',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (building_id, unit_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects, public.buildings, public.units TO authenticated;
GRANT ALL ON public.projects, public.buildings, public.units TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "projects read" ON public.projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "projects admin write" ON public.projects FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "buildings read" ON public.buildings FOR SELECT TO authenticated USING (true);
CREATE POLICY "buildings admin write" ON public.buildings FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "units read" ON public.units FOR SELECT TO authenticated USING (true);
CREATE POLICY "units admin write" ON public.units FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- LEADS
CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text NOT NULL,
  source text NOT NULL DEFAULT 'walk_in',
  budget numeric(14,2),
  stage public.lead_stage NOT NULL DEFAULT 'new',
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  follow_up_date date,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX leads_assigned_idx ON public.leads(assigned_to);
CREATE INDEX leads_stage_idx ON public.leads(stage);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER leads_touch BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY "leads select" ON public.leads FOR SELECT TO authenticated
  USING (public.is_admin() OR assigned_to = auth.uid() OR created_by = auth.uid());
CREATE POLICY "leads insert" ON public.leads FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR (created_by = auth.uid() AND (assigned_to = auth.uid() OR assigned_to IS NULL)));
CREATE POLICY "leads update" ON public.leads FOR UPDATE TO authenticated
  USING (public.is_admin() OR assigned_to = auth.uid())
  WITH CHECK (public.is_admin() OR assigned_to = auth.uid());
CREATE POLICY "leads delete admin" ON public.leads FOR DELETE TO authenticated USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.guard_lead_assignment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can reassign leads';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER leads_guard_assignment BEFORE UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.guard_lead_assignment();

CREATE TABLE public.lead_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  body text NOT NULL CHECK (length(btrim(body)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lead_notes_lead_idx ON public.lead_notes(lead_id);
GRANT SELECT, INSERT, DELETE ON public.lead_notes TO authenticated;
GRANT ALL ON public.lead_notes TO service_role;
ALTER TABLE public.lead_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notes select" ON public.lead_notes FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND (public.is_admin() OR l.assigned_to = auth.uid() OR l.created_by = auth.uid()))
);
CREATE POLICY "notes insert" ON public.lead_notes FOR INSERT TO authenticated WITH CHECK (
  author_id = auth.uid() AND EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND (public.is_admin() OR l.assigned_to = auth.uid() OR l.created_by = auth.uid()))
);
CREATE POLICY "notes delete own" ON public.lead_notes FOR DELETE TO authenticated USING (author_id = auth.uid() OR public.is_admin());

-- BOOKINGS
CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE RESTRICT,
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
  booked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  booking_date date NOT NULL DEFAULT current_date,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  status public.booking_status NOT NULL DEFAULT 'active',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX bookings_one_active_per_unit ON public.bookings(unit_id) WHERE status = 'active';
GRANT SELECT, INSERT, UPDATE ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bookings select" ON public.bookings FOR SELECT TO authenticated USING (
  public.is_admin() OR booked_by = auth.uid()
  OR EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND l.assigned_to = auth.uid())
);
CREATE POLICY "bookings update" ON public.bookings FOR UPDATE TO authenticated USING (
  public.is_admin() OR booked_by = auth.uid()
) WITH CHECK (public.is_admin() OR booked_by = auth.uid());

CREATE OR REPLACE FUNCTION public.create_booking(
  p_lead_id uuid, p_unit_id uuid, p_amount numeric DEFAULT NULL,
  p_booking_date date DEFAULT current_date, p_notes text DEFAULT ''
) RETURNS public.bookings
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_unit public.units; v_lead public.leads; v_booking public.bookings; v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000'; END IF;
  SELECT * INTO v_lead FROM public.leads WHERE id = p_lead_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lead not found' USING ERRCODE = 'P0002'; END IF;
  IF NOT (public.is_admin() OR v_lead.assigned_to = v_uid) THEN
    RAISE EXCEPTION 'You can only create bookings for your own leads' USING ERRCODE = '42501';
  END IF;
  IF p_booking_date > current_date + interval '1 year' OR p_booking_date < current_date - interval '1 year' THEN
    RAISE EXCEPTION 'Booking date is out of range' USING ERRCODE = '22007';
  END IF;

  SELECT * INTO v_unit FROM public.units WHERE id = p_unit_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unit not found' USING ERRCODE = 'P0002'; END IF;
  IF v_unit.status <> 'available' THEN
    RAISE EXCEPTION 'Unit is no longer available.' USING ERRCODE = '55006';
  END IF;

  BEGIN
    INSERT INTO public.bookings (lead_id, unit_id, booked_by, booking_date, amount, notes)
    VALUES (p_lead_id, p_unit_id, v_uid, p_booking_date, COALESCE(p_amount, v_unit.price), COALESCE(p_notes,''))
    RETURNING * INTO v_booking;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Unit is no longer available.' USING ERRCODE = '55006';
  END;

  UPDATE public.units SET status = 'booked' WHERE id = p_unit_id;
  UPDATE public.leads SET stage = 'booked' WHERE id = p_lead_id AND stage <> 'booked';
  RETURN v_booking;
END; $$;
REVOKE ALL ON FUNCTION public.create_booking(uuid,uuid,numeric,date,text) FROM public;
GRANT EXECUTE ON FUNCTION public.create_booking(uuid,uuid,numeric,date,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_booking(p_booking_id uuid) RETURNS public.bookings
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_booking public.bookings; v_uid uuid := auth.uid();
BEGIN
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found' USING ERRCODE = 'P0002'; END IF;
  IF NOT (public.is_admin() OR v_booking.booked_by = v_uid) THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  IF v_booking.status = 'cancelled' THEN RETURN v_booking; END IF;
  UPDATE public.bookings SET status = 'cancelled' WHERE id = p_booking_id RETURNING * INTO v_booking;
  UPDATE public.units SET status = 'available' WHERE id = v_booking.unit_id;
  RETURN v_booking;
END; $$;
REVOKE ALL ON FUNCTION public.cancel_booking(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.cancel_booking(uuid) TO authenticated;