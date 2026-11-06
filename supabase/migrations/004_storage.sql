-- =====================================================================
-- Swapfume perfume swap — 004: photo storage
-- A public "bottle-photos" bucket. Anyone with the link can view a photo
-- (so <img> tags work), but members can only upload/delete inside their
-- own folder:  bottle-photos/<their user id>/...
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('bottle-photos', 'bottle-photos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "members upload to own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'bottle-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "members replace own photos" on storage.objects
  for update to authenticated
  using (bucket_id = 'bottle-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "members delete own photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'bottle-photos' and (storage.foldername(name))[1] = auth.uid()::text);
