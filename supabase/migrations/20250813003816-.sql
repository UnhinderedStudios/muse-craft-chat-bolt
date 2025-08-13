-- Create a public bucket for generated songs
insert into storage.buckets (id, name, public)
values ('songs', 'songs', true)
on conflict (id) do nothing;

-- Allow public read access to songs
create policy "Public can view songs"
on storage.objects
for select
using (bucket_id = 'songs');