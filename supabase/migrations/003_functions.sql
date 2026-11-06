-- =====================================================================
-- Swapfume perfume swap — 003: actions (the app calls these as "RPCs")
-- Each one checks who is calling and whether the step is allowed.
-- =====================================================================

-- Ask for a perfume to be added to the catalog --------------------------------
-- Returns {"result": "exists" | "already_requested" | "requested", "id": ..., "similar": [...]}
create or replace function public.request_perfume(p_brand text, p_name text, p_concentration text, p_year int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_key text := public.norm_text(p_brand) || '|' || public.norm_text(p_name) || '|' || public.norm_text(p_concentration);
  v_row public.perfumes;
  v_id bigint;
begin
  if not public.is_active_member() then raise exception 'Your account cannot do this right now.'; end if;
  if public.norm_text(p_brand) = '' or public.norm_text(p_name) = '' then
    raise exception 'Please fill in both the brand and the perfume name.';
  end if;

  select * into v_row from public.perfumes where norm_key = v_key and status <> 'rejected' limit 1;
  if found then
    return jsonb_build_object('result', case when v_row.status = 'approved' then 'exists' else 'already_requested' end,
                              'id', v_row.id);
  end if;

  insert into public.perfumes (brand, name, concentration, year, status, requested_by)
  values (trim(p_brand), trim(p_name), trim(coalesce(p_concentration, '')), p_year, 'pending', auth.uid())
  returning id into v_id;
  return jsonb_build_object('result', 'requested', 'id', v_id);
end;
$$;

-- Propose a swap ----------------------------------------------------------------
create or replace function public.propose_swap(p_recipient uuid, p_my_items bigint[], p_their_items bigint[], p_message text)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  v_swap bigint;
  v_count int;
begin
  if not public.is_active_member() then raise exception 'Your account cannot do this right now.'; end if;
  if p_recipient = auth.uid() then raise exception 'You cannot swap with yourself.'; end if;
  if exists (select 1 from public.profiles where id = p_recipient and is_banned) then
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

-- Accept or decline (recipient only) -------------------------------------------------
create or replace function public.respond_swap(p_swap bigint, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v public.swaps;
begin
  select * into v from public.swaps where id = p_swap for update;
  if not found or v.recipient_id <> auth.uid() then raise exception 'Only the person who received this proposal can answer it.'; end if;
  if v.status <> 'proposed' then raise exception 'This proposal has already been answered.'; end if;
  if p_accept then
    if not public.is_active_member() then raise exception 'Your account cannot do this right now.'; end if;
    if not exists (select 1 from public.private_addresses where user_id = auth.uid()) then
      raise exception 'Add your shipping address in your profile before accepting.';
    end if;
  end if;
  update public.swaps set status = case when p_accept then 'accepted' else 'declined' end, updated_at = now()
   where id = p_swap;
end;
$$;

-- Withdraw a proposal (proposer only, before it is answered) -------------------------
create or replace function public.cancel_swap(p_swap bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.swaps set status = 'cancelled', updated_at = now()
   where id = p_swap and proposer_id = auth.uid() and status = 'proposed';
  if not found then raise exception 'This proposal cannot be withdrawn.'; end if;
end;
$$;

-- "I've shipped my package" -------------------------------------------------------------
create or replace function public.mark_shipped(p_swap bigint)
returns void language plpgsql security definer set search_path = public as $$
declare v public.swaps;
begin
  select * into v from public.swaps where id = p_swap for update;
  if not found or auth.uid() not in (v.proposer_id, v.recipient_id) then raise exception 'Not your swap.'; end if;
  if v.status <> 'accepted' then raise exception 'You can mark shipping only on an accepted swap.'; end if;
  if auth.uid() = v.proposer_id then
    update public.swaps set proposer_shipped_at = coalesce(proposer_shipped_at, now()), updated_at = now() where id = p_swap;
  else
    update public.swaps set recipient_shipped_at = coalesce(recipient_shipped_at, now()), updated_at = now() where id = p_swap;
  end if;
end;
$$;

-- "I received their package" — when both have received, the swap is completed ---------
create or replace function public.mark_received(p_swap bigint)
returns void language plpgsql security definer set search_path = public as $$
declare v public.swaps;
begin
  select * into v from public.swaps where id = p_swap for update;
  if not found or auth.uid() not in (v.proposer_id, v.recipient_id) then raise exception 'Not your swap.'; end if;
  if v.status <> 'accepted' then raise exception 'This swap is not in progress.'; end if;
  if auth.uid() = v.proposer_id then
    if v.recipient_shipped_at is null then raise exception 'They have not marked their package as shipped yet.'; end if;
    update public.swaps set proposer_received_at = coalesce(proposer_received_at, now()), updated_at = now() where id = p_swap;
  else
    if v.proposer_shipped_at is null then raise exception 'They have not marked their package as shipped yet.'; end if;
    update public.swaps set recipient_received_at = coalesce(recipient_received_at, now()), updated_at = now() where id = p_swap;
  end if;
  update public.swaps set status = 'completed', updated_at = now()
   where id = p_swap and proposer_received_at is not null and recipient_received_at is not null;
end;
$$;

-- Trust badge numbers for a list of members ------------------------------------------
create or replace function public.profile_stats(p_user_ids uuid[])
returns table (user_id uuid, completed_swaps int, avg_rating numeric, review_count int)
language sql stable security definer set search_path = public as $$
  select u.id,
         (select count(*)::int from public.swaps s
           where s.status = 'completed' and u.id in (s.proposer_id, s.recipient_id)),
         (select round(avg(r.rating)::numeric, 1) from public.reviews r where r.reviewee_id = u.id),
         (select count(*)::int from public.reviews r where r.reviewee_id = u.id)
    from unnest(p_user_ids) as u(id)
   where auth.uid() is not null;
$$;

-- Admin tools ----------------------------------------------------------------------------
create or replace function public.admin_review_perfume(p_id bigint, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  update public.perfumes set status = case when p_approve then 'approved' else 'rejected' end
   where id = p_id and status = 'pending';
end;
$$;

create or replace function public.admin_set_ban(p_user uuid, p_banned boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  if p_user = auth.uid() then raise exception 'You cannot ban yourself.'; end if;
  update public.profiles set is_banned = p_banned where id = p_user;
  if p_banned then
    -- hide their listings and close their open proposals
    update public.collection_items set tradeable = false where owner_id = p_user;
    update public.swaps set status = 'cancelled', updated_at = now()
     where status = 'proposed' and p_user in (proposer_id, recipient_id);
  end if;
end;
$$;

create or replace function public.admin_set_item_hidden(p_item bigint, p_hidden boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  update public.collection_items set is_hidden = p_hidden where id = p_item;
end;
$$;

-- Only signed-in members may call these.
do $$
declare f text;
begin
  foreach f in array array[
    'request_perfume(text,text,text,int)', 'propose_swap(uuid,bigint[],bigint[],text)',
    'respond_swap(bigint,boolean)', 'cancel_swap(bigint)', 'mark_shipped(bigint)', 'mark_received(bigint)',
    'profile_stats(uuid[])', 'admin_review_perfume(bigint,boolean)', 'admin_set_ban(uuid,boolean)',
    'admin_set_item_hidden(bigint,boolean)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
