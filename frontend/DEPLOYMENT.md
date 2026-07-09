# Sofia Frontend Deployment Guide

The frontend is a Vite + React + TypeScript single-page app. It builds to a
static bundle (`dist/`) that can be hosted anywhere that serves static files.

## Local development

```bash
cd frontend
npm install
cp .env.example .env   # set VITE_API_BASE_URL to your backend
npm run dev
```

## Configuration

The only required environment variable is `VITE_API_BASE_URL`, read at
**build time** by Vite (not at runtime) -- see `.env.example`.

```
VITE_API_BASE_URL=https://your-backend.onrender.com/api
```

Because it's baked in at build time, each deployment target (local, staging,
production) needs its own build with the right `VITE_API_BASE_URL` set.

## Building for production

```bash
cd frontend
npm install
npm run build
```

This produces a static bundle in `frontend/dist/`. Serve that directory as
your static site root; the app is a client-side-routed SPA, so your host
needs to rewrite unknown paths back to `index.html` (see `render.yaml`'s
`routes` config for the pattern).

## Deployment options

Any static host works, as long as it runs the build step above and serves
`dist/` with an SPA rewrite rule:

- **Render** (see `render.yaml` at the repo root) -- already configured with
  `buildCommand: cd frontend && npm install && npm run build` and
  `staticPublishPath: ./frontend/dist`.
- **Netlify / Vercel** -- set build command to `npm run build`, publish
  directory to `dist`, base directory to `frontend`.
- **GitHub Pages** -- build locally or in CI, then publish the `dist/`
  contents.

## Testing

1. **Local**: `npm run dev`, then exercise auth, chat, goals, story, and
   document upload against a running backend.
2. **Type safety**: `npm run typecheck` (also runs as part of `npm run build`).
3. **Production build**: `npm run build && npm run preview` to sanity-check
   the actual production bundle before deploying.

## Troubleshooting

- **CORS errors**: confirm the backend's `CORS_ORIGIN` matches the frontend's
  deployed origin.
- **401s everywhere**: check `VITE_API_BASE_URL` was set correctly at build
  time -- changing it requires a rebuild, not just a redeploy of old assets.
- **Blank page on a deep link** (e.g. refreshing `/goals`): the host isn't
  rewriting unknown paths to `index.html` -- see the SPA rewrite note above.
