REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_admin() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_lead_assignment() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_booking(uuid,uuid,numeric,date,text) FROM public, anon;
REVOKE ALL ON FUNCTION public.cancel_booking(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_booking(uuid,uuid,numeric,date,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_booking(uuid) TO authenticated;