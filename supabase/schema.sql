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

-- Where a note is from: picked on New note, prefilled from the author's own
-- school. Free text shown publicly, so bounded like profiles.school, and the
-- domain is a plain hostname for the same reason as profiles.school_domain.
-- A note's subject is a main subject or a specific one ("anatomy").
alter table public.posts add column if not exists school text;
alter table public.posts add column if not exists school_domain text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'posts_school_len') then
    alter table public.posts add constraint posts_school_len
      check (char_length(school) <= 150);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'posts_school_domain_host') then
    alter table public.posts add constraint posts_school_domain_host
      check (school_domain is null or (char_length(school_domain) <= 253 and school_domain ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'posts_subject_len') then
    alter table public.posts add constraint posts_subject_len
      check (char_length(subject) between 1 and 60);
  end if;
end $$;

-- Editing a note: the author may change what it says, never whose it is,
-- its id or when it was first shared. edited_at is set here, by the database,
-- whenever the content changes, so the "edited" label cannot be faked or hidden.
alter table public.posts add column if not exists edited_at timestamptz;

create or replace function public.guard_post_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.id := old.id;
  new.author_id := old.author_id;
  new.created_at := old.created_at;
  if (new.title, new.body, new.subject, new.level, new.tags, new.attachments, new.school, new.school_domain)
     is distinct from
     (old.title, old.body, old.subject, old.level, old.tags, old.attachments, old.school, old.school_domain) then
    new.edited_at := now();
  else
    new.edited_at := old.edited_at;
  end if;
  return new;
end;
$$;

drop trigger if exists posts_guard_update on public.posts;
create trigger posts_guard_update before update on public.posts
  for each row execute function public.guard_post_update();

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

-- Where the student studies: the domain gives the institution's logo, and the
-- country of the school can differ from the student's own. Added here (rather
-- than in the create table above) so existing databases pick them up too, and
-- because handle_new_user() below writes to them.
alter table public.profiles add column if not exists school_domain text;
alter table public.profiles add column if not exists school_country text;
alter table public.profiles add column if not exists grade text;

-- These four are free text straight from sign-up metadata and are shown on a
-- public profile, so they are bounded like posts.title and comments.body are.
-- Each guard keeps the file re-runnable by hand in the SQL editor.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_school_len') then
    alter table public.profiles add constraint profiles_school_len
      check (char_length(school) <= 150);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_school_country_len') then
    alter table public.profiles add constraint profiles_school_country_len
      check (char_length(school_country) <= 80);
  end if;
  -- A plain hostname: no scheme, no path, so it can never become a javascript:
  -- or data: URL when it is pasted into a logo request.
  if not exists (select 1 from pg_constraint where conname = 'profiles_school_domain_host') then
    alter table public.profiles add constraint profiles_school_domain_host
      check (school_domain is null or (char_length(school_domain) <= 253 and school_domain ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'));
  end if;
  -- Exactly the values the pickers offer (t.institution.universityGrades and
  -- t.institution.highSchoolGrades in src/i18n/en.ts).
  if not exists (select 1 from pg_constraint where conname = 'profiles_grade_allowed') then
    alter table public.profiles add constraint profiles_grade_allowed
      check (grade is null or grade in (
        'Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6', 'Postgraduate', 'Alumni',
        'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'
      ));
  end if;
end $$;

-- ------------------------------------------------------- new user profile ---

-- Metadata is attacker-controlled, and this trigger runs inside the insert on
-- auth.users: a constraint violation here would turn a hostile sign-up into a
-- 500 and a broken sign-up page. So everything is sanitised down to something
-- the constraints accept, and the constraints stay only as a backstop.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  -- Only a JSON string counts as a value; an object or a number reads as absent.
  v_school text := left(coalesce(case when jsonb_typeof(meta -> 'school') = 'string' then meta ->> 'school' end, ''), 150);
  -- school_country stays nullable: an absent school means no school country.
  v_country text := nullif(left(coalesce(case when jsonb_typeof(meta -> 'school_country') = 'string' then meta ->> 'school_country' end, ''), 80), '');
  v_domain text := nullif(lower(coalesce(case when jsonb_typeof(meta -> 'school_domain') = 'string' then meta ->> 'school_domain' end, '')), '');
  v_grade text := nullif(coalesce(case when jsonb_typeof(meta -> 'grade') = 'string' then meta ->> 'grade' end, ''), '');
begin
  -- Anything that is not a bare hostname is dropped rather than rejected.
  if v_domain is not null and (
    char_length(v_domain) > 253
    or v_domain !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'
  ) then
    v_domain := null;
  end if;

  if v_grade is not null and v_grade not in (
    'Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6', 'Postgraduate', 'Alumni',
    'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'
  ) then
    v_grade := null;
  end if;

  insert into public.profiles (
    id, username, display_name, school, school_domain, school_country, grade, field_of_study, country
  )
  values (
    new.id,
    coalesce(
      nullif(lower(meta ->> 'username'), ''),
      'user' || left(replace(new.id::text, '-', ''), 8)
    ),
    coalesce(nullif(meta ->> 'display_name', ''), 'Student'),
    -- Sign-up asks for a school, so it arrives in the metadata. The profile row
    -- is written here even when email confirmation delays the first session.
    v_school,
    v_domain,
    v_country,
    v_grade,
    coalesce(meta ->> 'field_of_study', ''),
    -- The institution's country is the first guess for the student's own.
    coalesce(v_country, '')
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

-- No allowed_mime_types: posts deliberately accept every file type.
insert into storage.buckets (id, name, public, file_size_limit)
values ('attachments', 'attachments', true, 52428800)  -- 50 MiB, matches MAX_FILE_BYTES
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit;

-- SELECT on storage.objects is what powers storage.list(), so it is scoped to the
-- owner's own folder: otherwise any anonymous client could enumerate every user's
-- uploads. Public *downloads* do not go through RLS on a public bucket, so shared
-- links keep working for everyone.
drop policy if exists "attachments are public" on storage.objects;
drop policy if exists "list own attachments" on storage.objects;
create policy "list own attachments" on storage.objects for select to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);

-- Each person can only write inside a folder named after their own user id
drop policy if exists "upload own attachments" on storage.objects;
create policy "upload own attachments" on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);

-- uploadProfileImage() uploads with upsert: true, which needs UPDATE as well as INSERT.
drop policy if exists "update own attachments" on storage.objects;
create policy "update own attachments" on storage.objects for update to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text)
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

-- Question images (<uid>/questions/…) may only be raster images uploaded by
-- admins. Restrictive, so it narrows the policies above without widening
-- anything; other folders and buckets are unaffected.
drop policy if exists "question images by admins" on storage.objects;
create policy "question images by admins" on storage.objects as restrictive for insert to authenticated
  with check (
    bucket_id <> 'attachments'
    or (storage.foldername(name))[2] is distinct from 'questions'
    or (public.is_admin(auth.uid()) and name ~ '^[0-9a-f-]{36}/questions/[0-9a-f-]{36}\.(png|jpg|webp|gif)$')
  );
drop policy if exists "question images stay images" on storage.objects;
create policy "question images stay images" on storage.objects as restrictive for update to authenticated
  using (
    bucket_id <> 'attachments'
    or (storage.foldername(name))[2] is distinct from 'questions'
    or public.is_admin(auth.uid())
  )
  with check (
    bucket_id <> 'attachments'
    or (storage.foldername(name))[2] is distinct from 'questions'
    or (public.is_admin(auth.uid()) and name ~ '^[0-9a-f-]{36}/questions/[0-9a-f-]{36}\.(png|jpg|webp|gif)$')
  );

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

-- protect_profile_flags only runs on update, so creating a profile must not
-- be able to set the flags either (the column-less version is defined above,
-- before these columns exist on a fresh database).
drop policy if exists "insert own profile" on public.profiles;
create policy "insert own profile" on public.profiles for insert
  with check (auth.uid() = id and not is_admin and not verified);

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

-- ================================================================
-- Direct messages
-- ================================================================

-- One row per pair of people. user_a is always the smaller id, so a pair can
-- only ever have one conversation however it was started.
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles on delete cascade,
  user_b uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  -- When each side last opened the thread: drives unread counts and "Seen".
  -- The epoch, not now(): now() is the transaction time, which is also the
  -- first message's created_at, so that message would count as already read.
  a_read_at timestamptz not null default 'epoch',
  b_read_at timestamptz not null default 'epoch',
  constraint conversation_pair_ordered check (user_a < user_b),
  constraint conversation_pair_unique unique (user_a, user_b)
);

create index if not exists conversations_user_b_idx on public.conversations (user_b);

-- Databases created before the default above was corrected.
alter table public.conversations alter column a_read_at set default 'epoch';
alter table public.conversations alter column b_read_at set default 'epoch';

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations on delete cascade,
  sender_id uuid not null references public.profiles on delete cascade,
  -- The text, or a caption for a photo, video or file. Its rules depend on the
  -- kind of message, so they live in messages_shape below.
  body text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_idx on public.messages (conversation_id, created_at desc);

-- Rich messages. Added with "if not exists" so databases from before them upgrade.
alter table public.messages add column if not exists kind text not null default 'text';
-- Photo, video, voice note or file: { path, name, mimeType, size, width,
-- height, duration, waveform }, always written by send_message(), never the client.
alter table public.messages add column if not exists attachment jsonb;
alter table public.messages add column if not exists sticker text;
alter table public.messages add column if not exists reply_to uuid references public.messages on delete set null;
alter table public.messages add column if not exists edited_at timestamptz;
-- Unsent: the row stays (so the thread can say "Message unsent") but its
-- content is wiped. A soft delete also keeps unsends off Realtime's delete
-- events, which are broadcast to every subscriber.
alter table public.messages add column if not exists deleted_at timestamptz;

