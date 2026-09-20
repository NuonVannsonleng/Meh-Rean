# Course Hub

A web app for Cambodian students — high school grades 7–12 and university years 1–4 — to find their subjects and share study materials such as lecture notes, past exam papers and presentation slides, in one place instead of scattered across Telegram groups, Drive folders and Messenger threads.

Every course belongs to an institution, which is either a **high school** or a **university**. The UI adapts to which: schools show *Grade 7–12* and a *Teacher*, universities show *Year 1–4* and a *Lecturer*. A student whose school or university is not listed yet can add it, along with their subject, while uploading.

This repository currently contains **Phase 1: the frontend prototype**. It runs entirely on mock data.

## Features

- **High schools and universities together** — 3 schools and 5 universities in the mock data, each shown on its card and course page.
- **Course discovery** — browse all courses in a responsive card grid (1 / 2 / 3 columns).
- **Live search** — filters as you type across subject code, subject name, teacher/lecturer and institution (name or abbreviation), case-insensitive.
- **Level, institution, grade/year and semester filters** — four chip rows that all combine with search. Choosing *High school* narrows the institution chips to schools and swaps the level chips to Grade 7–12; *University* swaps them to Year 1–4. Horizontally scrollable on small screens.
- **Course detail pages** — header with institution, teacher or lecturer, grade or year and semester, plus all resources.
- **Resource tabs** — All / Notes / Papers / Slides, each with a live count, that actually filter the list, with a sliding active indicator.
- **Resource cards** — title, type badge, uploader, friendly date and a download link to the mock file URL.
- **Upload form** — pick your school or university (grouped into *High schools* and *Universities*), then the subject; the subject list narrows to that institution. Add a new subject (code, name, teacher/professor, grade or year, semester) when it is missing, or add your school or university entirely when it is not listed — you say whether it is a high school or a university, and the form relabels itself accordingly. Inline accessible validation throughout.
- **Upload success state** — confirms submission and makes clear nothing is persisted.
- **Loading, empty and error states** — skeleton loaders, a reset-filters empty state, and a friendly retryable error state.
- **404 page** for unknown routes.
- **Accessibility** — semantic landmarks, labelled form fields, keyboard navigation, a skip link and visible focus rings.
- **Motion** — staggered card entrance, card and button lift, sliding tab indicator, shimmer skeletons, animated form reveals and success state. All of it is switched off under `prefers-reduced-motion`.
- **Mobile-first responsive design**, verified from 375px up to 1440px.
- **Khmer-ready** — Inter + Noto Sans Khmer font stack, and all UI copy centralised in `src/i18n/en.ts` so a `km.ts` can be added later.

## Tech Stack

- [Vite](https://vite.dev/)
- [React](https://react.dev/) 19
- TypeScript (strict, no `any`)
- [React Router DOM](https://reactrouter.com/)
- [Tailwind CSS v4](https://tailwindcss.com/) via `@tailwindcss/vite`

No UI component library and no icon package — icons are small local SVG components.

## Setup

```bash
npm install
```

## Development

```bash
npm run dev
```

The app runs at http://localhost:5173.

## Production Build

```bash
npm run build
```

Type-checks with `tsc -b`, then builds to `dist/`. Preview the output with `npm run preview`.

## Project Structure

```text
src/
├── components/      Navbar, SearchBar, CourseCard, ResourceCard, ChipGroup,
│                    RadioGroup, EmptyState, LoadingState, ErrorState, Icons
├── pages/           Home, CourseDetail, Upload, NotFound
├── services/api.ts  All data access (async, mock-backed)
├── data/mock.ts     Mock institutions, courses and resources
├── i18n/en.ts       All user-facing copy
├── types.ts         Shared types
├── App.tsx          Routing and app shell
├── main.tsx         Entry point
└── index.css        Tailwind import, design tokens, global styles
```

Pages never import mock data directly — everything goes through `services/api.ts`, so Phase 2 only needs to replace those function bodies with real HTTP calls.

## Current Limitations

- **Mock data only** — institutions, courses and resources come from `src/data/mock.ts` (8 institutions, 28 courses, 73 resources).
- **No backend** and no real API.
- **No authentication** and no user accounts.
- **No persistent uploads** — the upload form validates, calls `createResource()` (plus `createCourse()` / `createInstitution()` when you add them) and logs each payload, but nothing is saved. An institution or subject added here does not appear in the course list, and refreshing loses it.
- **No real file storage** — every download link points at a public placeholder PDF.
- No reviews, ratings, moderation, notifications or admin tools.

## Future Roadmap

- **Phase 2** — Node.js + TypeScript + Express + MySQL: real API, real file uploads, server-side search, persistent institutions, courses and resources, plus moderation of student-submitted schools and subjects.
- **Phase 3** — Telegram login, user accounts, anonymous reviews, reporting and moderation.
- **Phase 4** — Telegram bot integration: course/resource search, reminders and new-resource notifications.
