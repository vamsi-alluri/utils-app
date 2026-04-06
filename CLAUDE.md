# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start Vite dev server at http://localhost:5173
npm run build        # Type-check (tsc) then build to dist/
npm run preview      # Preview production build
npm run lint         # Run ESLint
npm run test         # Run Vitest unit tests
npm run test:ui      # Run Vitest with browser UI dashboard
npm run test:coverage # Generate coverage report
```

## Architecture

This is a React 19 SPA (Single Page App) — a utility dashboard with three tools, deployed on Vercel.

**Stack:** React 19, TypeScript, Vite, React Router v7, Tailwind CSS 4, Firebase Auth, Vitest + Happy DOM

**Routing** (`src/App.tsx`): All three utility modules are lazy-loaded. Only `/jd-screener` is auth-protected via `AuthGuard`. Public routes: `/`, `/pdf/*`, `/image/*`, `/privacy`, `/terms`.

**Utility Modules** (`src/utilities/`):
- **JD Screener** — Auth-gated. Sends job description text to a Cloud Function backend, renders AI-generated markdown analysis. Uses `fetchWithRetry` for resilient API calls. Updates favicon and plays a notification sound when complete.
- **PDF Tools** — Public. Sub-routes: `/pdf/j2p` (JPG→PDF), `/pdf/p2j` (PDF→JPG), `/pdf/mergePdfs`. Uses `pdf-lib`, `pdfjs-dist`, `jszip`.
- **Image Tools** — Public. Crop and resize modes using `cropperjs` + Canvas API. Supports multiple aspect ratios and unit conversions. EXIF extraction via `exifr`.

**Auth** (`src/helpers/firebase.ts`): Firebase Google OAuth. Tokens are cached for 1 hour with a 5-minute proactive refresh threshold. `AuthGuard` wraps protected routes.

**API Client** (`src/helpers/api.ts`): `fetchWithRetry` implements exponential backoff. On auth errors (401/403), it retries with a refreshed token before giving up.

**Config** (`src/config.ts`): Typed loader for environment variables. All Firebase config + JD Screener API URL come from `.env` (git-ignored).

**Path alias:** `@/` maps to `src/` in both Vite and Vitest configs.

## Environment Setup

Copy `.env.example` (or create `.env`) with Firebase project credentials and the JD Screener Cloud Function URL. Firebase mocks are set up in `src/test/setup.ts` so tests run without real credentials.
