# Connecting Meh Rean to Supabase

Right now the app keeps everything inside one browser. Supabase gives it a real
server: accounts, posts everyone can see, and file storage.

You do **not** have to change any code. The app checks two environment
variables at startup. If they are missing it stays in browser-only mode; if they
are there, every request goes to Supabase instead.

It takes about 10 minutes.

---

## 1. Create the project

1. Go to <https://supabase.com> and sign in (the free plan is enough).
2. Click **New project**.
   - **Name:** `meh-rean`
   - **Database password:** pick a strong one and save it somewhere safe. You
     won't need it for the app, only for direct database access.
   - **Region:** choose the one closest to your users (for Cambodia,
     *Southeast Asia (Singapore)*).
3. Wait about two minutes for the project to finish setting up.

## 2. Create the tables

1. In your project, open **SQL Editor** in the left sidebar.
2. Click **New query**.
3. Open the file [`supabase/schema.sql`](supabase/schema.sql) from this repo,
   copy all of it, and paste it into the editor.
4. Click **Run**. You should see "Success. No rows returned".

That one script creates everything: the tables (profiles, posts, comments,
reactions, ratings, saves), the security rules, the search helpers, and the
`attachments` storage bucket for uploaded files.

It is safe to run again later if you change something.

## 3. Copy your keys

1. Open **Project Settings → API keys** (or **Data API**).
2. Copy two values:
   - **Project URL**, which looks like `https://abcdefghijkl.supabase.co`
   - **anon public** key (a long text string)

> **Only ever use the `anon public` key in this app.** It is meant to be public
> and is protected by the security rules from step 2. Never put the
> `service_role` key in the app or in GitHub — it bypasses all security.

## 4. Point the app at your project

In the project folder, create a file named `.env.local` next to `package.json`:

```bash
VITE_SUPABASE_URL=https://abcdefghijkl.supabase.co
VITE_SUPABASE_ANON_KEY=paste-your-anon-public-key-here
```

There is an example to copy in [`.env.example`](.env.example). `.env.local` is
already ignored by git, so your keys won't be committed.

Then restart the dev server:

```bash
npm run dev
```

The sign-in page no longer shows the demo account box — that's how you know it
is connected to Supabase.

## 5. Decide about email confirmation

By default Supabase emails a confirmation link to every new account. That is
good for real use, but slow while testing.

- **Keep it on:** after signing up, the app tells the person to check their
  email. They confirm, then sign in.
- **Turn it off while testing:** **Authentication → Sign In / Providers →
  Email**, and switch off **Confirm email**.

Supabase's built-in email sending is rate limited (a few messages per hour) and
is only meant for testing. For a real launch, connect your own SMTP provider
under **Authentication → Emails → SMTP Settings** (Resend, Brevo and Mailgun all
have free tiers).

## 6. Try it

1. Create an account in the app.
2. Post something with a photo or PDF attached.
3. In Supabase, open **Table Editor → posts** — your post is there.
4. Open **Storage → attachments** — your file is there.
5. Open the app in a different browser (or on your phone, using your computer's
   network address) and sign up as a second person. Both accounts now see the
   same posts. That's the part that was impossible before.

---

## What the security rules allow

The rules live in the database, so they apply no matter who calls the API.

| Data | Who can read | Who can write |
| --- | --- | --- |
| Profiles | everyone | only you, your own |
| Posts | everyone | only you, your own |
| Comments | everyone | you write your own; you can delete your own, or any comment on your post |
| Reactions, ratings | everyone | only your own; you cannot rate your own post |
| Saved posts | only you | only you |
| Uploaded files | everyone (public links) | you can only write and delete inside your own folder |

Deleting your account calls a database function that removes the account and,
through cascading deletes, its posts, comments, reactions and ratings. Uploaded
files are deleted first.

## Going live

When you deploy (Vercel, Netlify, Cloudflare Pages, …), set the same two
variables in the host's environment settings rather than uploading `.env.local`.
Also add your site's address under **Authentication → URL Configuration → Site
URL** and **Redirect URLs**, so confirmation links come back to the right place.

## Costs

The free plan covers a project with 500 MB of database, 1 GB of file storage and
50,000 monthly active users. Uploaded videos are what will fill the 1 GB
first — keep an eye on **Storage** in the dashboard.

## Troubleshooting

| What you see | What it means |
| --- | --- |
| Sign-in page still shows the demo account | `.env.local` wasn't picked up. Restart `npm run dev`; the file must be in the project root and the names must start with `VITE_`. |
| "Something went wrong" on every screen | The URL or key is wrong, or step 2 (the SQL) was never run. |
| Sign-up says to check your email, but no email arrives | Confirmation is on and the test mail limit is reached. Turn confirmation off, or set up SMTP. |
| "You don't have permission to do that" | A security rule blocked it — normally correct. If it's wrong, re-run `schema.sql`. |
| Uploads fail | The `attachments` bucket is missing. Re-run `schema.sql`, then check **Storage**. |

## Running Supabase on your own computer (optional)

If you have Docker Desktop, you can run the whole Supabase stack locally — handy
for trying changes without touching real data:

```bash
npx supabase start                       # first run downloads a few GB
# apply the schema to the local database
docker exec -i supabase_db_Meh_Rean psql -U postgres -d postgres -f - < supabase/schema.sql
```

`supabase start` prints a local **API URL** and **anon key**; put those in
`.env.local` the same way. The dashboard runs at <http://127.0.0.1:54323> and
confirmation emails are caught at <http://127.0.0.1:54324> instead of being sent.
Stop it with `npx supabase stop`.

## Going back to browser-only mode

Delete `.env.local` (or comment out the two lines) and restart. The app returns
to the in-browser store with its sample content, which is handy for demos.
