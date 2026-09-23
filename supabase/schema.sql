-- Meh Rean — Supabase schema
-- Run this once in the Supabase SQL editor (or via `supabase db push`).
-- It is safe to re-run: every object is created with "if not exists" or replaced.

create extension if not exists unaccent with schema extensions;

-- ---------------------------------------------------------------- tables ----

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  username text unique not null check (username ~ '^[a-z0-9._]{3,20}$'),
  display_name text not null,
  bio text not null default '',
  school text not null default '',
  country text not null default '',
  field_of_study text not null default '',
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  body text not null default '',
  subject text not null,
  level text not null,
  tags text[] not null default '{}',
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts on delete cascade,
  author_id uuid not null references public.profiles on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table if not exists public.reactions (
  post_id uuid not null references public.posts on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  type text not null check (type in ('like', 'love', 'insightful', 'thanks', 'wow')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.ratings (
  post_id uuid not null references public.posts on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  value smallint not null check (value between 1 and 5),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.saves (
  post_id uuid not null references public.posts on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists posts_created_idx on public.posts (created_at desc);
create index if not exists posts_author_idx on public.posts (author_id);
create index if not exists posts_subject_idx on public.posts (subject);
create index if not exists posts_tags_idx on public.posts using gin (tags);
create index if not exists comments_post_idx on public.comments (post_id);

-- ------------------------------------------------------- new user profile ---

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(
      nullif(lower(new.raw_user_meta_data ->> 'username'), ''),
      'user' || left(replace(new.id::text, '-', ''), 8)
    ),
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), 'Student')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------------ RLS -----

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.reactions enable row level security;
alter table public.ratings enable row level security;
alter table public.saves enable row level security;

drop policy if exists "profiles are public" on public.profiles;
create policy "profiles are public" on public.profiles for select using (true);

drop policy if exists "insert own profile" on public.profiles;
create policy "insert own profile" on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "posts are public" on public.posts;
create policy "posts are public" on public.posts for select using (true);

drop policy if exists "insert own posts" on public.posts;
create policy "insert own posts" on public.posts for insert with check (auth.uid() = author_id);

drop policy if exists "update own posts" on public.posts;
create policy "update own posts" on public.posts for update using (auth.uid() = author_id) with check (auth.uid() = author_id);

drop policy if exists "delete own posts" on public.posts;
create policy "delete own posts" on public.posts for delete using (auth.uid() = author_id);

drop policy if exists "comments are public" on public.comments;
create policy "comments are public" on public.comments for select using (true);

drop policy if exists "insert own comments" on public.comments;
create policy "insert own comments" on public.comments for insert with check (auth.uid() = author_id);

-- A comment can be removed by its author or by the author of the post
drop policy if exists "delete own or hosted comments" on public.comments;
create policy "delete own or hosted comments" on public.comments for delete using (
  auth.uid() = author_id
  or auth.uid() = (select author_id from public.posts where posts.id = comments.post_id)
);

drop policy if exists "reactions are public" on public.reactions;
create policy "reactions are public" on public.reactions for select using (true);

drop policy if exists "write own reactions" on public.reactions;
create policy "write own reactions" on public.reactions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "ratings are public" on public.ratings;
create policy "ratings are public" on public.ratings for select using (true);

-- You may rate any post except your own
drop policy if exists "write own ratings" on public.ratings;
create policy "write own ratings" on public.ratings for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and auth.uid() <> (select author_id from public.posts where posts.id = ratings.post_id)
  );

-- Saves are private to the person who made them
drop policy if exists "read own saves" on public.saves;
create policy "read own saves" on public.saves for select using (auth.uid() = user_id);

drop policy if exists "write own saves" on public.saves;
create policy "write own saves" on public.saves for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- --------------------------------------------------------------- views ------

create or replace view public.school_stats with (security_invoker = on) as
select
  p.school as name,
  (array_agg(p.country order by p.country) filter (where p.country <> ''))[1] as country,
  count(distinct p.id)::int as students,
  count(po.id)::int as posts
from public.profiles p
left join public.posts po on po.author_id = p.id
where length(btrim(p.school)) > 0
group by p.school;

create or replace view public.tag_stats with (security_invoker = on) as
select tag, count(*)::int as posts
from public.posts, unnest(posts.tags) as tag
group by tag;

create or replace view public.subject_stats with (security_invoker = on) as
select subject, count(*)::int as posts
from public.posts
group by subject;

-- profile_stats is defined further down, once follows exists.

-- ------------------------------------------------------------ functions -----

create or replace function public.username_available(name text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select not exists (select 1 from public.profiles where username = lower(name));
$$;

-- Ids of posts matching free text across the post and its author
create or replace function public.search_post_ids(q text)
returns setof uuid
language sql
stable
set search_path = ''
as $$
  select po.id
  from public.posts po
  join public.profiles pr on pr.id = po.author_id
  where extensions.unaccent(
      po.title || ' ' || po.body || ' ' || replace(po.subject, '-', ' ') || ' ' ||
      array_to_string(po.tags, ' ') || ' ' || pr.display_name || ' ' || pr.username || ' ' ||
      pr.school || ' ' || pr.country
    ) ilike '%' || extensions.unaccent(q) || '%';
$$;

-- Lets a signed-in person delete their own account and everything it owns
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;

-- -------------------------------------------------------------- storage -----

insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', true)
on conflict (id) do update set public = true;

drop policy if exists "attachments are public" on storage.objects;
create policy "attachments are public" on storage.objects for select using (bucket_id = 'attachments');

-- Each person can only write inside a folder named after their own user id
drop policy if exists "upload own attachments" on storage.objects;
create policy "upload own attachments" on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "delete own attachments" on storage.objects;
create policy "delete own attachments" on storage.objects for delete to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);

-- ================================================================
-- Profiles: banners, verification badge and admin reviewers
-- ================================================================

alter table public.profiles add column if not exists banner_url text;
alter table public.profiles add column if not exists verified boolean not null default false;
alter table public.profiles add column if not exists is_admin boolean not null default false;

create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = uid), false);
$$;

