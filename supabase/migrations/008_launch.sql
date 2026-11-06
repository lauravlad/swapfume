-- =====================================================================
-- Swapfume — 008: launch must-haves
--   1. 18+ only: new sign-ups must give a date of birth showing 18 or older.
--      We keep only "confirmed adult" (a date), never the birthday itself.
--      Members who joined before this migration are asked once in the app.
--   2. Blocking: a member can block another. Neither sees the other's
--      listings or wishlist, and they can't propose swaps to each other.
--   3. Delete my account: delete_my_account() clears the member's data;
--      the Edge Function supabase/functions/delete-account then removes
--      their photos and their login. Reviews they left on completed swaps
--      stay, shown as "Former member".
-- Safe to run more than once. Run after 001–007.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Age gate
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists adult_confirmed_at timestamptz;

-- true when the date is a real birthday showing 18 or older
create or replace function public.is_adult_birthdate(p date)
returns boolean language sql immutable as $$
  select p is not null and p > date '1900-01-01' and p <= (current_date - interval '18 years')::date;
$$;

-- Sign-up: the app sends {display_name, birthdate} as user metadata.
-- Under 18 -> the sign-up is refused. No birthdate (e.g. a user added from the
-- Supabase dashboard) -> the profile is created and the app asks for it later.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_birth date;
begin
  begin
    v_birth := nullif(trim(new.raw_user_meta_data ->> 'birthdate'), '')::date;
  exception when others then
    v_birth := null;
  end;
  if v_birth is not null and not public.is_adult_birthdate(v_birth) then
    raise exception 'You must be 18 or older to join Swapfume.';
  end if;
  insert into public.profiles (id, display_name, adult_confirmed_at)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1)), 40),
    case when v_birth is not null then now() end
  );
  return new;
end;
$$;

-- For members without a confirmation yet.
create or replace function public.confirm_adult(p_birthdate date)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Please sign in first.'; end if;
  if not public.is_adult_birthdate(p_birthdate) then
    raise exception 'Swapfume is only for people 18 or older.';
  end if;
  update public.profiles set adult_confirmed_at = coalesce(adult_confirmed_at, now()) where id = auth.uid();
end;
$$;

-- Members can do things (list, wish, propose, review…) only when not banned AND confirmed 18+.
create or replace function public.is_active_member()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select not is_banned and adult_confirmed_at is not null from public.profiles where id = auth.uid()), false);
$$;

