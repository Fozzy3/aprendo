# @aprendo/ingest

Pipeline for extracting structured multiple-choice questions from scanned exam PDFs (ICFES/SAT style).

## How it works

The ingestion pipeline has two stages:

### 1. OCR (`bun run ocr:sample`)

Uses the **Mistral OCR API** to convert a scanned PDF into per-page markdown files and extracted image assets.

- Input: a PDF file (e.g. `data/pdfs/Matemáticas2010.pdf`)
- Output: markdown pages + image assets under `.artifacts/mistral-ocr/<exam>/`
- Entry point: `src/mistral-ocr-sample.ts`

### 2. Question extraction (`bun run extract:sample`)

Uses **Gemini Flash** (via Vercel AI SDK) to parse the OCR'd markdown pages into a structured JSON array of questions.

- Input: the markdown pages produced by stage 1
- Output: `questions.json` in the same artifacts directory
- Entry point: `src/question-extractor.ts`
- Schema: `src/question-schema.ts`

The LLM handles edge cases like shared context blocks across multiple questions, images as answer options, LaTeX formulas, and tables embedded in questions. Images are not sent to Gemini — only the markdown text. Image paths are preserved as references in the structured output.

## Environment

Requires a `.env` file in this package (see `.env.example`):

```
MISTRAL_API_KEY=...
GEMINI_API_KEY=...
```

## Artifacts

All intermediate and final outputs live under `.artifacts/` (git-ignored). For the sample PDF the structure looks like:

```
.artifacts/mistral-ocr/matematicas2010/
  assets/          # extracted images from OCR
  pages/           # per-page markdown from OCR
  questions.json   # structured question output from extraction
```
