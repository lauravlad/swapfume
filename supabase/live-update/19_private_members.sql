-- Swapfume live update — 018 nobody but admins can count the members
-- Same as supabase/migrations/018_private_members.sql.
-- Safe to run more than once. Run the files in this folder in number order.

-- =====================================================================
-- Swapfume — 018: nobody but admins can count the members
-- Run AFTER 017. Safe to run more than once.
--   Before: every signed-in member could read every profile (so, with a
--   little technical skill, count them all).
--   Now a member can read a profile only when that person is visible in the
--   community anyway: they list a perfume, have a wishlist, have swapped,
--   written or received a review, organize/joined/commented on a meetup —
--   plus their own profile, and people they blocked (for the Blocked list).
--   Admins still see everyone. A member you know can be found by their full
--   display name (find_members) and opened from their link (get_member).
-- =====================================================================

create or replace function public.profile_visible(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
       p_id = auth.uid()
    or public.is_admin()
    or exists (select 1 from public.collection_items where owner_id = p_id)
    or exists (select 1 from public.wishlist_items where user_id = p_id)
    or exists (select 1 from public.swaps where p_id in (proposer_id, recipient_id))
    or exists (select 1 from public.reviews where p_id in (reviewer_id, reviewee_id))
    or exists (select 1 from public.perfume_reviews where user_id = p_id)
    or exists (select 1 from public.events where organizer_id = p_id)
    or exists (select 1 from public.event_attendees where user_id = p_id)
    or exists (select 1 from public.event_comments where user_id = p_id)
    or exists (select 1 from public.blocks where blocker_id = auth.uid() and blocked_id = p_id)
  );
$$;
revoke execute on function public.profile_visible(uuid) from public, anon;
grant execute on function public.profile_visible(uuid) to authenticated;

drop policy if exists "profiles readable by members" on public.profiles;
drop policy if exists "profiles visible in the community" on public.profiles;
create policy "profiles visible in the community" on public.profiles
  for select to authenticated using (public.profile_visible(id));

-- ---------------------------------------------------------------------
-- Finding a member you know: by their full display name (not case- or
-- accent-sensitive). No partial matches, so nobody can page through everyone.
-- ---------------------------------------------------------------------
create or replace function public.find_members(p_name text)
returns table (id uuid, display_name text, city text, country text, country_code text, avatar_url text)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name, p.city, p.country, p.country_code, p.avatar_url
    from public.profiles p
   where auth.uid() is not null and public.is_active_member()
     and char_length(trim(coalesce(p_name, ''))) >= 2
     and public.norm_text(p.display_name) = public.norm_text(p_name)
     and not p.is_banned and p.adult_confirmed_at is not null
     and not public.is_blocked_with(p.id)
   order by p.created_at
   limit 20;
$$;

-- Opening a member's page when you already have their link (an unguessable id),
-- e.g. from "Find a member": the public profile fields only.
create or replace function public.get_member(p_id uuid)
returns table (id uuid, display_name text, city text, country text, country_code text, bio text, avatar_url text, is_banned boolean, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name, p.city, p.country, p.country_code, p.bio, p.avatar_url, p.is_banned, p.created_at
    from public.profiles p
   where p.id = p_id and auth.uid() is not null and public.is_active_member()
     and p.adult_confirmed_at is not null;
$$;

revoke execute on function public.find_members(text) from public, anon;
grant execute on function public.find_members(text) to authenticated;
revoke execute on function public.get_member(uuid) from public, anon;
grant execute on function public.get_member(uuid) to authenticated;
