// Stands in for localApi.ts in builds that talk to Supabase (see vite.config.ts):
// api.ts never calls the browser-only store there, so its demo data and rules
// stay out of the bundle. Only what api.ts reads outside the backend is here.
export { DEMO_ACCOUNT } from "../data/demoAccount";