alter table public.messages alter column body set default '';
-- The original text-only rule; messages_shape replaces it.
alter table public.messages drop constraint if exists messages_body_check;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'messages_kind_allowed') then
    alter table public.messages add constraint messages_kind_allowed
      check (kind in ('text', 'image', 'video', 'voice', 'file', 'sticker'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'messages_body_len') then
    alter table public.messages add constraint messages_body_len
      check (char_length(body) <= 2000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'messages_shape') then
    alter table public.messages add constraint messages_shape check (
      (deleted_at is not null and body = '' and attachment is null and sticker is null)
      or (deleted_at is null and (
        (kind = 'text' and char_length(btrim(body)) >= 1 and attachment is null and sticker is null)
        or (kind in ('image', 'video', 'voice', 'file') and attachment is not null and sticker is null)
        or (kind = 'sticker' and body = '' and attachment is null and sticker ~ '^[a-z0-9-]{1,40}$')
      ))
    );
  end if;
end $$;

-- Looked up by the chat storage policy for every file read.
create index if not exists messages_attachment_path_idx
  on public.messages ((attachment ->> 'path')) where attachment is not null;

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

create or replace function public.is_conversation_member(conv uuid, uid uuid default auth.uid())
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.conversations c
    where c.id = conv and uid is not null and uid in (c.user_a, c.user_b)
  );
$$;

-- Only the two people in a conversation can see it or its messages. There are
-- deliberately no insert, update or delete policies: everything goes through
-- the functions below, so no sender, read marker, file or edit can be forged.
drop policy if exists "members read conversations" on public.conversations;
create policy "members read conversations" on public.conversations for select
  using (auth.uid() in (user_a, user_b));

drop policy if exists "members read messages" on public.messages;
create policy "members read messages" on public.messages for select
  using (public.is_conversation_member(conversation_id));

-- Replaced by unsend_message(), which keeps the row and wipes its content.
drop policy if exists "delete own messages" on public.messages;

-- ------------------------------------------------------------ chat files ----

-- Private, unlike post attachments: a file sent in a chat is readable only by
-- its sender and by the two people in a conversation that references it.
-- Files are shown through short-lived signed URLs.
insert into storage.buckets (id, name, public, file_size_limit)
values ('chat', 'chat', false, 52428800)  -- 50 MiB, matches MAX_FILE_BYTES
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

-- Each person uploads only into a folder named after their own user id.
drop policy if exists "upload own chat files" on storage.objects;
create policy "upload own chat files" on storage.objects for insert to authenticated
  with check (bucket_id = 'chat' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "read chat files" on storage.objects;
create policy "read chat files" on storage.objects for select to authenticated
  using (
    bucket_id = 'chat'
    and (
      (storage.foldername(objects.name))[1] = auth.uid()::text
      or exists (
        select 1 from public.messages m
        where m.attachment ->> 'path' = objects.name
          and m.deleted_at is null
          and public.is_conversation_member(m.conversation_id)
      )
    )
  );

drop policy if exists "delete own chat files" on storage.objects;
create policy "delete own chat files" on storage.objects for delete to authenticated
  using (bucket_id = 'chat' and (storage.foldername(name))[1] = auth.uid()::text);

-- --------------------------------------------------------------- sending ----

-- The two-argument version from before rich messages.
drop function if exists public.send_message(uuid, text);

-- Sends a message to another person, starting the conversation if needed.
-- Every field is checked here, because this is the only way a message is made.
create or replace function public.send_message(
  recipient uuid,
  message_body text default '',
  message_kind text default 'text',
  message_attachment jsonb default null,
  message_sticker text default null,
  reply_to_id uuid default null
)
returns public.messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  conv uuid;
  sent public.messages;
  v_body text := coalesce(message_body, '');
  v_attachment jsonb;
  v_path text;
  v_object record;
  v_mime text;
  v_reply uuid := reply_to_id;
begin
  if me is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if recipient is null or recipient = me then
    raise exception 'cannot message yourself' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = recipient) then
    raise exception 'recipient not found' using errcode = 'P0002';
  end if;

  if message_kind in ('image', 'video', 'voice', 'file') then
    v_path := case when jsonb_typeof(message_attachment -> 'path') = 'string' then message_attachment ->> 'path' end;
    -- Only a file the sender uploaded: naming someone else's path here would
    -- otherwise hand the recipient read access to it.
    if v_path is null or (storage.foldername(v_path))[1] is distinct from me::text then
      raise exception 'attachment must be your own upload' using errcode = '42501';
    end if;
    select o.name, o.metadata into v_object
    from storage.objects o
    where o.bucket_id = 'chat' and o.name = v_path;
    if not found then
      raise exception 'attachment not found' using errcode = 'P0002';
    end if;

    -- Size and type come from what storage actually holds, not from the client.
    v_mime := lower(split_part(coalesce(v_object.metadata ->> 'mimetype', ''), ';', 1));
    if (message_kind = 'image' and v_mime !~ '^image/(jpeg|png|webp|gif|avif)$')
       or (message_kind = 'video' and v_mime !~ '^video/')
       or (message_kind = 'voice' and v_mime !~ '^audio/') then
      raise exception 'attachment type does not match the message' using errcode = '22023';
    end if;

    v_attachment := jsonb_strip_nulls(jsonb_build_object(
      'path', v_path,
      'name', left(coalesce(case when jsonb_typeof(message_attachment -> 'name') = 'string' then message_attachment ->> 'name' end, 'file'), 200),
      'mimeType', v_mime,
      'size', coalesce((v_object.metadata ->> 'size')::bigint, 0),
      'width', case when jsonb_typeof(message_attachment -> 'width') = 'number'
        then least(greatest((message_attachment ->> 'width')::numeric, 1), 20000)::int end,
      'height', case when jsonb_typeof(message_attachment -> 'height') = 'number'
        then least(greatest((message_attachment ->> 'height')::numeric, 1), 20000)::int end,
      'duration', case when jsonb_typeof(message_attachment -> 'duration') = 'number'
        then round(least(greatest((message_attachment ->> 'duration')::numeric, 0), 36000), 1) end,
      'waveform', case when message_kind = 'voice' and jsonb_typeof(message_attachment -> 'waveform') = 'array' then (
        select jsonb_agg(least(greatest(round(value::numeric), 0), 100)::int order by ordinality)
        from jsonb_array_elements_text(message_attachment -> 'waveform') with ordinality
        where ordinality <= 64 and value ~ '^-?[0-9]+(\.[0-9]+)?$'
      ) end
    ));
  elsif message_kind = 'sticker' then
    v_body := '';
  elsif message_kind is distinct from 'text' then
    raise exception 'unknown message kind' using errcode = '22023';
  end if;

  if message_kind = 'text' then
    v_body := btrim(v_body);
  end if;

  insert into public.conversations (user_a, user_b)
  values (least(me, recipient), greatest(me, recipient))
  on conflict (user_a, user_b) do nothing;

  select id into conv from public.conversations
  where user_a = least(me, recipient) and user_b = greatest(me, recipient);

  -- A reply must quote a message from this same conversation.
  if v_reply is not null and not exists (
    select 1 from public.messages where id = v_reply and conversation_id = conv
  ) then
    v_reply := null;
  end if;

  -- messages_shape and messages_body_len reject anything malformed.
  insert into public.messages (conversation_id, sender_id, kind, body, attachment, sticker, reply_to)
  values (
    conv, me, message_kind, v_body, v_attachment,
    case when message_kind = 'sticker' then message_sticker end,
    v_reply
  )
  returning * into sent;

  -- Sending counts as having read everything before it.
  update public.conversations
  set last_message_at = sent.created_at,
      a_read_at = case when user_a = me then sent.created_at else a_read_at end,
      b_read_at = case when user_b = me then sent.created_at else b_read_at end
  where id = conv;

  return sent;
end;
$$;

revoke all on function public.send_message(uuid, text, text, jsonb, text, uuid) from public;
grant execute on function public.send_message(uuid, text, text, jsonb, text, uuid) to authenticated;

-- Edits the text of your own message.
create or replace function public.edit_message(message_id uuid, new_body text)
returns public.messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  edited public.messages;
begin
  update public.messages
  set body = btrim(coalesce(new_body, '')), edited_at = now()
  where id = message_id
    and sender_id = auth.uid()
    and kind = 'text'
    and deleted_at is null
  returning * into edited;
  if not found then
    raise exception 'message not found' using errcode = 'P0002';
  end if;
  return edited;
end;
$$;

revoke all on function public.edit_message(uuid, text) from public;
grant execute on function public.edit_message(uuid, text) to authenticated;

