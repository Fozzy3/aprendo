# Aprendo

Aprendo is a Convex-backed PDF ingestion and question browsing app for ICFES-style content. Admins upload exam PDFs, the backend runs OCR and question extraction, stores images/assets in Convex File Storage, and saves questions as markdown-first documents that the web app can render directly.

## What is here

- `apps/web`: TanStack Start app with the current admin and browsing UI
- `packages/convex`: Convex schema, queries, mutations, and the PDF processing pipeline
- `packages/ingest`: reusable OCR and question-extraction core used by Convex actions

## Current product surface

The web app currently has three routes:

- `/`: dummy Convex page for query/mutation wiring
- `/upload-pdfs`: admin page to upload PDFs and monitor processing
- `/questions`: browser for saved questions, including markdown, math, and embedded assets

## Ingest pipeline

Each uploaded PDF goes through this flow:

1. The browser uploads the PDF directly to Convex File Storage.
2. A `pdfUploads` record is created and scheduled for processing.
3. A Convex Node action reads the stored PDF and runs OCR with Mistral.
4. Extracted page assets are stored in Convex File Storage and assigned public URLs.
5. Gemini extracts structured questions from the OCR markdown.
6. Questions are persisted in Convex with:
   - `bodyMarkdown` containing the full prompt/context
   - markdown image references rewritten to Convex public URLs
   - `options[].bodyMarkdown` for answer choices
7. The upload record is updated with processing status, counts, and links to debug artifacts.

## Data model

The main Convex tables are:

- `pdfUploads`: source PDF metadata, processing status, counts, and debug artifact references
- `questions`: saved independent questions keyed by upload and sequence

Questions are stored in a denormalized, markdown-first format. The canonical renderable fields are the markdown strings themselves, not separate context/stem asset lists.

## Repo layout

```text
apps/
  web/
packages/
  convex/
  ingest/
```

## Environment

### Convex backend

Set these env vars on your Convex deployment:

```bash
cd packages/convex
npx convex env set MISTRAL_API_KEY your_key
npx convex env set GEMINI_API_KEY your_key
```

### Web app

Set the Convex deployment URL locally:

```bash
cp apps/web/.env.local.example apps/web/.env.local
```

Then set:

```bash
VITE_CONVEX_URL=...
```

## Local setup

1. Install dependencies:

   ```bash
   bun install
   ```

2. Start Convex in one terminal:

   ```bash
   cd packages/convex
   bunx convex dev
   ```

3. Start the web app in another terminal:

   ```bash
   cd apps/web
   bun run dev
   ```

You can also run the monorepo dev workflow from the repo root:

```bash
bun run dev
```

## Useful commands

- `bun run dev`: run workspace dev tasks via Turbo
- `bun run build`: build all workspace packages/apps
- `bun run typecheck`: run TypeScript checks across the repo
- `bun run test`: run workspace test tasks
- `cd packages/convex && bunx convex dev`: run the Convex backend locally
- `cd apps/web && bun run dev`: run the web app locally

## Rendering notes

- Question bodies and options are rendered with Streamdown.
- Math rendering is enabled through the Streamdown math plugin and KaTeX.
- Images inside markdown resolve through Convex File Storage public URLs.

## Important files

- `/Users/julian/Dev/aprendo/packages/convex/src/schema.ts`
- `/Users/julian/Dev/aprendo/packages/convex/src/pdfs.ts`
- `/Users/julian/Dev/aprendo/packages/convex/src/pdfPipeline.ts`
- `/Users/julian/Dev/aprendo/packages/ingest/src/ocr-core.ts`
- `/Users/julian/Dev/aprendo/packages/ingest/src/question-extraction-core.ts`
- `/Users/julian/Dev/aprendo/apps/web/src/routes/upload-pdfs.tsx`
- `/Users/julian/Dev/aprendo/apps/web/src/routes/questions.tsx`
