create table if not exists public.poem_likes (
  poem_id text not null check (length(poem_id) between 1 and 100),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (poem_id, user_id)
);

create index if not exists poem_likes_poem_id_idx
  on public.poem_likes (poem_id);

alter table public.poem_likes enable row level security;

revoke all on table public.poem_likes from public, anon, authenticated;
grant select, insert, delete on table public.poem_likes to authenticated;

drop policy if exists "Users can read their own poem likes"
  on public.poem_likes;
create policy "Users can read their own poem likes"
  on public.poem_likes
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can like poems as themselves"
  on public.poem_likes;
create policy "Users can like poems as themselves"
  on public.poem_likes
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can remove their own poem likes"
  on public.poem_likes;
create policy "Users can remove their own poem likes"
  on public.poem_likes
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.get_poem_like_counts()
returns table (poem_id text, likes_count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select likes.poem_id, count(*)
  from public.poem_likes as likes
  group by likes.poem_id;
$$;

revoke all on function public.get_poem_like_counts() from public;
grant execute on function public.get_poem_like_counts() to anon, authenticated;