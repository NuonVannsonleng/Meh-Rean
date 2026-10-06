<p align="center"><img src="public/brand/meh-rean-logo.png" alt="Meh Rean logo" width="320" /></p>

# Meh Rean

**Meh Rean** (មេរៀន, "lesson") is a study-sharing community for students everywhere. Students post lecture notes, slides, past papers, videos and photos, and the community reacts, comments, rates and saves the most useful ones.

## Features

- **Accounts:** sign up, sign in, sign out. Includes a demo account (`demo@mehrean.app` / `demo1234`).
- **Social feed:** posts with a title, description, subject, level, tags and attachments.
- **Uploads of any file type:** PDF, Word, slides, spreadsheets, archives, audio, images and video. Up to 10 files per post, 50 MB each (enforced by the storage bucket as well as the client).
- **Media:** image grid with a full-screen lightbox, inline video and audio players, and file cards with open/download.
- **Interactions:** five reactions, comments, 1–5 star ratings, save to collection, and share (native share sheet or copy link).
- **Discovery:** live search, sorting (latest / top rated / most discussed), and filters for subject, level and content type. All of it is stored in the URL, so filtered views can be shared.
- **Profiles:** banner and avatar (with a drag-and-zoom crop step), bio, school, field, country, stats, followers and following lists, plus a private "Saved" tab.
- **Follow students** to see who shares what, with follower and following counts on every profile.
- **Verified accounts:** anyone can request a blue check from Settings; an admin approves or rejects it. The badge cannot be self-granted.
- **Settings:** edit profile and avatar, change password, delete account, and theme.
- **Brand theme from the logo:** book-cover green, bookmark teal, cream notebook pages, in light, dark and system modes with no flash on load.
- **Custom reaction icons** (Like, Love, Insightful, Helpful, Wow) with a burst animation, plus bookmark-drop, star-pop, staggered feed and page transitions. All motion respects reduced-motion settings.
- **Works on every screen:** tested from 320px phones through landscape phones and tablets up to 1920px desktops. Phones get a bottom tab bar and bottom sheets; wide screens get a three-column layout. Safe areas for notched phones, 44px tap targets, and no iOS zoom on input focus.
- **BacII (Grade 12):** a section for students preparing for Cambodia's national exam. Its first option, *Find a video for an exercise*, reads a photo or typed exercise with AI and finds YouTube lessons that teach it, with videos of the very same exercise first.
- **Installable:** add it to your home screen on iOS or Android and it opens full-screen like an app, using the Meh Rean icon.

## Tech stack

Vite · React 19 · TypeScript (strict) · React Router 7 · Tailwind CSS v4. No UI library; the icons are inline SVGs.

## Setup

```bash
npm install
```

## Development

```bash
npm run dev
```

## Production build

```bash
npm run build
```

## Refreshing the school and university data

```bash
node scripts/build-institutions.mjs   # universities (public/data/institutions.json)
node scripts/build-high-schools.mjs   # high schools, one file per country (public/data/schools/)
node scripts/build-logos.mjs          # logos for both (public/logos/); run last
```

High schools come from Wikidata (CC0) and, for Cambodia, OpenStreetMap
(© OpenStreetMap contributors, ODbL): Wikidata knows only one Cambodian school.
Hand-checked additions and search aliases live in
`scripts/high-schools-extra.json`.

Logos come only from Wikimedia Commons, so every one is freely licensed or too
simple to be copyrighted; `public/logos/credits.json` and the in-app
**Credits** page record the source, licence and author of each. Files that
turn out not to be logos go in `scripts/logo-exclusions.json`. Thailand is
excluded throughout.

## Connecting a real backend (Supabase)

The app ships with a browser-only store so it runs with zero setup, but it is
ready for Supabase: set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in
`.env.local` and every request (accounts, posts, uploads) goes to your Supabase
project instead. Nothing in the pages changes — `src/services/api.ts` picks the
backend.

Step-by-step guide: **[SUPABASE.md](SUPABASE.md)**. The database schema,
security rules and storage bucket are in
[`supabase/schema.sql`](supabase/schema.sql).

## BacII video finder

`/bacii/videos` reads an exercise with AI and searches YouTube from a Vercel
Function ([`api/bacii-videos.ts`](api/bacii-videos.ts)), so the keys never
reach the browser. To turn it on, add these in Vercel → Project → Settings →
Environment Variables, then redeploy:

| Variable | Where to get it |
| --- | --- |
| `GEMINI_API_KEY` | [aistudio.google.com](https://aistudio.google.com) → Get API key (free tier) |
| `YOUTUBE_API_KEY` | Google Cloud console → enable **YouTube Data API v3** → Credentials → API key |
| `ANTHROPIC_API_KEY` (optional) | Use Claude instead of Gemini; when set, it is used |
| `BACII_GEMINI_MODEL` (optional) | Defaults to `gemini-flash-latest` |
| `BACII_DAILY_LIMIT` (optional) | Lookups per student per day, default 20 |

Re-run [`supabase/schema.sql`](supabase/schema.sql) as well: it adds the table
that counts each student's lookups. Only signed-in students can use it. Each
lookup uses two YouTube searches (200 of YouTube's free 10,000 daily quota
units, so about 50 lookups a day) until you ask Google for more quota. Without
the keys, and in the browser-only preview, the page offers ready-made YouTube
searches instead. For `npm run dev`, put the two keys in `.env.local`
(without a `VITE_` prefix, so they stay on the server).

## Current limitations

- **Browser-only by default.** Without Supabase configured, accounts, posts and interactions live in `localStorage` and uploaded files in IndexedDB, so data stays on one device and nobody else can see your posts. Connecting Supabase (above) removes this limitation.
- Passwords are hashed (PBKDF2) in the browser. This is a stand-in until real server-side authentication exists; it does not make local accounts secure.
- Seed content is sample data, and the sample PDFs and video point to public placeholder files.

## Architecture

Every data access goes through `src/services/api.ts`. The in-browser store lives in `src/services/db.ts` and `src/services/files.ts`. Pages never touch storage directly, so a real backend only needs to replace the function bodies in `api.ts`. All UI text is in `src/i18n/en.ts`, ready for more languages such as Khmer.

## Roadmap

1. **Backend:** done — connect Supabase (Postgres, auth, storage) with [SUPABASE.md](SUPABASE.md).
2. **Community:** following, notifications, reporting and moderation, and Telegram / Google sign-in.
3. **Localization:** Khmer and other languages.
