-- =====================================================================
-- Swapfume — 010: members suggest catalog photos; profile photos (avatars)
--   A member uploads a photo of a bottle they own (into their own folder in
--   the bottle-photos bucket) and suggests it as a perfume's catalog picture.
--   An admin approves or rejects it. Approved photos become the perfume's
--   picture, credited "Photo by <member>".
-- Safe to run more than once. Run after 001–009.
-- =====================================================================

create table if not exists public.photo_suggestions (
  id            bigint generated always as identity primary key,
  perfume_id    bigint not null references public.perfumes(id) on delete cascade,
  suggested_by  uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  image_url     text not null check (char_length(image_url) <= 500),
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at    timestamptz not null default now()
);
create index if not exists photo_suggestions_status_idx on public.photo_suggestions (status, created_at);

alter table public.photo_suggestions enable row level security;
revoke all on public.photo_suggestions from anon;

-- Members may suggest only photos stored in their own folder, for approved perfumes.
drop policy if exists "suggest a photo" on public.photo_suggestions;
create policy "suggest a photo" on public.photo_suggestions
  for insert to authenticated with check (
    suggested_by = auth.uid() and status = 'pending' and public.is_active_member()
    and image_url like '%/bottle-photos/' || auth.uid()::text || '/%'
    and exists (select 1 from public.perfumes p where p.id = perfume_id and p.status = 'approved')
  );
drop policy if exists "read own photo suggestions or admin" on public.photo_suggestions;
create policy "read own photo suggestions or admin" on public.photo_suggestions
  for select to authenticated using (suggested_by = auth.uid() or public.is_admin());
revoke update, delete on public.photo_suggestions from authenticated;

create or replace function public.admin_review_photo_suggestion(p_id bigint, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare s public.photo_suggestions; v_name text;
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  select * into s from public.photo_suggestions where id = p_id and status = 'pending' for update;
  if not found then return; end if;
  if p_approve then
    select display_name into v_name from public.profiles where id = s.suggested_by;
    update public.perfumes
       set image_url = s.image_url,
           image_credit = left('Photo by ' || coalesce(v_name, 'a member'), 200)
     where id = s.perfume_id;
  end if;
  update public.photo_suggestions set status = case when p_approve then 'approved' else 'rejected' end where id = p_id;
end;
$$;

revoke execute on function public.admin_review_photo_suggestion(bigint, boolean) from public, anon;
grant execute on function public.admin_review_photo_suggestion(bigint, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- Profile photos (avatars)
-- Members set their own photo through set_my_avatar(), which only accepts
-- a photo stored in their own folder (so nobody can point to outside images).
-- Admins can remove an inappropriate one.
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists avatar_url text check (avatar_url is null or char_length(avatar_url) <= 500);

create or replace function public.set_my_avatar(p_url text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Please sign in first.'; end if;
  if p_url is not null and p_url not like '%/bottle-photos/' || auth.uid()::text || '/%' then
    raise exception 'Please upload the photo from the app.';
  end if;
  update public.profiles set avatar_url = nullif(trim(coalesce(p_url, '')), '') where id = auth.uid();
end;
$$;

create or replace function public.admin_clear_avatar(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  update public.profiles set avatar_url = null where id = p_user;
end;
$$;

revoke execute on function public.set_my_avatar(text) from public, anon;
revoke execute on function public.admin_clear_avatar(uuid) from public, anon;
grant execute on function public.set_my_avatar(text) to authenticated;
grant execute on function public.admin_clear_avatar(uuid) to authenticated;
