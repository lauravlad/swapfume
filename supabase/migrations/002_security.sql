-- =====================================================================
-- Swapfume perfume swap — 002: who may see and change what (row-level security)
-- Everything requires being signed in. Visitors who are not logged in see nothing.
-- Swap status changes go through the functions in 003, never direct edits,
-- so nobody can e.g. mark the other person's package as received.
-- =====================================================================

-- Small helpers -------------------------------------------------------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_active_member()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select not is_banned from public.profiles where id = auth.uid()), false);
$$;

-- Turn RLS on everywhere ------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.private_addresses enable row level security;
alter table public.perfumes          enable row level security;
alter table public.collection_items  enable row level security;
alter table public.wishlist_items    enable row level security;
alter table public.swaps             enable row level security;
alter table public.swap_items        enable row level security;
alter table public.reviews           enable row level security;
alter table public.reports           enable row level security;

-- Visitors who are not logged in get nothing.
revoke all on all tables in schema public from anon;

-- profiles: everyone signed in can read; you can edit only your own name/city/country/bio.
create policy "profiles readable by members" on public.profiles
  for select to authenticated using (true);
create policy "edit own profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated;
grant update (display_name, city, country, bio) on public.profiles to authenticated;

-- private_addresses: yours, or your partner's once a swap between you is accepted.
create policy "read own or accepted partner address" on public.private_addresses
  for select to authenticated using (
    user_id = auth.uid()
    or exists (
      select 1 from public.swaps s
      where s.status in ('accepted', 'completed')
        and ((s.proposer_id = auth.uid() and s.recipient_id = private_addresses.user_id)
          or (s.recipient_id = auth.uid() and s.proposer_id = private_addresses.user_id))
    )
  );
create policy "insert own address" on public.private_addresses
  for insert to authenticated with check (user_id = auth.uid());
create policy "update own address" on public.private_addresses
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- perfumes: approved ones are public to members; you also see your own requests; admins see all.
-- New perfumes are added only through request_perfume() (see 003), which checks duplicates.
create policy "read approved or own requests" on public.perfumes
  for select to authenticated using (status = 'approved' or requested_by = auth.uid() or public.is_admin());
create policy "admins edit catalog" on public.perfumes
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- collection_items: visible to members unless hidden by an admin; you manage your own.
create policy "read visible items" on public.collection_items
  for select to authenticated using (not is_hidden or owner_id = auth.uid() or public.is_admin());
create policy "add own items" on public.collection_items
  for insert to authenticated with check (owner_id = auth.uid() and public.is_active_member() and not is_hidden);
create policy "edit own items" on public.collection_items
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "delete own items" on public.collection_items
  for delete to authenticated using (owner_id = auth.uid());
revoke update on public.collection_items from authenticated;
grant update (size, volume_ml, fill_pct, tradeable, photo_url, note) on public.collection_items to authenticated;

-- wishlist_items: readable by members (needed for matching); you manage your own.
create policy "read wishlists" on public.wishlist_items
  for select to authenticated using (true);
create policy "add own wish" on public.wishlist_items
  for insert to authenticated with check (user_id = auth.uid() and public.is_active_member());
create policy "delete own wish" on public.wishlist_items
  for delete to authenticated using (user_id = auth.uid());

-- swaps + swap_items: only the two people involved (and admins) can see them.
-- No insert/update policies: changes happen only through the functions in 003.
create policy "participants read swaps" on public.swaps
  for select to authenticated using (auth.uid() in (proposer_id, recipient_id) or public.is_admin());
create policy "participants read swap items" on public.swap_items
  for select to authenticated using (
    exists (select 1 from public.swaps s where s.id = swap_id
            and (auth.uid() in (s.proposer_id, s.recipient_id) or public.is_admin()))
  );

-- reviews: public to members; only a participant of a COMPLETED swap may review
-- the other participant, once (the unique constraint in 001 enforces "once").
create policy "read reviews" on public.reviews
  for select to authenticated using (true);
create policy "review your swap partner" on public.reviews
  for insert to authenticated with check (
    reviewer_id = auth.uid()
    and public.is_active_member()
    and exists (
      select 1 from public.swaps s
      where s.id = swap_id and s.status = 'completed'
        and ((s.proposer_id = auth.uid() and s.recipient_id = reviewee_id)
          or (s.recipient_id = auth.uid() and s.proposer_id = reviewee_id))
    )
  );

-- reports: anyone signed in can file one; only admins (and the reporter) can read them.
create policy "file a report" on public.reports
  for insert to authenticated with check (reporter_id = auth.uid() and status = 'open');
create policy "read own reports or admin" on public.reports
  for select to authenticated using (reporter_id = auth.uid() or public.is_admin());
create policy "admins resolve reports" on public.reports
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