-- ---------------------------------------------------------------------
-- 2. Blocking
-- ---------------------------------------------------------------------
create table if not exists public.blocks (
  blocker_id  uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  blocked_id  uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index if not exists blocks_blocked_idx on public.blocks (blocked_id);
alter table public.blocks enable row level security;
revoke all on public.blocks from anon;

-- You see only your own block list. Changes go through block_user()/unblock_user().
drop policy if exists "read own blocks" on public.blocks;
create policy "read own blocks" on public.blocks
  for select to authenticated using (blocker_id = auth.uid());
revoke insert, update, delete on public.blocks from authenticated;

-- Has either of us blocked the other? (Works for the blocked person too,
-- without letting them read the blocker's list.)
create or replace function public.is_blocked_with(p_other uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.blocks
     where (blocker_id = auth.uid() and blocked_id = p_other)
        or (blocker_id = p_other and blocked_id = auth.uid())
  );
$$;

create or replace function public.block_user(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Please sign in first.'; end if;
  if p_user = auth.uid() then raise exception 'You cannot block yourself.'; end if;
  if not exists (select 1 from public.profiles where id = p_user) then raise exception 'Member not found.'; end if;
  insert into public.blocks (blocker_id, blocked_id) values (auth.uid(), p_user) on conflict do nothing;
  -- Open proposals between the two are withdrawn. Accepted swaps carry on so
  -- packages already in the mail can still be confirmed.
  update public.swaps set status = 'cancelled', updated_at = now()
   where status = 'proposed'
     and ((proposer_id = auth.uid() and recipient_id = p_user) or (proposer_id = p_user and recipient_id = auth.uid()));
end;
$$;

create or replace function public.unblock_user(p_user uuid)
returns void language sql security definer set search_path = public as $$
  delete from public.blocks where blocker_id = auth.uid() and blocked_id = p_user;
$$;

-- Listings and wishlists of someone you blocked (or who blocked you) are hidden —
-- for admins too (admins still see hidden listings of everyone else).
drop policy if exists "read visible items" on public.collection_items;
create policy "read visible items" on public.collection_items
  for select to authenticated using (
    owner_id = auth.uid()
    or ((not is_hidden or public.is_admin()) and not public.is_blocked_with(owner_id))
  );
drop policy if exists "read wishlists" on public.wishlist_items;
create policy "read wishlists" on public.wishlist_items
  for select to authenticated using (
    user_id = auth.uid() or not public.is_blocked_with(user_id)
  );

-- propose_swap, as in 003, plus the block check.
create or replace function public.propose_swap(p_recipient uuid, p_my_items bigint[], p_their_items bigint[], p_message text)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  v_swap bigint;
  v_count int;
begin
  if not public.is_active_member() then raise exception 'Your account cannot do this right now.'; end if;
  if p_recipient = auth.uid() then raise exception 'You cannot swap with yourself.'; end if;
  if exists (select 1 from public.profiles where id = p_recipient and is_banned)
     or not exists (select 1 from public.profiles where id = p_recipient)
     or public.is_blocked_with(p_recipient) then
    raise exception 'This member is not available for swaps.';
  end if;
  if coalesce(array_length(p_my_items, 1), 0) = 0 or coalesce(array_length(p_their_items, 1), 0) = 0 then
    raise exception 'Pick at least one item from each side.';
  end if;
  if not exists (select 1 from public.private_addresses where user_id = auth.uid()) then
    raise exception 'Add your shipping address in your profile first (it stays private until a swap is accepted).';
  end if;

  select count(*) into v_count from public.collection_items
   where id = any(p_my_items) and owner_id = auth.uid() and tradeable and not is_hidden;
  if v_count <> array_length(p_my_items, 1) then raise exception 'Some of your items are not available for trade.'; end if;

  select count(*) into v_count from public.collection_items
   where id = any(p_their_items) and owner_id = p_recipient and tradeable and not is_hidden;
  if v_count <> array_length(p_their_items, 1) then raise exception 'Some of their items are no longer available.'; end if;

  insert into public.swaps (proposer_id, recipient_id, message)
  values (auth.uid(), p_recipient, left(coalesce(p_message, ''), 600))
  returning id into v_swap;

  insert into public.swap_items (swap_id, item_id, from_user_id, perfume_id, size, volume_ml)
  select v_swap, ci.id, ci.owner_id, ci.perfume_id, ci.size, ci.volume_ml
    from public.collection_items ci
   where ci.id = any(p_my_items) or ci.id = any(p_their_items);

  return v_swap;
end;
$$;

-- respond_swap: also refuse to accept if a block happened in between.
-- (Same as 003 otherwise.)
create or replace function public.respond_swap(p_swap bigint, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v public.swaps;
begin
  select * into v from public.swaps where id = p_swap for update;
  if not found or v.recipient_id is distinct from auth.uid() then raise exception 'Only the person who received this proposal can answer it.'; end if;
  if v.status <> 'proposed' then raise exception 'This proposal has already been answered.'; end if;
  if p_accept then
    if not public.is_active_member() then raise exception 'Your account cannot do this right now.'; end if;
    if v.proposer_id is null or public.is_blocked_with(v.proposer_id) then raise exception 'This member is not available for swaps.'; end if;
    if not exists (select 1 from public.private_addresses where user_id = auth.uid()) then
      raise exception 'Add your shipping address in your profile before accepting.';
    end if;
  end if;
  update public.swaps set status = case when p_accept then 'accepted' else 'declined' end, updated_at = now() where id = p_swap;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Delete my account
-- ---------------------------------------------------------------------
-- Keep the swap history (and the reviews written in it) when one side leaves:
-- their id becomes empty, and the app shows "Former member".
alter table public.swaps alter column proposer_id drop not null;
alter table public.swaps alter column recipient_id drop not null;
alter table public.swaps drop constraint if exists swaps_proposer_id_fkey;
alter table public.swaps add constraint swaps_proposer_id_fkey foreign key (proposer_id) references public.profiles(id) on delete set null;
alter table public.swaps drop constraint if exists swaps_recipient_id_fkey;
alter table public.swaps add constraint swaps_recipient_id_fkey foreign key (recipient_id) references public.profiles(id) on delete set null;

alter table public.swap_items alter column from_user_id drop not null;
alter table public.swap_items drop constraint if exists swap_items_from_user_id_fkey;
alter table public.swap_items add constraint swap_items_from_user_id_fkey foreign key (from_user_id) references public.profiles(id) on delete set null;

-- Reviews the leaving member WROTE stay (anonymous). Reviews ABOUT them go with them.
alter table public.reviews alter column reviewer_id drop not null;
alter table public.reviews drop constraint if exists reviews_reviewer_id_fkey;
alter table public.reviews add constraint reviews_reviewer_id_fkey foreign key (reviewer_id) references public.profiles(id) on delete set null;

-- A report about a listing that is later deleted keeps its text for the admins.
alter table public.reports drop constraint if exists reports_check;

-- Step 1 of deleting an account (the Edge Function calls this as the member,
-- then deletes their photos and login, which removes the profile row and,
-- through the rules above, everything else tied to it).
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public as $$
declare v uuid := auth.uid();
begin
  if v is null then raise exception 'Please sign in first.'; end if;
  if exists (select 1 from public.swaps where status = 'accepted' and v in (proposer_id, recipient_id)) then
    raise exception 'You have a swap in progress. Finish it (both packages received) before deleting your account, or contact support for help.';
  end if;
  -- Withdraw open proposals, sent or received, so the other side isn't left waiting.
  update public.swaps set status = 'cancelled', updated_at = now()
   where status = 'proposed' and v in (proposer_id, recipient_id);
  delete from public.wishlist_items where user_id = v;
  delete from public.collection_items where owner_id = v;
  delete from public.private_addresses where user_id = v;
  delete from public.blocks where blocker_id = v or blocked_id = v;
  delete from public.note_suggestions where suggested_by = v;
  delete from public.reviews where reviewee_id = v;
  update public.profiles set bio = '', city = '', country = '' where id = v;
end;
$$;

-- Only signed-in members may call the new functions.
do $$
declare f text;
begin
  foreach f in array array[
    'confirm_adult(date)', 'is_blocked_with(uuid)', 'block_user(uuid)', 'unblock_user(uuid)',
    'propose_swap(uuid,bigint[],bigint[],text)', 'respond_swap(bigint,boolean)', 'delete_my_account()'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 4. Catalog: a few more perfumes (Asian houses). Generated by tools/make-seed-sql.js.
-- ---------------------------------------------------------------------
-- BEGIN GENERATED CATALOG
-- The new perfumes are added by migration 009 (or supabase/live-update/).
-- END GENERATED CATALOG
