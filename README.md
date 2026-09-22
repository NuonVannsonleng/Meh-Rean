# Meh Rean

**Meh Rean** (មេរៀន, "lesson") is a study-sharing community for students everywhere. Students post lecture notes, slides, past papers, videos and photos, and the community reacts, comments, rates and saves the most useful ones.

## Features

- **Accounts:** sign up, sign in, sign out. Includes a demo account (`demo@mehrean.app` / `demo1234`).
- **Social feed:** posts with a title, description, subject, level, tags and attachments.
- **Uploads of any file type:** PDF, Word, slides, spreadsheets, archives, audio, images and video. Up to 10 files per post, 100 MB each.
- **Media:** image grid with a full-screen lightbox, inline video and audio players, and file cards with open/download.
- **Interactions:** five reactions (👍 ❤️ 💡 🙏 🤯), comments, 1–5 star ratings, save to collection, and share (native share sheet or copy link).
- **Discovery:** live search, sorting (latest / top rated / most discussed), and filters for subject, level and content type. All of it is stored in the URL, so filtered views can be shared.
- **Profiles:** bio, school, field, country and stats, plus a private "Saved" tab.
- **Settings:** edit profile and avatar, change password, delete account, and theme.
- **Light, dark and system themes**, with no flash on load.
- Mobile-first layout with a bottom navigation bar, accessible forms, keyboard support and reduced-motion support.

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

## Current limitations

- **No server yet.** Accounts, posts and interactions are stored in the browser's `localStorage`, and uploaded files are stored in IndexedDB. Data stays on one device and browser, and other people can't see your posts.
- Passwords are hashed (PBKDF2) in the browser. This is a stand-in until real server-side authentication exists; it does not make local accounts secure.
- Seed content is sample data, and the sample PDFs and video point to public placeholder files.

## Architecture

Every data access goes through `src/services/api.ts`. The in-browser store lives in `src/services/db.ts` and `src/services/files.ts`. Pages never touch storage directly, so a real backend only needs to replace the function bodies in `api.ts`. All UI text is in `src/i18n/en.ts`, ready for more languages such as Khmer.

## Roadmap

1. **Backend:** Node.js + Express + a database, a real API, and cloud file storage, so posts become visible to everyone.
2. **Community:** following, notifications, reporting and moderation, and Telegram / Google sign-in.
3. **Localization:** Khmer and other languages.
