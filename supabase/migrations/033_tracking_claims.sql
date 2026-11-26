-- =====================================================================
-- Swapfume — 033: tracking numbers and "didn't arrive" claims
-- Run AFTER 032. Safe to run more than once.
--   * swaps.proposer_tracking / recipient_tracking: the tracking number for each side's
--     package, added by the sender after marking it shipped (visible to both partners).
--   * swap_claims: a partner can open a claim when a package hasn't arrived 7 days after it was
--     shipped, or arrived damaged / not as described. The other partner and the admins are told;
--     an admin resolves it with a note (both partners are told).
-- =====================================================================

alter table public.swaps add column if not exists proposer_tracking text check (char_length(proposer_tracking) <= 60);
alter table public.swaps add column if not exists recipient_tracking text check (char_length(recipient_tracking) <= 60);

create or replace function public.set_tracking(p_swap bigint, p_tracking text)
returns void language plpgsql security definer set search_path = public as $$
declare s public.swaps; v text := nullif(trim(coalesce(p_tracking, '')), '');
begin
  select * into s from public.swaps where id = p_swap;
  if not found or auth.uid() not in (s.proposer_id, s.recipient_id) then raise exception 'Not your swap.'; end if;
  if s.method = 'meetup' then raise exception 'This swap is a meet-up.'; end if;
  if v is not null and (char_length(v) > 60 or v !~ '^[A-Za-z0-9 .:#/-]+$') then raise exception 'That doesn''t look like a tracking number.'; end if;
  if auth.uid() = s.proposer_id then
    if s.proposer_shipped_at is null then raise exception 'Mark your package as shipped first.'; end if;
    update public.swaps set proposer_tracking = v, updated_at = now() where id = p_swap;
  else
    if s.recipient_shipped_at is null then raise exception 'Mark your package as shipped first.'; end if;
    update public.swaps set recipient_tracking = v, updated_at = now() where id = p_swap;
  end if;
end; $$;

create table if not exists public.swap_claims (
  id           bigint generated always as identity primary key,
  swap_id      bigint not null references public.swaps(id) on delete cascade,
  opened_by    uuid references public.profiles(id) on delete set null,
  kind         text not null check (kind in ('not_arrived', 'damaged', 'not_as_described')),
  details      text not null default '' check (char_length(details) <= 1000),
  status       text not null default 'open' check (status in ('open', 'resolved')),
  resolution   text not null default '' check (char_length(resolution) <= 1000),
  resolved_by  uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);
create index if not exists swap_claims_swap_idx on public.swap_claims (swap_id);
create unique index if not exists swap_claims_one_open on public.swap_claims (swap_id, opened_by) where status = 'open';
alter table public.swap_claims enable row level security;
revoke all on public.swap_claims from anon, authenticated;
grant select on public.swap_claims to authenticated;
drop policy if exists "see claims" on public.swap_claims;
create policy "see claims" on public.swap_claims for select to authenticated using (
  public.is_admin() or exists (select 1 from public.swaps s where s.id = swap_id and auth.uid() in (s.proposer_id, s.recipient_id)));

alter table public.notifications add column if not exists claim_id bigint references public.swap_claims(id) on delete cascade;
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'message', 'comment', 'also_commented', 'like', 'friend_request', 'friend_accept',
  'swap_proposal', 'gift', 'swap_accepted', 'swap_declined', 'swap_cancelled',
  'swap_shipped', 'swap_received', 'swap_completed', 'review',
  'meetup_join', 'meetup_comment', 'meetup_cancelled',
  'circle_join', 'circle_started', 'circle_turn', 'circle_moved', 'circle_won', 'circle_cancelled',
  'invite_joined', 'reply', 'mention', 'claim_opened', 'claim_resolved'));

create or replace function public.open_claim(p_swap bigint, p_kind text, p_details text)
returns bigint language plpgsql security definer set search_path = public as $$
declare s public.swaps; v_their_ship timestamptz; v_mine_recv timestamptz; v_other uuid; v_id bigint; r record;
begin
  if not public.is_active_member() then raise exception 'Your account cannot do this right now.'; end if;
  select * into s from public.swaps where id = p_swap;
  if not found or auth.uid() not in (s.proposer_id, s.recipient_id) then raise exception 'Not your swap.'; end if;
  if p_kind not in ('not_arrived', 'damaged', 'not_as_described') then raise exception 'Choose what went wrong.'; end if;
  if s.method = 'meetup' or s.status not in ('accepted', 'completed') then raise exception 'Claims are for mailed swaps that were accepted.'; end if;
  if auth.uid() = s.proposer_id then
    v_their_ship := s.recipient_shipped_at; v_mine_recv := s.proposer_received_at; v_other := s.recipient_id;
  else
    v_their_ship := s.proposer_shipped_at; v_mine_recv := s.recipient_received_at; v_other := s.proposer_id;
  end if;
  if s.is_gift and auth.uid() = s.proposer_id then raise exception 'You are the giver. Message the receiver instead.'; end if;
  if p_kind = 'not_arrived' then
    if v_mine_recv is not null then raise exception 'You marked it as received.'; end if;
    if v_their_ship is null or v_their_ship > now() - interval '7 days' then
      raise exception 'Give it 7 days after it was shipped. Most packages arrive within a week.';
    end if;
  elsif v_mine_recv is null and v_their_ship is null then
    raise exception 'Nothing has been shipped to you yet.';
  end if;
  if exists (select 1 from public.swap_claims where swap_id = s.id and opened_by = auth.uid() and status = 'open') then
    raise exception 'You already have an open claim on this swap.';
  end if;
  insert into public.swap_claims (swap_id, opened_by, kind, details) values (s.id, auth.uid(), p_kind, left(trim(coalesce(p_details, '')), 1000))
  returning id into v_id;
  perform public.notify(v_other, auth.uid(), 'claim_opened', null, s.id);
  for r in select id from public.profiles where is_admin and id <> auth.uid() and id is distinct from v_other loop
    perform public.notify(r.id, auth.uid(), 'claim_opened', null, s.id);
  end loop;
  update public.notifications set claim_id = v_id where kind = 'claim_opened' and swap_id = s.id and claim_id is null;
  return v_id;
end; $$;

create or replace function public.resolve_claim(p_claim bigint, p_resolution text)
returns void language plpgsql security definer set search_path = public as $$
declare c public.swap_claims; s public.swaps;
begin
  select * into c from public.swap_claims where id = p_claim for update;
  if not found then raise exception 'Claim not found.'; end if;
  if not public.is_admin() and c.opened_by is distinct from auth.uid() then raise exception 'Only an admin (or the person who opened it) can close a claim.'; end if;
  if c.status = 'resolved' then return; end if;
  update public.swap_claims set status = 'resolved', resolution = left(trim(coalesce(p_resolution, '')), 1000), resolved_by = auth.uid(), resolved_at = now() where id = c.id;
  select * into s from public.swaps where id = c.swap_id;
  perform public.notify(s.proposer_id, auth.uid(), 'claim_resolved', null, s.id, null, null, coalesce(p_resolution, ''));
  perform public.notify(s.recipient_id, auth.uid(), 'claim_resolved', null, s.id, null, null, coalesce(p_resolution, ''));
end; $$;

do $$
declare f text;
begin
  foreach f in array array['set_tracking(bigint, text)', 'open_claim(bigint, text, text)', 'resolve_claim(bigint, text)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
