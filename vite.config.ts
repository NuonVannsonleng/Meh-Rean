import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/** Server-only settings for api/ functions; never exposed to the browser. */
const SERVER_ENV = [
  "GEMINI_API_KEY",
  "BACII_GEMINI_MODEL",
  "GEMINI_BASE_URL",
  "ANTHROPIC_API_KEY",
  "YOUTUBE_API_KEY",
  "BACII_AI_MODEL",
  "BACII_DAILY_LIMIT",
  "ANTHROPIC_BASE_URL",
  "YOUTUBE_API_BASE",
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "VITE_SUPABASE_ANON_KEY",
];

/**
 * Serves api/*.ts during `npm run dev` the way Vercel does in production:
 * each file's exported POST/GET handler gets a web Request.
 */
function devApi(mode: string): Plugin {
  return {
    name: "meh-rean-dev-api",
    apply: "serve",
    configureServer(server) {
      // Values already in the environment win, as they do for Vite itself.
      const fileEnv = loadEnv(mode, process.cwd(), "");
      for (const name of SERVER_ENV) if (!process.env[name] && fileEnv[name]) process.env[name] = fileEnv[name];

      server.middlewares.use(async (req, res, next) => {
        const match = req.url?.match(/^\/api\/([a-z0-9-]+)(\?.*)?$/);
        if (!match) return next();
        try {
          const module = (await server.ssrLoadModule(`/api/${match[1]}.ts`)) as Record<string, unknown>;
          const handler = module[req.method ?? "GET"];
          if (typeof handler !== "function") {
            res.statusCode = 405;
            return res.end();
          }
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          const headers = new Headers();
          for (const [key, value] of Object.entries(req.headers)) if (typeof value === "string") headers.set(key, value);
          const request = new Request(`http://${req.headers.host ?? "localhost"}${req.url}`, {
            method: req.method,
            headers,
            body: chunks.length ? Buffer.concat(chunks) : undefined,
          });
          const response = (await handler(request)) as Response;
          res.statusCode = response.status;
          response.headers.forEach((value, key) => res.setHeader(key, value));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (error) {
          server.config.logger.error(String(error));
          res.statusCode = 500;
          res.end();
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), devApi(mode)],
}));
