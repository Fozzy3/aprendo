# Aprendo — DESIGN.md

Visual system of record: **Cuaderno cuadriculado** (direction seed `6ffabd95`,
chosen 2026-10-10, see `plans/rediseno-institucional.md`). `apps/web/src/styles.css`
is the implementation; this file is the reasoning. When the two disagree, the
CSS is what ships — fix one or the other, don't let them drift.

## Thesis

The 5 mm squared notebook every Colombian student carries, used as an
instrument, not a costume: a ruling that everything respects, and a red margin
where the teacher's judgment lives. Hierarchy comes from the type scale and 1px
rules — never from cards, shadows or colour fills.

If a screenshot with the content removed looks like a children's school
template, it is wrong: no spirals, no handwriting, no stickers, no mascot.

## Theme

Light by default (daylight, a phone at arm's length), dark as "cuaderno de
noche": the paper turns to ink, the ruling dims, the inks lift. The resolved
theme is always a class on the root (`__root.tsx`), so there is exactly one dark
block (`:root.dark, :root[data-theme="dark"]`).

## Color

Five inks on cold white paper. Colour means state; position and shape mean
identity.

| Token | Light | Dark | Meaning |
|---|---|---|---|
| `--paper` (`--bg`) | `#fbfcfe` | `#0f1626` | The page. Never cream. |
| `--rule` | `#c9d8ea` | `#24324b` | The ruling and sheet edges |
| `--ink` (`--text-primary`, `--brand`) | `#16233f` | `#e4eaf4` | Text, primary actions |
| `--margin` (`--danger`) | `#c3352b` | `#e8695e` | Mistakes, risk, the teacher's note, the margin rule |
| `--green-ink` (`--success`) | `#2e6b45` | `#6cbf8b` | Correct, mastered |
| `--graphite` (`--warn`) | `#4a5263` | `#aab3c4` | Pencil: what is tentative (unsure, a deadline closing in) |
| `--accent` | `#1d4f91` | `#8db6ee` | Fountain-pen blue: links, focus, selection tint |

- The error red and the teacher's red are **one token**: the same gesture of
  correction.
- There is no gold, no violet and no gradient anywhere.
- `--bg-inset` (`#eef3f9`) is the desk a sheet lies on (solve, review, sign-in).
- **Areas** keep a small inked dot (`.subject-dot`): identical lightness and
  chroma, hue as the only variable, away from the red, green and blue inks.
  Never text, never a fill.

## Type

- **Source Serif 4** (600/700) — headings and figures: the voice of the report
  card and the acta.
- **Public Sans** (400–700) — everything else; `font-variant-numeric:
  tabular-nums` is set on `body` so every table and counter lines up.
- Scale does the hierarchy: page title `clamp(1.75rem…2.5rem)`, section title
  1.3rem, body 0.9–1rem, labels 0.75rem in `--text-tertiary`, sentence case,
  no tracking. **No eyebrow/kicker above a heading** — the heading speaks.
- No italics for display, no uppercase tracked labels.

## The grid

`--cell: 20px` (5 mm at 96 dpi). Layout that should sit on the ruling uses
multiples of it (the plan lines are 3 cells tall, the margin column is 3 cells
on a sheet and 9 on a page).

`.sheet` draws the ruling and the red margin rule three cells in. The ruling is
faint (`--grid`: 35% of `--rule`), like a real squared notebook: it sits under
the text and never competes with it. **The ruling
is a state**: only solve, review and the sign-in sheets carry it. On phones the
margin rule is dropped so the question keeps its width.

## Page grammar

- `.ruled-page`: a margin column (date, the facts a student writes at the top:
  study days, seats, licence) with a red rule, and a body. On phones the margin
  becomes one line of facts above the page.
- `.ruled-section`: a section opened by a rule. `.card` is the same thing — it
  no longer draws a box.
- `.ruled-list` / `.ruled-row`: lists on hairlines, label column on the left.
- `.plan-lines`: the day's plan as numbered lines; the first carries "Empezar".
- `.data-table`: hairlines between rows, figures right-aligned; a low result is
  written in red ink (`.is-low`), never highlighted.
- `.empty-state`: a heading and a line, left-aligned. No illustration.
- `.notice.is-danger`, `.margin-note`: red ink with a hairline, never a filled
  alert box.

## Controls

Rectangular (radii 2–4px). Primary: filled ink. Secondary: 1px outline. Ghost:
bare. No pills, no press animation, no hard offset shadows. Elevation
(`--shadow-md/lg`) exists only for things that float over the page: menus,
dialogs, sheets.

## Solve and review

- One question owns one sheet, centred on the desk, with its number in the red
  margin. Marked for review = **the number is circled**, as on the answer sheet.
- Crossed-out options get a pencil stroke (graphite line-through).
- The chosen option's letter is circled in ink; in review the key is circled in
  green with a check, a wrong pick in red with an ×.
- With a shared passage, the passage is the printed booklet (plain paper) and
  the question is the ruled sheet beside it.
- The next question's scan is preloaded while the current one is on screen.
- Under every question: its source (`ICFES · <booklet>` or "escrita por Aprendo
  con IA").
- Review: the explanation of the distractor the student chose is a note in the
  margin (red hairline, red title).

## Reports

Time is drawn exactly: in the simulacro report a pace bar's length is the
seconds per question on a scale shared by every area, with a tick at the
official pace; the part over pace is red.

## Co-branding

`SchoolLabel` is the notebook's cover label — a ruled box with the school's
crest and name over "Curso · Estudiante" — beside the Aprendo wordmark (one
ruled cell with its red margin). No per-school colour. Without a crest, the
name stands alone.

## Motion

One quiet fade on page entry; everything else is a 140ms colour change. All of
it is disabled under `prefers-reduced-motion`.

## Lesson demos

The AI-generated demos inherit these tokens through `lib/demo-document.ts` and
are told the same rules in `DEMO_FRAGMENT_RULES` (`packages/convex/src/lessons.ts`).
Changing the tokens or fonts means changing both and bumping `PROMPT_VERSION`.
