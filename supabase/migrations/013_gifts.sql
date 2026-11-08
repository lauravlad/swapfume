-- 013: Gifts — a member can give perfume to another member with nothing asked in return.
-- A gift is a swap with is_gift = true: all items come from the giver (proposer).
-- Only the giver can start one (nobody can ask for free perfume). The receiver accepts or declines.
-- By mail: only the giver ships and only the receiver's address is shared; it completes when the receiver confirms it arrived.
-- Meet-up: same as swaps — both confirm "we met".
-- Safe to run more than once.

alter table public.swaps add column if not exists is_gift boolean not null default false;

-- Addresses: for gifts by mail, the giver sees the receiver's address, never the other way round.
drop policy if exists "read own or accepted partner address" on public.private_addresses;
create policy "read own or accepted partner address" on public.private_addresses
  for select to authenticated using (
    user_id = auth.uid()
    or exists (
      select 1 from public.swaps s
      where s.status in ('accepted', 'completed') and s.method = 'mail'
        and ((s.proposer_id = auth.uid() and s.recipient_id = private_addresses.user_id)
          or (not s.is_gift and s.recipient_id = auth.uid() and s.proposer_id = private_addresses.user_id))
    )
  );

create or replace function public.offer_gift(p_recipient uuid, p_my_items bigint[], p_message text, p_method text)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  v_swap bigint;
  v_count int;
  v_method text := coalesce(nullif(p_method, ''), 'mail');
  v_miles numeric;
begin
  if not public.is_active_member() then raise exception 'Your account cannot do this right now.'; end if;
  if v_method not in ('mail', 'meetup') then raise exception 'Choose mail or meeting in person.'; end if;
  if p_recipient = auth.uid() then raise exception 'You cannot give a gift to yourself.'; end if;
  if exists (select 1 from public.profiles where id = p_recipient and is_banned)
     or not exists (select 1 from public.profiles where id = p_recipient)
     or public.is_blocked_with(p_recipient) then
    raise exception 'This member is not available.';
  end if;
  if coalesce(array_length(p_my_items, 1), 0) = 0 then raise exception 'Pick at least one perfume to give.'; end if;
  if v_method = 'meetup' then
    v_miles := public.distance_to(p_recipient);
    if v_miles is null then raise exception 'Meeting in person needs both of you to add a ZIP code under Me.'; end if;
    if v_miles > 20 then raise exception 'Meeting in person is for members 20 miles or less apart.'; end if;
  end if;
  -- Light limit against spam: at most 5 open gift offers at a time.
  if (select count(*) from public.swaps where proposer_id = auth.uid() and is_gift and status = 'proposed') >= 5 then
    raise exception 'You have 5 gift offers waiting for an answer. Wait for those first.';
  end if;

  select count(*) into v_count from public.collection_items
   where id = any(p_my_items) and owner_id = auth.uid() and tradeable and not is_hidden;
  if v_count <> array_length(p_my_items, 1) then raise exception 'Some of your items are not available.'; end if;

  insert into public.swaps (proposer_id, recipient_id, message, method, is_gift)
  values (auth.uid(), p_recipient, left(coalesce(p_message, ''), 600), v_method, true)
  returning id into v_swap;

  insert into public.swap_items (swap_id, item_id, from_user_id, perfume_id, size, volume_ml)
  select v_swap, ci.id, ci.owner_id, ci.perfume_id, ci.size, ci.volume_ml
    from public.collection_items ci where ci.id = any(p_my_items);
  return v_swap;
end;
$$;

-- Shipping: in a gift only the giver ships.
create or replace function public.mark_shipped(p_swap bigint)
returns void language plpgsql security definer set search_path = public as $$
declare v public.swaps;
begin
  select * into v from public.swaps where id = p_swap for update;
  if not found or auth.uid() not in (v.proposer_id, v.recipient_id) then raise exception 'Not your swap.'; end if;
  if v.method = 'meetup' then raise exception 'This swap is a meet-up — confirm when you have met.'; end if;
  if v.status <> 'accepted' then raise exception 'You can mark shipping only on an accepted swap.'; end if;
  if v.is_gift and auth.uid() <> v.proposer_id then raise exception 'This is a gift to you — there is nothing for you to ship.'; end if;
  if v.proposer_id = auth.uid() then
    update public.swaps set proposer_shipped_at = coalesce(proposer_shipped_at, now()), updated_at = now() where id = p_swap;
  else
    update public.swaps set recipient_shipped_at = coalesce(recipient_shipped_at, now()), updated_at = now() where id = p_swap;
  end if;
end;
$$;

-- Receiving: a gift completes when the receiver confirms it arrived.
create or replace function public.mark_received(p_swap bigint)
returns void language plpgsql security definer set search_path = public as $$
declare v public.swaps;
begin
  select * into v from public.swaps where id = p_swap for update;
  if not found or auth.uid() not in (v.proposer_id, v.recipient_id) then raise exception 'Not your swap.'; end if;
  if v.status <> 'accepted' then raise exception 'This swap is not in progress.'; end if;
  if v.is_gift and auth.uid() = v.proposer_id then raise exception 'You are the giver — the receiver confirms when it arrives.'; end if;
  if auth.uid() = v.proposer_id then
    if v.recipient_shipped_at is null then raise exception 'They have not marked their package as shipped yet.'; end if;
    update public.swaps set proposer_received_at = coalesce(proposer_received_at, now()), updated_at = now() where id = p_swap;
  else
    if v.proposer_shipped_at is null then raise exception 'They have not marked their package as shipped yet.'; end if;
    update public.swaps set recipient_received_at = coalesce(recipient_received_at, now()), updated_at = now() where id = p_swap;
  end if;
  update public.swaps set status = 'completed', updated_at = now()
   where id = p_swap and recipient_received_at is not null and (is_gift or proposer_received_at is not null);
end;
$$;

do $$
declare f text;
begin
  foreach f in array array['offer_gift(uuid,bigint[],text,text)', 'mark_shipped(bigint)', 'mark_received(bigint)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
