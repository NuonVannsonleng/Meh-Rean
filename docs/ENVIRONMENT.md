# Environment variables

Names and where to get them. Never put values in this file, the code, or
chat. Browser code only ever sees the `VITE_` Supabase URL and publishable key.

## Browser (Vite, `.env.local` / Vercel)

| Name | What | Where |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL | Supabase → Project Settings → API |
| `VITE_SUPABASE_PUBLISHABLE_KEY` (or `VITE_SUPABASE_ANON_KEY`) | Browser-safe key | same page; never the secret / service_role key |

Without both, the app runs in browser-only demo mode.

## Server only (Vercel → Settings → Environment Variables)

Used by `api/bacii-videos.ts`. After changing them, redeploy.

| Name | Required | What |
| --- | --- | --- |
| `GEMINI_API_KEY` | one AI key | Google AI Studio → Get API key (free tier) |
| `ANTHROPIC_API_KEY` | optional | Claude instead of Gemini; used when set |
| `YOUTUBE_API_KEY` | yes | Google Cloud → enable YouTube Data API v3 → Credentials (restrict it to that API) |
| `BACII_GEMINI_MODEL` | no | default `gemini-2.5-flash` |
| `BACII_AI_MODEL` | no | Claude model, default `claude-opus-5-5` |
| `BACII_DAILY_LIMIT` | no | lookups per student per day, default 20 |
| `BACII_COMPANION_LIMIT` | no | AI study companion requests per student per day, default 10 (uses the same AI key) |
| `YOUTUBE_DAILY_QUOTA` | no | the Google Cloud project's YouTube units a day, for the quota display; default 10000 |
| `BACII_SEARCH_CACHE_HOURS` | no | how long a YouTube search is reused by a warm server, default 24 |

For `npm run dev`, the same names can go in `.env.local` without a `VITE_`
prefix; `vite.config.ts` passes them to `api/` only.

## Tests

`.env.test` points the harnesses at the **local** Supabase
(`npx supabase start`): `SUPABASE_URL=http://127.0.0.1:54321` and the local
publishable key. The harnesses refuse hosted projects.