-- People may edit their own profile, but never grant themselves a badge
create or replace function public.protect_profile_flags()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- auth.uid() is null for the SQL editor and service role, which is how the
  -- first admin is appointed. Signed-in people must already be an admin.
  if (new.verified is distinct from old.verified or new.is_admin is distinct from old.is_admin)
     and auth.uid() is not null
     and not public.is_admin(auth.uid()) then
    raise exception 'only an admin can change verification';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_flags on public.profiles;
create trigger profiles_protect_flags
  before update on public.profiles
  for each row execute function public.protect_profile_flags();

drop policy if exists "admins update any profile" on public.profiles;
create policy "admins update any profile" on public.profiles for update
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- ================================================================
-- Follows
-- ================================================================

create table if not exists public.follows (
  follower_id uuid not null references public.profiles on delete cascade,
  following_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint no_self_follow check (follower_id <> following_id)
);

create index if not exists follows_following_idx on public.follows (following_id);

alter table public.follows enable row level security;

drop policy if exists "follows are public" on public.follows;
create policy "follows are public" on public.follows for select using (true);

drop policy if exists "write own follows" on public.follows;
create policy "write own follows" on public.follows for all
  using (auth.uid() = follower_id)
  with check (auth.uid() = follower_id);

-- ================================================================
-- Verification requests
-- ================================================================

create table if not exists public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  reason text not null check (char_length(reason) between 10 and 1000),
  link text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles on delete set null
);

-- One open request per person
create unique index if not exists one_pending_request_per_user
  on public.verification_requests (user_id)
  where status = 'pending';

alter table public.verification_requests enable row level security;

drop policy if exists "read own or all as admin" on public.verification_requests;
create policy "read own or all as admin" on public.verification_requests for select
  using (auth.uid() = user_id or public.is_admin(auth.uid()));

drop policy if exists "request own verification" on public.verification_requests;
create policy "request own verification" on public.verification_requests for insert
  with check (auth.uid() = user_id and status = 'pending');

drop policy if exists "admins decide requests" on public.verification_requests;
create policy "admins decide requests" on public.verification_requests for update
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- ================================================================
-- Profile stats now include follower counts
-- ================================================================

-- Recreated rather than replaced because the column list changed over time
drop view if exists public.profile_stats;

create view public.profile_stats with (security_invoker = on) as
select
  p.id,
  (select count(*) from public.posts where author_id = p.id)::int as posts,
  (select count(*) from public.reactions r join public.posts po on po.id = r.post_id where po.author_id = p.id)::int as reactions,
  (select avg(ra.value) from public.ratings ra join public.posts po on po.id = ra.post_id where po.author_id = p.id) as average_rating,
  (select count(*) from public.follows f where f.following_id = p.id)::int as followers,
  (select count(*) from public.follows f where f.follower_id = p.id)::int as following
from public.profiles p;
