-- =====================================================================
-- Swapfume — 031: sign in with Google/Apple, and invite links
-- Run AFTER 030. Safe to run more than once.
--   * handle_new_user(): a Google/Apple sign-up has no birthdate or display name in its
--     metadata. It now uses the first name from the provider, and (as before) leaves the
--     18+ check for the "Please confirm your age" screen, so nobody skips it.
--   * invite_codes: each member's personal link (swapfume.com/?invite=CODE). Kept in its own
--     table that only its owner can read (profiles are visible to other members).
--   * invite_preview(code): the inviter's display name for the welcome page (anyone may ask;
--     nothing else is shared).
--   * claim_invite(code): a member who joined in the last 7 days through a link becomes friends
--     with the person who invited them, once; the inviter gets a notification.
-- =====================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_birth date;
  v_adult boolean;
  v_cc text;
  v_name text;
begin
  begin
    v_birth := nullif(trim(new.raw_user_meta_data ->> 'birthdate'), '')::date;
  exception when others then
    v_birth := null;
  end;
  if v_birth is not null and not public.is_adult_birthdate(v_birth) then
    raise exception 'You must be 18 or older to join Swapfume.';
  end if;
  v_adult := v_birth is not null or coalesce((new.raw_user_meta_data ->> 'adult_ok')::boolean, false);
  v_cc := upper(coalesce(nullif(trim(new.raw_user_meta_data ->> 'country_code'), ''), 'US'));
  if v_cc not in ('US', 'CA', 'RO') then v_cc := 'US'; end if;
  -- Email sign-up: the name they typed. Google/Apple: their first name. Otherwise: the email's start.
  v_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
                     nullif(split_part(trim(coalesce(new.raw_user_meta_data ->> 'given_name', new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')), ' ', 1), ''),
                     split_part(new.email, '@', 1));
  insert into public.profiles (id, display_name, adult_confirmed_at, country_code, country)
  values (new.id, left(v_name, 40), case when v_adult then now() end, v_cc, public.country_name(v_cc));
  return new;
end;
$$;

-- ---------- invite links ----------
alter table public.profiles add column if not exists invited_by uuid references public.profiles(id) on delete set null;

create or replace function public.new_invite_code() returns text language sql volatile as $$
  select string_agg(substr('abcdefghjkmnpqrstuvwxyz23456789', 1 + floor(random() * 31)::int, 1), '') from generate_series(1, 10);
$$;
create table if not exists public.invite_codes (
  user_id  uuid primary key references public.profiles(id) on delete cascade,
  code     text not null unique default public.new_invite_code(),
  created_at timestamptz not null default now()
);
alter table public.invite_codes enable row level security;
revoke all on public.invite_codes from anon, authenticated;
grant select on public.invite_codes to authenticated;
drop policy if exists "read own invite code" on public.invite_codes;
create policy "read own invite code" on public.invite_codes for select to authenticated using (user_id = auth.uid());

-- My code (made on first ask).
create or replace function public.my_invite_code()
returns text language plpgsql security definer set search_path = public as $$
declare v text;
begin
  if auth.uid() is null then return null; end if;
  insert into public.invite_codes (user_id) values (auth.uid()) on conflict (user_id) do nothing;
  select code into v from public.invite_codes where user_id = auth.uid();
  return v;
end; $$;
revoke execute on function public.my_invite_code() from public, anon;
grant execute on function public.my_invite_code() to authenticated;

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'message', 'comment', 'also_commented', 'like', 'friend_request', 'friend_accept',
  'swap_proposal', 'gift', 'swap_accepted', 'swap_declined', 'swap_cancelled',
  'swap_shipped', 'swap_received', 'swap_completed', 'review',
  'meetup_join', 'meetup_comment', 'meetup_cancelled',
  'circle_join', 'circle_started', 'circle_turn', 'circle_moved', 'circle_won', 'circle_cancelled',
  'invite_joined'));

create or replace function public.invite_preview(p_code text)
returns text language sql stable security definer set search_path = public as $$
  select p.display_name from public.invite_codes c join public.profiles p on p.id = c.user_id
   where c.code = lower(trim(p_code)) and not p.is_banned limit 1;
$$;
revoke execute on function public.invite_preview(text) from public;
grant execute on function public.invite_preview(text) to anon, authenticated;

create or replace function public.claim_invite(p_code text)
returns text language plpgsql security definer set search_path = public as $$
declare v_from uuid; v_me public.profiles; a uuid; b uuid;
begin
  select * into v_me from public.profiles where id = auth.uid();
  if not found or v_me.invited_by is not null or v_me.created_at < now() - interval '7 days' then return null; end if;
  select c.user_id into v_from from public.invite_codes c join public.profiles p on p.id = c.user_id
   where c.code = lower(trim(p_code)) and not p.is_banned;
  if v_from is null or v_from = auth.uid() or public.is_blocked_with(v_from) then return null; end if;
  update public.profiles set invited_by = v_from where id = auth.uid();
  a := least(v_from, auth.uid()); b := greatest(v_from, auth.uid());
  insert into public.friendships (user_a, user_b, requested_by, status, accepted_at) values (a, b, v_from, 'accepted', now())
  on conflict (user_a, user_b) do update set status = 'accepted', accepted_at = coalesce(public.friendships.accepted_at, now());
  perform public.notify(v_from, auth.uid(), 'invite_joined');
  return (select display_name from public.profiles where id = v_from);
end; $$;
revoke execute on function public.claim_invite(text) from public, anon;
grant execute on function public.claim_invite(text) to authenticated;
revoke execute on function public.new_invite_code() from public, anon, authenticated;
