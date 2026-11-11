-- Swapfume live update — 019 prepaid shipping labels for gifts
-- Same as supabase/migrations/019_gift_labels.sql.
-- Safe to run more than once. Run the files in this folder in number order.

-- =====================================================================
-- Swapfume — 019: prepaid shipping labels for gifts
-- Run AFTER 018. Safe to run more than once.
--   The person receiving a gift (by mail) may cover shipping by uploading a
--   prepaid shipping label (PDF or photo) bought from a carrier. Only the two
--   people in that gift can see it; the giver prints it. Never money.
--   Files live in a PRIVATE bucket "shipping-labels" at <swap id>/<file>.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('shipping-labels', 'shipping-labels', false, 5242880, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

alter table public.swaps add column if not exists label_path text;

-- The receiver may add/remove a label while the gift is accepted, by mail, and not shipped yet.
create or replace function public.can_add_gift_label(p_swap text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.swaps s
     where s.id::text = p_swap and s.is_gift and s.method = 'mail' and s.status = 'accepted'
       and s.recipient_id = auth.uid() and s.proposer_shipped_at is null);
$$;

-- Both people in the gift can open the label.
create or replace function public.can_read_gift_label(p_swap text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.swaps s
     where s.id::text = p_swap and s.is_gift and auth.uid() in (s.proposer_id, s.recipient_id));
$$;

drop policy if exists "gift receiver uploads label" on storage.objects;
create policy "gift receiver uploads label" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'shipping-labels' and public.can_add_gift_label((storage.foldername(name))[1]));

drop policy if exists "gift people read label" on storage.objects;
create policy "gift people read label" on storage.objects
  for select to authenticated
  using (bucket_id = 'shipping-labels' and public.can_read_gift_label((storage.foldername(name))[1]));

drop policy if exists "gift receiver deletes label" on storage.objects;
create policy "gift receiver deletes label" on storage.objects
  for delete to authenticated
  using (bucket_id = 'shipping-labels' and public.can_add_gift_label((storage.foldername(name))[1]));

-- Record (or clear, with null) the label on the gift. The file must be in this gift's folder.
create or replace function public.set_gift_label(p_swap bigint, p_path text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_add_gift_label(p_swap::text) then
    raise exception 'You can add a shipping label only to a gift you accepted, before it ships.';
  end if;
  if p_path is not null and (p_path not like p_swap::text || '/%' or char_length(p_path) > 200) then
    raise exception 'That label file is not in the right place.';
  end if;
  update public.swaps set label_path = p_path, updated_at = now() where id = p_swap;
end;
$$;

revoke execute on function public.set_gift_label(bigint, text) from public, anon;
grant execute on function public.set_gift_label(bigint, text) to authenticated;
revoke execute on function public.can_add_gift_label(text) from public, anon;
grant execute on function public.can_add_gift_label(text) to authenticated;
revoke execute on function public.can_read_gift_label(text) from public, anon;
grant execute on function public.can_read_gift_label(text) to authenticated;
