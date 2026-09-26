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
