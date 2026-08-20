# @aprendo/web

Student-facing TanStack Start app for the Aprendo monorepo.

## Current routes

- `/`: landing page
- `/auth`: dummy auth form
- `/dashboard`: placeholder dashboard backed by a server function

## Notes

- Shared placeholder content comes from `@aprendo/db`.
- The dashboard route uses a server function in `src/lib/dashboard-data.server.ts`.
- This package intentionally avoids real auth, OCR uploads, and recommendation logic for now.
