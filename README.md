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

## Connecting a real backend (Supabase)

The app ships with a browser-only store so it runs with zero setup, but it is
ready for Supabase: set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in
`.env.local` and every request (accounts, posts, uploads) goes to your Supabase
project instead. Nothing in the pages changes — `src/services/api.ts` picks the
backend.

Step-by-step guide: **[SUPABASE.md](SUPABASE.md)**. The database schema,
security rules and storage bucket are in
[`supabase/schema.sql`](supabase/schema.sql).

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
