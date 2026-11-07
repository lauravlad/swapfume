-- Swapfume live update — 012 general-area map on profiles
-- Same as supabase/migrations/012_area_map.sql.
-- Safe to run more than once. Run the files in this folder in number order.

-- =====================================================================
-- Swapfume — 012: general-area map on profiles
--   member_area() returns a deliberately blurred point for a member who has
--   added a ZIP code: latitude/longitude rounded to 0.1° (a grid of roughly
--   7 × 5 miles), so a small map of their general area can be shown without
--   revealing the ZIP code. Only for signed-in members, never between
--   blocked members. Safe to run more than once. Run after 001–011.
-- =====================================================================

create or replace function public.member_area(p_user uuid)
returns table (lat numeric, lon numeric)
language sql stable security definer set search_path = public as $$
  select round(l.lat, 1), round(l.lon, 1)
    from public.private_locations l
   where l.user_id = p_user
     and auth.uid() is not null
     and (p_user = auth.uid() or (public.is_active_member() and not public.is_blocked_with(p_user)));
$$;

revoke execute on function public.member_area(uuid) from public, anon;
grant execute on function public.member_area(uuid) to authenticated;