-- Unsends your own message: the content is wiped for both people and the
-- file's path is returned so the sender's client can delete the object.
create or replace function public.unsend_message(message_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_path text;
begin
  select attachment ->> 'path' into v_path
  from public.messages
  where id = message_id and sender_id = auth.uid() and deleted_at is null
  for update;
  if not found then
    raise exception 'message not found' using errcode = 'P0002';
  end if;

  update public.messages
  set deleted_at = now(), body = '', attachment = null, sticker = null
  where id = message_id;
  delete from public.message_reactions where message_reactions.message_id = unsend_message.message_id;
  return v_path;
end;
$$;

-- ------------------------------------------------------------- reactions ----

-- One reaction per person per message. Removing one sets type to null rather
-- than deleting the row: Realtime filters updates by RLS, but not deletes.
create table if not exists public.message_reactions (
  message_id uuid not null references public.messages on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  type text check (type is null or type in ('like', 'love', 'insightful', 'thanks', 'wow')),
  updated_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

alter table public.message_reactions enable row level security;

drop policy if exists "members read message reactions" on public.message_reactions;
create policy "members read message reactions" on public.message_reactions for select
  using (exists (
    select 1 from public.messages m
    where m.id = message_reactions.message_id and public.is_conversation_member(m.conversation_id)
  ));

create or replace function public.react_to_message(message_id uuid, reaction text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.messages m
    where m.id = react_to_message.message_id
      and m.deleted_at is null
      and public.is_conversation_member(m.conversation_id)
  ) then
    raise exception 'message not found' using errcode = 'P0002';
  end if;

  insert into public.message_reactions (message_id, user_id, type)
  values (react_to_message.message_id, auth.uid(), reaction)
  -- Named by constraint: the parameter message_id would make a column list ambiguous.
  on conflict on constraint message_reactions_pkey do update set type = excluded.type, updated_at = now();
end;
$$;

revoke all on function public.unsend_message(uuid) from public;
grant execute on function public.unsend_message(uuid) to authenticated;
revoke all on function public.react_to_message(uuid, text) from public;
grant execute on function public.react_to_message(uuid, text) to authenticated;

-- ----------------------------------------------------------- read state -----

-- Marks a conversation as read by the caller; a no-op for anyone else.
create or replace function public.mark_conversation_read(conv uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.conversations
  set a_read_at = case when user_a = auth.uid() then now() else a_read_at end,
      b_read_at = case when user_b = auth.uid() then now() else b_read_at end
  where id = conv and auth.uid() in (user_a, user_b);
$$;

revoke all on function public.mark_conversation_read(uuid) from public;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

-- Recreated: the columns it returns changed when rich messages arrived.
drop function if exists public.my_conversations();

-- The caller's inbox: every conversation with at least one message, newest
-- first. Runs as the caller, so RLS still decides what is visible.
create or replace function public.my_conversations()
returns table (
  id uuid,
  other_id uuid,
  last_message_at timestamptz,
  last_body text,
  last_sender uuid,
  last_kind text,
  last_attachment_name text,
  last_deleted boolean,
  other_read_at timestamptz,
  unread int
)
language sql
stable
set search_path = ''
as $$
  select
    c.id,
    case when c.user_a = auth.uid() then c.user_b else c.user_a end,
    c.last_message_at,
    m.body,
    m.sender_id,
    m.kind,
    m.attachment ->> 'name',
    m.deleted_at is not null,
    case when c.user_a = auth.uid() then c.b_read_at else c.a_read_at end,
    (
      select count(*)::int from public.messages x
      where x.conversation_id = c.id
        and x.sender_id <> auth.uid()
        and x.deleted_at is null
        and x.created_at > case when c.user_a = auth.uid() then c.a_read_at else c.b_read_at end
    )
  from public.conversations c
  join lateral (
    select body, sender_id, kind, attachment, deleted_at from public.messages
    where conversation_id = c.id
    order by created_at desc
    limit 1
  ) m on true
  where auth.uid() in (c.user_a, c.user_b)
  order by c.last_message_at desc;
$$;

-- Number of messages waiting for the caller, for the navigation badge.
create or replace function public.unread_message_count()
returns int
language sql
stable
set search_path = ''
as $$
  select count(*)::int
  from public.messages x
  join public.conversations c on c.id = x.conversation_id
  where auth.uid() in (c.user_a, c.user_b)
    and x.sender_id <> auth.uid()
    and x.deleted_at is null
    and x.created_at > case when c.user_a = auth.uid() then c.a_read_at else c.b_read_at end;
$$;

-- -------------------------------------------------------------- realtime ----

-- Live delivery. Realtime applies the select policies above per subscriber, so
-- people only receive events for their own conversations.
do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['messages', 'conversations', 'message_reactions'] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

-- "Typing…" travels on private broadcast channels named typing:<conversation>.
-- Only the two members may join, send on or hear one.
do $$ begin
  if to_regclass('realtime.messages') is not null then
    execute 'drop policy if exists "members hear typing" on realtime.messages';
    execute $policy$
      create policy "members hear typing" on realtime.messages for select to authenticated
      using (
        realtime.messages.extension = 'broadcast'
        and realtime.topic() ~ '^typing:[0-9a-f-]{36}$'
        and public.is_conversation_member(split_part(realtime.topic(), ':', 2)::uuid)
      )
    $policy$;
    execute 'drop policy if exists "members send typing" on realtime.messages';
    execute $policy$
      create policy "members send typing" on realtime.messages for insert to authenticated
      with check (
        realtime.messages.extension = 'broadcast'
        and realtime.topic() ~ '^typing:[0-9a-f-]{36}$'
        and public.is_conversation_member(split_part(realtime.topic(), ':', 2)::uuid)
      )
    $policy$;
  end if;
end $$;

-- ---------------------------------------------------------------- BacII --

-- One row per "find videos for this exercise" lookup, so /api/bacii-videos
-- can hold each student to a daily limit (it spends AI and YouTube quota).
-- The function counts and inserts with the student's own session; a student
-- can add and see only their own rows, and cannot delete or change them, so
-- the count cannot be reset. created_at is set by the database.
create table if not exists public.bacii_video_lookups (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists bacii_video_lookups_user_time on public.bacii_video_lookups (user_id, created_at desc);
alter table public.bacii_video_lookups enable row level security;
revoke all on public.bacii_video_lookups from anon;
revoke update, delete, truncate on public.bacii_video_lookups from authenticated;
grant select, insert on public.bacii_video_lookups to authenticated;

drop policy if exists "see own lookups" on public.bacii_video_lookups;
create policy "see own lookups" on public.bacii_video_lookups for select to authenticated
  using (user_id = auth.uid());
drop policy if exists "add own lookups" on public.bacii_video_lookups;
create policy "add own lookups" on public.bacii_video_lookups for insert to authenticated
  with check (user_id = auth.uid() and created_at > now() - interval '1 minute');

-- YouTube searches made by the video finder (roadmap 4.1), to show how much
-- of the project's daily YouTube quota is used. Each search.list call costs
-- 100 units; the quota resets at midnight Pacific time. Rows are added with
-- the student's own session by api/bacii-videos.ts, like lookups above.
create table if not exists public.youtube_search_log (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  searches smallint not null check (searches between 1 and 2),
  created_at timestamptz not null default now()
);
create index if not exists youtube_search_log_time on public.youtube_search_log (created_at desc);
alter table public.youtube_search_log enable row level security;
revoke all on public.youtube_search_log from anon;
revoke update, delete, truncate on public.youtube_search_log from authenticated;
grant select, insert on public.youtube_search_log to authenticated;
drop policy if exists "see own searches" on public.youtube_search_log;
create policy "see own searches" on public.youtube_search_log for select to authenticated using (user_id = auth.uid());
drop policy if exists "add own searches" on public.youtube_search_log;
create policy "add own searches" on public.youtube_search_log for insert to authenticated
  with check (user_id = auth.uid() and created_at > now() - interval '1 minute');

-- Units of YouTube quota used since midnight Pacific time, by everyone.
create or replace function public.youtube_units_today()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(l.searches), 0)::integer * 100
  from public.youtube_search_log l
  where l.created_at >= (date_trunc('day', now() at time zone 'America/Los_Angeles') at time zone 'America/Los_Angeles')
$$;
revoke execute on function public.youtube_units_today() from public, anon;
grant execute on function public.youtube_units_today() to authenticated;

-- Trusted YouTube channels for the video finder (roadmap 4.3), chosen by
-- admins: their videos come first within each match level. Starts empty;
-- Meh Rean does not presume which channels are good. Everyone may read the
-- list (the video function reads it with the publishable key).
create table if not exists public.video_channels (
  channel_id text primary key check (channel_id ~ '^UC[A-Za-z0-9_-]{22}$'),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  language text not null check (language in ('km', 'en')),
  -- Subjects (ids from src/lib/subjects.ts) it is trusted for; empty = all.
  subject_keys text[] not null default '{}' check (cardinality(subject_keys) <= 20),
  note text not null default '' check (char_length(note) <= 300),
  added_by uuid default auth.uid() references public.profiles on delete set null,
  created_at timestamptz not null default now()
);
alter table public.video_channels enable row level security;
drop policy if exists "channels are public" on public.video_channels;
create policy "channels are public" on public.video_channels for select using (true);
drop policy if exists "admins manage channels" on public.video_channels;
create policy "admins manage channels" on public.video_channels for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- Quizzes on videos (roadmap 4.6). Made by admins from a transcript they
-- may use (the channel shared it, or it is the admin's own video): the AI
-- drafts questions, the admin checks and edits them. Only the questions are
-- stored, never the transcript. Everyone reads; admins write.
create or replace function public.valid_video_quiz(questions jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  item jsonb;
  choices integer;
begin
  if jsonb_typeof(questions) <> 'array' or jsonb_array_length(questions) not between 1 and 10 then
    return false;
  end if;
  for item in select value from jsonb_array_elements(questions) loop
    if jsonb_typeof(item->'prompt') <> 'string' or char_length(btrim(item->>'prompt')) not between 1 and 600 then
      return false;
    end if;
    if jsonb_typeof(item->'choices') <> 'array' then
      return false;
    end if;
    choices := jsonb_array_length(item->'choices');
    if choices not between 2 and 5
      or exists (select 1 from jsonb_array_elements(item->'choices') c where jsonb_typeof(c.value) <> 'string' or char_length(btrim(c.value #>> '{}')) not between 1 and 300) then
      return false;
    end if;
    if jsonb_typeof(item->'answer') <> 'number' or (item->>'answer')::numeric not in (0, 1, 2, 3, 4) or (item->>'answer')::integer >= choices then
      return false;
    end if;
    if item ? 'explanation' and (jsonb_typeof(item->'explanation') <> 'string' or char_length(item->>'explanation') > 800) then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

create table if not exists public.video_quizzes (
  video_id text primary key check (video_id ~ '^[A-Za-z0-9_-]{11}$'),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  language text not null check (language in ('km', 'en')),
  -- [{ prompt, choices: [..], answer: index, explanation }]
  questions jsonb not null check (public.valid_video_quiz(questions)),
  -- Who allowed the transcript to be used, so the quiz can be traced.
  source text not null check (char_length(btrim(source)) between 3 and 300),
  ai_generated boolean not null default false,
  -- An admin read and corrected the questions.
  reviewed boolean not null default false,
  created_by uuid default auth.uid() references public.profiles on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.video_quizzes enable row level security;
drop policy if exists "quizzes are public" on public.video_quizzes;
create policy "quizzes are public" on public.video_quizzes for select using (true);
drop policy if exists "admins manage quizzes" on public.video_quizzes;
create policy "admins manage quizzes" on public.video_quizzes for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- ----------------------------------------------------------- Curriculum --

-- BacII curriculum: version → track → subject → chapter → topic. The rows
-- come from src/data/curriculum/*.json via scripts/build-curriculum-seed.mjs
-- (supabase/seed/curriculum.sql). Everyone may read them; only admins may
-- change them. verification says how far an entry has been checked: nothing
-- is 'verified' without its own source.
create table if not exists public.curriculum_versions (
  id text primary key,
  title_en text not null,
  title_km text not null,
  country text not null check (country ~ '^[A-Z]{2}$'),
  grade smallint not null check (grade between 1 and 13),
  verification text not null default 'provisional' check (verification in ('verified', 'provisional', 'needs-review')),
  source text not null default '',
  notes text,
  updated_at timestamptz not null default now()
);

create table if not exists public.curriculum_tracks (
  id text primary key,
  version_id text not null references public.curriculum_versions on delete cascade,
  key text not null,
  name_en text not null,
  name_km text not null,
  sort smallint not null default 0,
  unique (version_id, key)
);

create table if not exists public.curriculum_subjects (
  id text primary key,
  track_id text not null references public.curriculum_tracks on delete cascade,
  -- The app-wide subject id (src/lib/subjects.ts), e.g. 'mathematics'.
  subject_key text not null,
  name_en text not null,
  name_km text not null,
  sort smallint not null default 0,
  unique (track_id, subject_key)
);

create table if not exists public.curriculum_chapters (
  id text primary key,
  subject_id text not null references public.curriculum_subjects on delete cascade,
  number smallint not null check (number > 0),
  name_en text not null,
  name_km text not null,
  verification text not null default 'provisional' check (verification in ('verified', 'provisional', 'needs-review')),
  source text not null default '',
  updated_at timestamptz not null default now(),
  -- Deferred, so a re-seed may renumber chapters in one go.
  constraint curriculum_chapters_number_unique unique (subject_id, number) deferrable initially deferred,
  constraint curriculum_chapters_verified_source check (verification <> 'verified' or char_length(btrim(source)) > 0)
);

create table if not exists public.curriculum_topics (
  id text primary key,
  chapter_id text not null references public.curriculum_chapters on delete cascade,
  name_en text not null,
  name_km text not null,
  sort smallint not null default 0,
  verification text not null default 'provisional' check (verification in ('verified', 'provisional', 'needs-review'))
);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'curriculum_versions_verified_source') then
    alter table public.curriculum_versions add constraint curriculum_versions_verified_source
      check (verification <> 'verified' or char_length(btrim(source)) > 0);
  end if;
end $$;

create index if not exists curriculum_tracks_version_idx on public.curriculum_tracks (version_id, sort);
create index if not exists curriculum_subjects_track_idx on public.curriculum_subjects (track_id, sort);
create index if not exists curriculum_subjects_key_idx on public.curriculum_subjects (subject_key);
create index if not exists curriculum_chapters_subject_idx on public.curriculum_chapters (subject_id, number);
create index if not exists curriculum_topics_chapter_idx on public.curriculum_topics (chapter_id, sort);

do $$
declare
  t text;
begin
  foreach t in array array['curriculum_versions', 'curriculum_tracks', 'curriculum_subjects', 'curriculum_chapters', 'curriculum_topics'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "curriculum is public" on public.%I', t);
    execute format('create policy "curriculum is public" on public.%I for select using (true)', t);
    execute format('drop policy if exists "admins edit curriculum" on public.%I', t);
    execute format(
      'create policy "admins edit curriculum" on public.%I for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()))',
      t
    );
  end loop;
end $$;

-- ------------------------------------------------------------ Questions --

-- BacII practice and exam questions, filed under a curriculum chapter. The
-- answer and worked steps live in question_solutions (one row per question),
-- so they can be kept back during a mock exam later without moving data.
-- Rules the app must not be trusted with are enforced here: the subject
-- always matches the chapter, a topic belongs to its chapter, a
-- multiple-choice answer is one of the choices, nothing is verified without
-- a source, an official past paper has a year and a source, demo content is
-- never verified, and only admins write.
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  -- Set from the chapter by guard_question(); never trusted from the client.
  subject_id text not null references public.curriculum_subjects on delete restrict,
  chapter_id text not null references public.curriculum_chapters on delete restrict,
  topic_id text references public.curriculum_topics on delete set null,
  year smallint check (year between 1990 and 2100),
  type text not null check (type in ('multiple-choice', 'numeric', 'short-answer', 'open')),
  -- Khmer or English text with inline LaTeX ($…$, $$…$$).
  content text not null check (char_length(btrim(content)) between 1 and 20000),
  -- [{ "id": "a", "content": "…" }], 2–8 of them for multiple choice.
  choices jsonb not null default '[]'::jsonb,
  -- [{ "path": "<uploader>/questions/<id>.png", "alt": "…" }]
  images jsonb not null default '[]'::jsonb,
  difficulty smallint check (difficulty between 1 and 5),
  language text not null default 'km' check (language in ('km', 'en', 'fr')),
  origin text not null check (origin in ('official-past-paper', 'textbook', 'teacher', 'community', 'ai-generated', 'demo')),
  source text not null default '' check (char_length(source) <= 500),
  verification text not null default 'provisional' check (verification in ('verified', 'provisional', 'needs-review')),
  verified_by uuid references public.profiles on delete set null,
  verified_at timestamptz,
  created_by uuid references public.profiles on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint questions_choices_shape check (
    jsonb_typeof(choices) = 'array'
    and (type <> 'multiple-choice' or jsonb_array_length(choices) between 2 and 8)
    and (type = 'multiple-choice' or jsonb_array_length(choices) = 0)
  ),
  constraint questions_images_shape check (jsonb_typeof(images) = 'array' and jsonb_array_length(images) <= 6),
  constraint questions_verified_source check (verification <> 'verified' or char_length(btrim(source)) > 0),
  constraint questions_past_paper check (origin <> 'official-past-paper' or (year is not null and char_length(btrim(source)) > 0)),
  constraint questions_demo_unverified check (origin <> 'demo' or verification <> 'verified')
);

create table if not exists public.question_solutions (
  question_id uuid primary key references public.questions on delete cascade,
  -- The final answer as shown to students (LaTeX allowed).
  answer text not null check (char_length(btrim(answer)) between 1 and 5000),
  -- For automatic marking: the right choice id, or a number and how close counts.
  correct_choice text,
  numeric_answer numeric,
  numeric_tolerance numeric check (numeric_tolerance >= 0),
  -- [{ "content": "…" }], shown one at a time.
  steps jsonb not null default '[]'::jsonb check (jsonb_typeof(steps) = 'array' and jsonb_array_length(steps) <= 40),
  -- A solution has its own origin: an AI-written one stays labelled even for an official question.
  origin text not null check (origin in ('official', 'textbook', 'teacher', 'community', 'ai-generated', 'demo')),
  source text not null default '' check (char_length(source) <= 500),
  verification text not null default 'provisional' check (verification in ('verified', 'provisional', 'needs-review')),
  verified_by uuid references public.profiles on delete set null,
  verified_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint question_solutions_verified_source check (verification <> 'verified' or char_length(btrim(source)) > 0),
  constraint question_solutions_demo_unverified check (origin <> 'demo' or verification <> 'verified')
);

create index if not exists questions_subject_chapter_idx on public.questions (subject_id, chapter_id);
create index if not exists questions_chapter_topic_idx on public.questions (chapter_id, topic_id);
create index if not exists questions_year_idx on public.questions (subject_id, year);

-- Who verified something and when come from the session, never the client.
create or replace function public.stamp_verification(
  old_verification text, new_verification text, old_by uuid, old_at timestamptz,
  out by_user uuid, out at_time timestamptz)
language plpgsql
set search_path = ''
as $$
begin
  if new_verification = 'verified' and old_verification is distinct from 'verified' then
    by_user := auth.uid();
    at_time := now();
  elsif new_verification = 'verified' then
    by_user := old_by;
    at_time := old_at;
  else
    by_user := null;
    at_time := null;
  end if;
end;
$$;

create or replace function public.guard_question()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  chapter_subject text;
  choice jsonb;
  image jsonb;
  cleaned jsonb := '[]'::jsonb;
  ids text[] := '{}';
  stamp record;
  key text;
begin
  select c.subject_id into chapter_subject from public.curriculum_chapters c where c.id = new.chapter_id;
  if chapter_subject is null then
    raise exception 'unknown chapter %', new.chapter_id using errcode = '23503';
  end if;
  new.subject_id := chapter_subject;

  if new.topic_id is not null and not exists (
    select 1 from public.curriculum_topics t where t.id = new.topic_id and t.chapter_id = new.chapter_id
  ) then
    raise exception 'topic % is not in chapter %', new.topic_id, new.chapter_id using errcode = '23514';
  end if;

  for choice in select * from jsonb_array_elements(new.choices) loop
    if jsonb_typeof(choice) <> 'object'
       or coalesce(choice->>'id', '') !~ '^[a-z0-9]{1,8}$'
       or char_length(btrim(coalesce(choice->>'content', ''))) not between 1 and 2000
       or (choice->>'id') = any (ids) then
      raise exception 'each choice needs a unique short id and 1-2000 characters' using errcode = '23514';
    end if;
    ids := ids || (choice->>'id');
  end loop;

  -- Images are files in the attachments bucket, stored by path only: the app
  -- builds the address from the path, so no URL (javascript:, data:, another
  -- site) can be stored, and a moved project keeps working.
  for image in select * from jsonb_array_elements(new.images) loop
    if jsonb_typeof(image) <> 'object'
       or coalesce(image->>'path', '') !~ '^[0-9a-f-]{36}/questions/[0-9a-f-]{36}\.(png|jpg|webp|gif)$'
       or char_length(btrim(coalesce(image->>'alt', ''))) not between 1 and 300 then
      raise exception 'each image needs a question image path and a description of at most 300 characters' using errcode = '23514';
    end if;
    -- A newly added image must be an admin's upload: anyone else could later
    -- replace the file (owners may overwrite their own uploads) and change
    -- what a checked question shows. Images already on the question stay.
    if (tg_op = 'INSERT' or not exists (
          select 1 from jsonb_array_elements(old.images) o where o->>'path' = image->>'path'))
       and not exists (
          select 1 from public.profiles p where p.id::text = split_part(image->>'path', '/', 1) and p.is_admin) then
      raise exception 'question images must be uploaded by an admin' using errcode = '23514';
    end if;
    cleaned := cleaned || jsonb_build_object('path', image->>'path', 'alt', btrim(image->>'alt'));
  end loop;
  new.images := cleaned;

  -- A solution already filed must still fit if the question changes.
  if tg_op = 'UPDATE' then
    select s.correct_choice into key from public.question_solutions s where s.question_id = new.id;
    if found and new.type <> old.type then
      raise exception 'delete the solution before changing the question type' using errcode = '23514';
    end if;
    if found and new.type = 'multiple-choice' and (key is null or not key = any (ids)) then
      raise exception 'the solution''s answer is no longer one of the choices' using errcode = '23514';
    end if;
    -- A verified question that is edited has to be checked again.
    if old.verification = 'verified' and new.verification = 'verified'
       and (new.content, new.choices, new.images, new.type, new.year, new.chapter_id, new.topic_id, new.origin)
           is distinct from
           (old.content, old.choices, old.images, old.type, old.year, old.chapter_id, old.topic_id, old.origin) then
      new.verification := 'needs-review';
    end if;
  end if;

  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
    new.created_at := now();
  else
    new.id := old.id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();

  if tg_op = 'INSERT' then
    select * into stamp from public.stamp_verification(null, new.verification, null, null);
  else
    select * into stamp from public.stamp_verification(old.verification, new.verification, old.verified_by, old.verified_at);
  end if;
  new.verified_by := stamp.by_user;
  new.verified_at := stamp.at_time;
  return new;
end;
$$;

drop trigger if exists questions_guard on public.questions;
create trigger questions_guard before insert or update on public.questions
  for each row execute function public.guard_question();

create or replace function public.guard_question_solution()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  q record;
  step jsonb;
  stamp record;
begin
  if tg_op = 'UPDATE' then
    new.question_id := old.question_id;
  end if;

  select type, choices into q from public.questions where id = new.question_id;
  if q.type = 'multiple-choice' then
    if new.correct_choice is null or not exists (
      select 1 from jsonb_array_elements(q.choices) c where c->>'id' = new.correct_choice
    ) then
      raise exception 'the answer must be one of the question''s choices' using errcode = '23514';
    end if;
    new.numeric_answer := null;
    new.numeric_tolerance := null;
  elsif q.type = 'numeric' then
    if new.numeric_answer is null then
      raise exception 'a numeric question needs numeric_answer' using errcode = '23514';
    end if;
    new.correct_choice := null;
  else
    new.correct_choice := null;
    new.numeric_answer := null;
    new.numeric_tolerance := null;
  end if;

  for step in select * from jsonb_array_elements(new.steps) loop
    if jsonb_typeof(step) <> 'object' or char_length(btrim(coalesce(step->>'content', ''))) not between 1 and 5000 then
      raise exception 'each solution step needs 1-5000 characters' using errcode = '23514';
    end if;
  end loop;

  -- A verified solution that is edited has to be checked again.
  if tg_op = 'UPDATE' and old.verification = 'verified' and new.verification = 'verified'
     and (new.answer, new.correct_choice, new.numeric_answer, new.numeric_tolerance, new.steps, new.origin)
         is distinct from
         (old.answer, old.correct_choice, old.numeric_answer, old.numeric_tolerance, old.steps, old.origin) then
    new.verification := 'needs-review';
  end if;

  new.updated_at := now();

  if tg_op = 'INSERT' then
    select * into stamp from public.stamp_verification(null, new.verification, null, null);
  else
    select * into stamp from public.stamp_verification(old.verification, new.verification, old.verified_by, old.verified_at);
  end if;
  new.verified_by := stamp.by_user;
  new.verified_at := stamp.at_time;
  return new;
end;
$$;

drop trigger if exists question_solutions_guard on public.question_solutions;
create trigger question_solutions_guard before insert or update on public.question_solutions
  for each row execute function public.guard_question_solution();

-- A chapter or topic with questions cannot move to another subject or
-- chapter: the questions' subject_id and topic would silently stop matching.
create or replace function public.guard_chapter_move()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.subject_id is distinct from old.subject_id
     and exists (select 1 from public.questions q where q.chapter_id = old.id) then
    raise exception 'chapter % has questions; move them first', old.id using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.guard_topic_move()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.chapter_id is distinct from old.chapter_id
     and exists (select 1 from public.questions q where q.topic_id = old.id) then
    raise exception 'topic % has questions; move them first', old.id using errcode = '23514';
  end if;
  return new;
end;
$$;

drop function if exists public.guard_curriculum_move() cascade;

drop trigger if exists curriculum_chapters_guard_move on public.curriculum_chapters;
create trigger curriculum_chapters_guard_move before update on public.curriculum_chapters
  for each row execute function public.guard_chapter_move();
drop trigger if exists curriculum_topics_guard_move on public.curriculum_topics;
create trigger curriculum_topics_guard_move before update on public.curriculum_topics
  for each row execute function public.guard_topic_move();

do $$
declare
  t text;
begin
  foreach t in array array['questions', 'question_solutions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "questions are public" on public.%I', t);
    execute format('create policy "questions are public" on public.%I for select using (true)', t);
    execute format('drop policy if exists "admins edit questions" on public.%I', t);
    execute format(
      'create policy "admins edit questions" on public.%I for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()))',
      t
    );
  end loop;
end $$;

-- Saves a question and its solution together, so the admin form (roadmap
-- 1.4) never leaves a question without its answer. Runs as the caller: the
-- admin-only policies and every trigger above still apply. A type change
-- replaces the solution, which guard_question otherwise refuses.
create or replace function public.save_question(target uuid, question jsonb, solution jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved uuid := target;
  current_type text;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'only admins can save questions' using errcode = '42501';
  end if;
  if jsonb_typeof(question) <> 'object' or jsonb_typeof(solution) <> 'object' then
    raise exception 'question and solution must be objects' using errcode = '22023';
  end if;

  if saved is null then
    insert into public.questions (chapter_id, topic_id, year, type, content, choices, images, difficulty, language, origin, source, verification)
    values (
      question->>'chapter_id',
      nullif(question->>'topic_id', ''),
      (question->>'year')::smallint,
      question->>'type',
      question->>'content',
      coalesce(question->'choices', '[]'::jsonb),
      coalesce(question->'images', '[]'::jsonb),
      (question->>'difficulty')::smallint,
      coalesce(question->>'language', 'km'),
      question->>'origin',
      coalesce(question->>'source', ''),
      coalesce(question->>'verification', 'provisional')
    )
    returning id into saved;
  else
    select q.type into current_type from public.questions q where q.id = saved;
    if not found then
      raise exception 'question % not found', saved using errcode = 'P0002';
    end if;
    if current_type is distinct from question->>'type' then
      delete from public.question_solutions s where s.question_id = saved;
    end if;
    update public.questions set
      chapter_id = question->>'chapter_id',
      topic_id = nullif(question->>'topic_id', ''),
      year = (question->>'year')::smallint,
      type = question->>'type',
      content = question->>'content',
      choices = coalesce(question->'choices', '[]'::jsonb),
      images = coalesce(question->'images', '[]'::jsonb),
      difficulty = (question->>'difficulty')::smallint,
      language = coalesce(question->>'language', 'km'),
      origin = question->>'origin',
      source = coalesce(question->>'source', ''),
      verification = coalesce(question->>'verification', 'provisional')
    where id = saved;
  end if;

  insert into public.question_solutions (question_id, answer, correct_choice, numeric_answer, numeric_tolerance, steps, origin, source, verification)
  values (
    saved,
    solution->>'answer',
    nullif(solution->>'correct_choice', ''),
    (solution->>'numeric_answer')::numeric,
    (solution->>'numeric_tolerance')::numeric,
    coalesce(solution->'steps', '[]'::jsonb),
    solution->>'origin',
    coalesce(solution->>'source', ''),
    coalesce(solution->>'verification', 'provisional')
  )
  on conflict (question_id) do update set
    answer = excluded.answer,
    correct_choice = excluded.correct_choice,
    numeric_answer = excluded.numeric_answer,
    numeric_tolerance = excluded.numeric_tolerance,
    steps = excluded.steps,
    origin = excluded.origin,
    source = excluded.source,
    verification = excluded.verification;

  return saved;
end;
$$;

revoke execute on function public.save_question(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.save_question(uuid, jsonb, jsonb) to authenticated;

-- --------------------------------------------------------- Exam papers --

-- Past (and practice) exam papers: an ordered set of questions for one
-- subject and year (roadmap 2.1). An official paper may only contain official
-- past-paper questions from its own year and needs a source; a demo paper is
-- never verified, so practice content can never pass as a real BacII paper.
-- duration_minutes is only trusted when duration_source says where it comes
-- from; otherwise the app labels it a practice setting (roadmap 2.4).
create table if not exists public.exam_papers (
  id uuid primary key default gen_random_uuid(),
  subject_id text not null references public.curriculum_subjects on delete restrict,
  year smallint not null check (year between 1990 and 2100),
  title_en text not null check (char_length(btrim(title_en)) between 1 and 200),
  title_km text not null check (char_length(btrim(title_km)) between 1 and 200),
  duration_minutes smallint check (duration_minutes between 5 and 600),
  duration_source text not null default '' check (char_length(duration_source) <= 500),
  origin text not null check (origin in ('official', 'demo')),
  source text not null default '' check (char_length(source) <= 500),
  verification text not null default 'provisional' check (verification in ('verified', 'provisional', 'needs-review')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exam_papers_official_source check (origin <> 'official' or char_length(btrim(source)) > 0),
  constraint exam_papers_verified_source check (verification <> 'verified' or char_length(btrim(source)) > 0),
  constraint exam_papers_demo_unverified check (origin <> 'demo' or verification <> 'verified')
);

create table if not exists public.exam_paper_questions (
  paper_id uuid not null references public.exam_papers on delete cascade,
  question_id uuid not null references public.questions on delete restrict,
  position smallint not null check (position > 0),
  points numeric check (points > 0 and points <= 100),
  primary key (paper_id, question_id),
  constraint exam_paper_questions_position unique (paper_id, position) deferrable initially deferred
);

create index if not exists exam_papers_subject_year_idx on public.exam_papers (subject_id, year desc);
create index if not exists exam_paper_questions_question_idx on public.exam_paper_questions (question_id);

create or replace function public.guard_exam_paper_question()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  paper record;
  q record;
begin
  select p.subject_id, p.year, p.origin into paper from public.exam_papers p where p.id = new.paper_id;
  select x.subject_id, x.year, x.origin into q from public.questions x where x.id = new.question_id;
  if q.subject_id is distinct from paper.subject_id then
    raise exception 'the question is not from this paper''s subject' using errcode = '23514';
  end if;
  if paper.origin = 'official' and (q.origin <> 'official-past-paper' or q.year is distinct from paper.year) then
    raise exception 'an official paper only holds official past-paper questions from its year' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists exam_paper_questions_guard on public.exam_paper_questions;
create trigger exam_paper_questions_guard before insert or update on public.exam_paper_questions
  for each row execute function public.guard_exam_paper_question();

-- A paper cannot quietly become official, or change subject or year, while it
-- holds questions that would not belong there.
create or replace function public.guard_exam_paper()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.id := old.id;
  new.created_at := old.created_at;
  new.updated_at := now();
  if (new.subject_id, new.year, new.origin) is distinct from (old.subject_id, old.year, old.origin)
     and exists (select 1 from public.exam_paper_questions epq where epq.paper_id = old.id) then
    raise exception 'remove the paper''s questions before changing its subject, year or origin' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists exam_papers_guard on public.exam_papers;
create trigger exam_papers_guard before update on public.exam_papers
  for each row execute function public.guard_exam_paper();

do $$
declare
  t text;
begin
  foreach t in array array['exam_papers', 'exam_paper_questions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "papers are public" on public.%I', t);
    execute format('create policy "papers are public" on public.%I for select using (true)', t);
    execute format('drop policy if exists "admins edit papers" on public.%I', t);
    execute format(
      'create policy "admins edit papers" on public.%I for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()))',
      t
    );
  end loop;
end $$;

-- ----------------------------------------------------------- Mock exams --

-- A student's timed attempt at a paper (roadmap 2.4). Everything that counts
-- happens in the functions below, never in the browser: the deadline is set
-- when the attempt starts, answers after it are refused, and the score is
-- worked out here from the answer key. Students read only their own rows and
-- cannot write either table directly.
create table if not exists public.exam_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  paper_id uuid not null references public.exam_papers on delete cascade,
  -- official: the paper's sourced duration; practice: chosen by the student.
  timing text not null check (timing in ('official', 'practice')),
  duration_minutes smallint not null check (duration_minutes between 5 and 600),
  started_at timestamptz not null default now(),
  deadline_at timestamptz not null,
  submitted_at timestamptz,
  status text not null default 'in-progress' check (status in ('in-progress', 'submitted', 'timed-out')),
  -- Points from automatically marked questions only.
  score numeric,
  max_score numeric,
  -- Questions that need a person to mark them (worked problems, short answers).
  unmarked integer
);

create table if not exists public.exam_answers (
  attempt_id uuid not null references public.exam_attempts on delete cascade,
  question_id uuid not null references public.questions on delete cascade,
  answer text not null default '' check (char_length(answer) <= 5000),
  updated_at timestamptz not null default now(),
  -- Set when the attempt is marked; null for questions that need a person.
  is_correct boolean,
  points_awarded numeric,
  primary key (attempt_id, question_id)
);

create index if not exists exam_attempts_user_idx on public.exam_attempts (user_id, started_at desc);
-- At most one running attempt per student and paper, even if two starts race.
drop index if exists public.exam_attempts_open_idx;
create unique index if not exists exam_attempts_one_open on public.exam_attempts (user_id, paper_id) where status = 'in-progress';

alter table public.exam_attempts enable row level security;
alter table public.exam_answers enable row level security;
drop policy if exists "see own attempts" on public.exam_attempts;
create policy "see own attempts" on public.exam_attempts for select to authenticated using (user_id = auth.uid());
drop policy if exists "see own answers" on public.exam_answers;
create policy "see own answers" on public.exam_answers for select to authenticated
  using (exists (select 1 from public.exam_attempts a where a.id = attempt_id and a.user_id = auth.uid()));
revoke insert, update, delete on public.exam_attempts, public.exam_answers from anon, authenticated;

-- Mistake notebook (roadmap 3.1): each question a student got wrong, in a
-- mock exam or in practice, until they get it right. Written only by
-- mark_exam_attempt and record_practice_answer, which mark on the server.
create table if not exists public.mistakes (
  user_id uuid not null references public.profiles on delete cascade,
  question_id uuid not null references public.questions on delete cascade,
  last_answer text not null default '' check (char_length(last_answer) <= 5000),
  source text not null check (source in ('practice', 'exam')),
  attempt_id uuid references public.exam_attempts on delete set null,
  times_wrong integer not null default 1 check (times_wrong >= 1),
  first_wrong_at timestamptz not null default now(),
  last_wrong_at timestamptz not null default now(),
  -- Set when the student answers it right; cleared if they get it wrong again.
  fixed_at timestamptz,
  primary key (user_id, question_id)
);
create index if not exists mistakes_user_idx on public.mistakes (user_id, last_wrong_at desc);

-- Spaced repetition (roadmap 3.2): reviews 1, 3, 7 and 14 days apart. Stage
-- counts reviews passed (0–4); next_review_at is null once all four are done.
-- The intervals live in note_answer below and in src/lib/review.ts.
alter table public.mistakes add column if not exists review_stage smallint not null default 0;
alter table public.mistakes add column if not exists next_review_at timestamptz;
alter table public.mistakes drop constraint if exists mistakes_review_stage_check;
alter table public.mistakes add constraint mistakes_review_stage_check check (review_stage between 0 and 4);
update public.mistakes set next_review_at = last_wrong_at + interval '1 day'
where next_review_at is null and review_stage < 4;
create index if not exists mistakes_due_idx on public.mistakes (user_id, next_review_at) where next_review_at is not null;

-- How each student does per chapter: every automatically marked answer, in
-- practice or a mock exam (roadmap 3.3; later the progress pages). Written
-- only by note_answer.
create table if not exists public.chapter_progress (
  user_id uuid not null references public.profiles on delete cascade,
  chapter_id text not null references public.curriculum_chapters on delete cascade,
  answered integer not null default 0 check (answered >= 0),
  correct integer not null default 0 check (correct between 0 and answered),
  updated_at timestamptz not null default now(),
  primary key (user_id, chapter_id)
);
alter table public.chapter_progress enable row level security;
drop policy if exists "see own progress" on public.chapter_progress;
create policy "see own progress" on public.chapter_progress for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.chapter_progress from anon, authenticated;

-- One question a day per student, from their weakest chapter (roadmap 3.3).
-- Days follow Cambodia's clock (Asia/Phnom_Penh). Answering it, right or
-- wrong, keeps the streak: it rewards showing up, not luck.
create table if not exists public.daily_questions (
  user_id uuid not null references public.profiles on delete cascade,
  day date not null,
  question_id uuid not null references public.questions on delete cascade,
  chapter_id text not null references public.curriculum_chapters on delete cascade,
  -- true when the chapter was picked from the student's results, false when
  -- there were none yet.
  from_results boolean not null default false,
  answered_at timestamptz,
  correct boolean,
  primary key (user_id, day)
);
alter table public.daily_questions enable row level security;
drop policy if exists "see own daily questions" on public.daily_questions;
create policy "see own daily questions" on public.daily_questions for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.daily_questions from anon, authenticated;

alter table public.mistakes enable row level security;
drop policy if exists "see own mistakes" on public.mistakes;
create policy "see own mistakes" on public.mistakes for select to authenticated using (user_id = auth.uid());
drop policy if exists "remove own mistakes" on public.mistakes;
create policy "remove own mistakes" on public.mistakes for delete to authenticated using (user_id = auth.uid());
revoke insert, update on public.mistakes from anon, authenticated;

-- During a student's own running attempt, that paper's answer key is hidden
-- from them; it comes back once the attempt is submitted or timed out.
-- Admins always see it, so editing a question never loses its solution.
drop policy if exists "questions are public" on public.question_solutions;
create policy "questions are public" on public.question_solutions for select using (
  auth.uid() is null
  or public.is_admin(auth.uid())
  or not exists (
    select 1
    from public.exam_attempts a
    join public.exam_paper_questions epq on epq.paper_id = a.paper_id
    where a.user_id = auth.uid()
      and a.status = 'in-progress'
      and a.deadline_at > now()
      and epq.question_id = question_solutions.question_id
  )
);

-- Is this answer right? true / false, or null when it needs a person
-- (worked problems, or a numeric question without a numeric key). Used by
-- exam marking and by practice answers, so both agree.
create or replace function public.answer_matches(
  question_type text, given text, correct_choice text, numeric_answer numeric, numeric_tolerance numeric
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  cleaned text := btrim(replace(coalesce(given, ''), ',', '.'));
begin
  if question_type = 'multiple-choice' then
    return btrim(coalesce(given, '')) = correct_choice;
  end if;
  if question_type = 'numeric' and numeric_answer is not null then
    if cleaned !~ '^[-+]?([0-9]+(\.[0-9]*)?|\.[0-9]+)$' then
      return false;
    end if;
    return abs(cleaned::numeric - numeric_answer) <= coalesce(numeric_tolerance, 0);
  end if;
  return null;
end;
$$;

-- Updates a student's mistake notebook after a marked answer (internal).
-- Wrong: in the notebook, first review tomorrow. Right: fixed; and if a review
-- was due, it is passed and the next one is scheduled further out (3, 7, 14
-- days), until all are done. Right answers before a review is due do not
-- move it on: retrying straight after reading the solution proves little.
create or replace function public.note_answer(who uuid, question uuid, right_answer boolean, given text, from_source text, attempt uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  intervals constant integer[] := array[1, 3, 7, 14];
begin
  if right_answer is null then
    return;
  end if;

  insert into public.chapter_progress (user_id, chapter_id, answered, correct)
  select who, q.chapter_id, 1, case when right_answer then 1 else 0 end
  from public.questions q where q.id = note_answer.question
  on conflict (user_id, chapter_id) do update set
    answered = public.chapter_progress.answered + 1,
    correct = public.chapter_progress.correct + excluded.correct,
    updated_at = now();

  if not right_answer then
    insert into public.mistakes (user_id, question_id, last_answer, source, attempt_id, review_stage, next_review_at)
    values (who, question, coalesce(given, ''), from_source, attempt, 0, now() + make_interval(days => intervals[1]))
    on conflict (user_id, question_id) do update set
      last_answer = excluded.last_answer,
      source = excluded.source,
      attempt_id = excluded.attempt_id,
      times_wrong = public.mistakes.times_wrong + 1,
      last_wrong_at = now(),
      fixed_at = null,
      review_stage = 0,
      next_review_at = excluded.next_review_at;
    return;
  end if;

  update public.mistakes m set
    review_stage = m.review_stage + 1,
    next_review_at = case when m.review_stage + 1 >= 4 then null else now() + make_interval(days => intervals[m.review_stage + 2]) end
  where m.user_id = who and m.question_id = note_answer.question and m.next_review_at <= now();
  update public.mistakes m set fixed_at = now()
  where m.user_id = who and m.question_id = note_answer.question and m.fixed_at is null;
end;
$$;
revoke execute on function public.note_answer(uuid, uuid, boolean, text, text, uuid) from public, anon, authenticated;

-- Marks an attempt from the answer key and closes it. Internal: called by
-- submit_exam and by the other functions when they find a deadline passed.
create or replace function public.mark_exam_attempt(attempt uuid, final_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  answered record;
begin
  -- Every question on the paper gets a row, so unanswered ones count as wrong.
  insert into public.exam_answers (attempt_id, question_id, answer)
  select a.id, epq.question_id, ''
  from public.exam_attempts a
  join public.exam_paper_questions epq on epq.paper_id = a.paper_id
  where a.id = attempt
  on conflict (attempt_id, question_id) do nothing;

  update public.exam_answers ea set
    is_correct = public.answer_matches(q.type, ea.answer, s.correct_choice, s.numeric_answer, s.numeric_tolerance)
  from public.exam_attempts a, public.questions q, public.question_solutions s
  where ea.attempt_id = attempt and a.id = ea.attempt_id and q.id = ea.question_id and s.question_id = ea.question_id;

  update public.exam_answers ea set
    points_awarded = case when ea.is_correct is null then null when ea.is_correct then coalesce(epq.points, 1) else 0 end
  from public.exam_attempts a, public.exam_paper_questions epq
  where ea.attempt_id = attempt and a.id = ea.attempt_id and epq.paper_id = a.paper_id and epq.question_id = ea.question_id;

  update public.exam_attempts a set
    status = final_status,
    submitted_at = least(now(), a.deadline_at),
    score = (select coalesce(sum(ea.points_awarded), 0) from public.exam_answers ea where ea.attempt_id = a.id and ea.is_correct is not null),
    max_score = (
      select coalesce(sum(coalesce(epq.points, 1)), 0)
      from public.exam_answers ea
      join public.exam_paper_questions epq on epq.paper_id = a.paper_id and epq.question_id = ea.question_id
      where ea.attempt_id = a.id and ea.is_correct is not null
    ),
    unmarked = (select count(*) from public.exam_answers ea where ea.attempt_id = a.id and ea.is_correct is null)
  where a.id = attempt and a.status = 'in-progress';
  if not found then
    return;
  end if;

  -- Mistake notebook (roadmap 3.1, 3.2): wrong or blank answers go in;
  -- right ones fix earlier mistakes and pass due reviews.
  for answered in
    select a.user_id, ea.question_id, ea.answer, ea.is_correct
    from public.exam_answers ea
    join public.exam_attempts a on a.id = ea.attempt_id
    where ea.attempt_id = attempt
  loop
    perform public.note_answer(answered.user_id, answered.question_id, answered.is_correct, answered.answer, 'exam', attempt);
  end loop;
end;
$$;
revoke execute on function public.mark_exam_attempt(uuid, text) from public, anon, authenticated;

-- Starts an attempt, or returns the student's running one for this paper.
-- practice_minutes is used only when the paper has no sourced duration.
create or replace function public.start_exam(paper uuid, practice_minutes integer)
returns table (attempt_id uuid, deadline_at timestamptz, server_now timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  p record;
  running record;
  minutes integer;
  official boolean;
begin
  if me is null then
    raise exception 'sign in to take a mock exam' using errcode = '42501';
  end if;
  select ep.id, ep.duration_minutes, ep.duration_source into p from public.exam_papers ep where ep.id = paper;
  if not found then
    raise exception 'paper not found' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.exam_paper_questions epq where epq.paper_id = paper) then
    raise exception 'this paper has no questions yet' using errcode = '22023';
  end if;

  -- Close any of this student's attempts whose time ran out.
  perform public.mark_exam_attempt(a.id, 'timed-out')
  from public.exam_attempts a
  where a.user_id = me and a.status = 'in-progress' and a.deadline_at <= now();

  select a.id, a.deadline_at into running
  from public.exam_attempts a
  where a.user_id = me and a.paper_id = paper and a.status = 'in-progress'
  order by a.started_at desc
  limit 1;
  if found then
    return query select running.id, running.deadline_at, now();
    return;
  end if;

  -- Keeps one account from filling the table: plenty for real practice.
  if (select count(*) from public.exam_attempts a where a.user_id = me and a.started_at > now() - interval '1 day') >= 30 then
    raise exception 'that is 30 mock exams today; try again tomorrow' using errcode = '54000';
  end if;

  official := p.duration_minutes is not null and char_length(btrim(p.duration_source)) > 0;
  minutes := case when official then p.duration_minutes else practice_minutes end;
  if minutes is null or minutes not between 5 and 600 then
    raise exception 'choose a practice time between 5 and 600 minutes' using errcode = '22023';
  end if;

  return query
  insert into public.exam_attempts (user_id, paper_id, timing, duration_minutes, deadline_at)
  values (me, paper, case when official then 'official' else 'practice' end, minutes, now() + make_interval(mins => minutes))
  returning id, exam_attempts.deadline_at, now();
end;
$$;
revoke execute on function public.start_exam(uuid, integer) from public, anon;
grant execute on function public.start_exam(uuid, integer) to authenticated;

-- Saves one answer while the attempt is running. Returns 'saved', or
-- 'time-up' once the deadline has passed: then the attempt is closed and
-- marked instead (returned, not raised, so that marking is not rolled back).
drop function if exists public.save_exam_answer(uuid, uuid, text);
create function public.save_exam_answer(attempt uuid, question uuid, answer text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  a record;
begin
  select ea.id, ea.user_id, ea.paper_id, ea.status, ea.deadline_at into a from public.exam_attempts ea where ea.id = attempt;
  if not found or a.user_id is distinct from auth.uid() then
    raise exception 'attempt not found' using errcode = 'P0002';
  end if;
  if a.status <> 'in-progress' then
    raise exception 'this attempt is already finished' using errcode = '22023';
  end if;
  if a.deadline_at <= now() then
    perform public.mark_exam_attempt(attempt, 'timed-out');
    return 'time-up';
  end if;
  if not exists (select 1 from public.exam_paper_questions epq where epq.paper_id = a.paper_id and epq.question_id = question) then
    raise exception 'that question is not on this paper' using errcode = '22023';
  end if;
  if char_length(coalesce(answer, '')) > 5000 then
    raise exception 'answer too long' using errcode = '22023';
  end if;

  insert into public.exam_answers (attempt_id, question_id, answer, updated_at)
  values (attempt, question, coalesce(answer, ''), now())
  on conflict (attempt_id, question_id) do update set answer = excluded.answer, updated_at = now();
  return 'saved';
end;
$$;
revoke execute on function public.save_exam_answer(uuid, uuid, text) from public, anon;
grant execute on function public.save_exam_answer(uuid, uuid, text) to authenticated;

-- Hands the attempt in (or records that time ran out) and marks it.
create or replace function public.submit_exam(attempt uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a record;
begin
  select ea.user_id, ea.status, ea.deadline_at into a from public.exam_attempts ea where ea.id = attempt;
  if not found or a.user_id is distinct from auth.uid() then
    raise exception 'attempt not found' using errcode = 'P0002';
  end if;
  if a.status = 'in-progress' then
    perform public.mark_exam_attempt(attempt, case when a.deadline_at <= now() then 'timed-out' else 'submitted' end);
  end if;
end;
$$;
revoke execute on function public.submit_exam(uuid) from public, anon;
grant execute on function public.submit_exam(uuid) to authenticated;

-- A practice answer from a signed-in student: marked here, recorded in the
-- mistake notebook when wrong, and an earlier mistake marked fixed when
-- right. Returns null for questions that cannot be marked automatically.
-- Refused for a question on the student's running mock exam, so it cannot
-- be used to test answers mid-exam.
create or replace function public.record_practice_answer(question uuid, answer text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  q record;
  right_answer boolean;
begin
  if me is null then
    raise exception 'sign in to keep a mistake notebook' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(answer, ''))) = 0 or char_length(answer) > 5000 then
    raise exception 'give an answer (up to 5000 characters)' using errcode = '22023';
  end if;
  if exists (
    select 1
    from public.exam_attempts a
    join public.exam_paper_questions epq on epq.paper_id = a.paper_id
    where a.user_id = me and a.status = 'in-progress' and a.deadline_at > now() and epq.question_id = question
  ) then
    raise exception 'finish your mock exam first' using errcode = '42501';
  end if;

  select qq.type, s.correct_choice, s.numeric_answer, s.numeric_tolerance into q
  from public.questions qq
  join public.question_solutions s on s.question_id = qq.id
  where qq.id = question;
  if not found then
    return null;
  end if;
  right_answer := public.answer_matches(q.type, answer, q.correct_choice, q.numeric_answer, q.numeric_tolerance);
  perform public.note_answer(me, question, right_answer, answer, 'practice', null);
  -- The first answer to today's question counts for the streak.
  update public.daily_questions d set answered_at = now(), correct = right_answer
  where d.user_id = me and d.day = (now() at time zone 'Asia/Phnom_Penh')::date
    and d.question_id = record_practice_answer.question and d.answered_at is null;
  return right_answer;
end;
$$;
revoke execute on function public.record_practice_answer(uuid, text) from public, anon;
grant execute on function public.record_practice_answer(uuid, text) to authenticated;

-- Today's question for the signed-in student, picked once a day and then
-- kept. Weakest chapter: lowest (correct + 1) / (answered + 2) — a chapter
-- never tried counts as half right, so a known weakness comes first. Only
-- questions that can be marked automatically, not on a running mock exam,
-- and not a daily question in the last 14 days when there is any other.
create or replace function public.daily_question()
returns table (question_id uuid, day date, chapter_id text, from_results boolean, answered_at timestamptz, correct boolean)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  me uuid := auth.uid();
  today date := (now() at time zone 'Asia/Phnom_Penh')::date;
begin
  if me is null then
    raise exception 'sign in for a daily question' using errcode = '42501';
  end if;

  if not exists (select 1 from public.daily_questions d where d.user_id = me and d.day = today) then
    with candidates as (
      select q.id, q.chapter_id,
        exists (select 1 from public.daily_questions d where d.user_id = me and d.question_id = q.id and d.day > today - 14) as recent
      from public.questions q
      join public.question_solutions s on s.question_id = q.id
      where (q.type = 'multiple-choice' or (q.type = 'numeric' and s.numeric_answer is not null))
        and not exists (
          select 1 from public.exam_attempts a
          join public.exam_paper_questions epq on epq.paper_id = a.paper_id
          where a.user_id = me and a.status = 'in-progress' and a.deadline_at > now() and epq.question_id = q.id
        )
    ),
    weakest as (
      select c.chapter_id, coalesce(p.answered, 0) > 0 as had_results
      from (select distinct candidates.chapter_id from candidates) c
      left join public.chapter_progress p on p.user_id = me and p.chapter_id = c.chapter_id
      order by (coalesce(p.correct, 0) + 1)::numeric / (coalesce(p.answered, 0) + 2), coalesce(p.answered, 0) desc, random()
      limit 1
    )
    insert into public.daily_questions (user_id, day, question_id, chapter_id, from_results)
    select me, today, c.id, w.chapter_id, w.had_results
    from candidates c
    join weakest w on w.chapter_id = c.chapter_id
    order by c.recent, random()
    limit 1
    on conflict (user_id, day) do nothing;
  end if;

  return query
  select d.question_id, d.day, d.chapter_id, d.from_results, d.answered_at, d.correct
  from public.daily_questions d where d.user_id = me and d.day = today;
end;
$$;
revoke execute on function public.daily_question() from public, anon;
grant execute on function public.daily_question() to authenticated;

-- The streak: days in a row with today's question answered, counting back
-- from today (or from yesterday while today's is still open), and the best.
create or replace function public.daily_streak()
returns table (current_streak integer, best_streak integer, answered_today boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with days as (
    select d.day from public.daily_questions d where d.user_id = auth.uid() and d.answered_at is not null
  ),
  runs as (
    select min(day) as first_day, max(day) as last_day, count(*)::integer as length
    from (select day, day - (row_number() over (order by day))::integer as run from days) numbered
    group by run
  ),
  today as (select (now() at time zone 'Asia/Phnom_Penh')::date as day)
  select
    coalesce((select r.length from runs r, today t where r.last_day >= t.day - 1), 0),
    coalesce((select max(r.length) from runs r), 0),
    exists (select 1 from days, today t where days.day = t.day)
$$;
revoke execute on function public.daily_streak() from public, anon;
grant execute on function public.daily_streak() to authenticated;

-- ---------------------------------------------------------- Study plans --

-- A student's own weekly plan (roadmap 3.4). It is built in the browser from
-- their settings and results and is theirs to edit, so the student writes it;
-- the database only checks its size and settings.
create table if not exists public.study_plans (
  user_id uuid primary key references public.profiles on delete cascade,
  subject_id text not null references public.curriculum_subjects on delete cascade,
  exam_date date not null,
  hours_per_day numeric not null check (hours_per_day between 0.5 and 12),
  days_per_week smallint not null check (days_per_week between 1 and 7),
  target_grade text not null check (target_grade ~ '^[A-F]$'),
  weak_chapter_ids text[] not null default '{}' check (cardinality(weak_chapter_ids) <= 50),
  -- [{ start, studyDays, items: [{ id, kind, chapterId, hours, done }] }]
  weeks jsonb not null check (jsonb_typeof(weeks) = 'array' and octet_length(weeks::text) <= 200000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.study_plans enable row level security;
drop policy if exists "own study plan" on public.study_plans;
create policy "own study plan" on public.study_plans for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.study_plans from anon;
grant select, insert, update, delete on public.study_plans to authenticated;

-- Dates the server sets; an exam date must be ahead (it may pass later, and
-- the plan can still be ticked off).
create or replace function public.guard_study_plan()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  today date := (now() at time zone 'Asia/Phnom_Penh')::date;
begin
  if tg_op = 'INSERT' or new.exam_date is distinct from old.exam_date then
    if new.exam_date <= today or new.exam_date > today + 400 then
      raise exception 'the exam date must be within the next 400 days' using errcode = '22023';
    end if;
  end if;
  new.created_at := case when tg_op = 'INSERT' then now() else old.created_at end;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists guard_study_plan on public.study_plans;
create trigger guard_study_plan before insert or update on public.study_plans
  for each row execute function public.guard_study_plan();

-- ------------------------------------------------------- Watched videos --

-- Videos a student marked (roadmap 4.7): watched, understood, or needs
-- revision, with the chapter of the exercise they were looking at, so the
-- page can link them to that chapter's results and mistakes. The student's
-- own notes: they read and write only their own rows.
create table if not exists public.video_progress (
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  video_id text not null check (video_id ~ '^[A-Za-z0-9_-]{11}$'),
  title text not null check (char_length(title) between 1 and 300),
  channel text not null default '' check (char_length(channel) <= 200),
  status text not null check (status in ('watched', 'understood', 'needs-revision')),
  chapter_id text references public.curriculum_chapters on delete set null,
  updated_at timestamptz not null default now(),
  primary key (user_id, video_id)
);
create index if not exists video_progress_user_idx on public.video_progress (user_id, updated_at desc);
alter table public.video_progress enable row level security;
drop policy if exists "own video progress" on public.video_progress;
create policy "own video progress" on public.video_progress for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.video_progress from anon;
grant select, insert, update, delete on public.video_progress to authenticated;
