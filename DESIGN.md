---
name: Aprendo
description: ICFES Saber 11 preparation. Plan de estudio on student screens, Cuaderno cuadriculado everywhere else.
colors:
  plan-cover: "#1c1a1f"
  plan-cover-on: "#2e2b33"
  plan-brand: "#d91e3c"
  plan-brand-deep: "#bd1631"
  plan-action: "#d91e3c"
  plan-action-hover: "#bd1631"
  plan-action-text: "#b8122f"
  plan-mark: "#fbdbe0"
  plan-panel: "#1c1a1f"
  plan-green-ink: "#08704a"
  plan-success-text: "#075f3f"
  plan-ink: "#1c1a1f"
  plan-text-secondary: "#4d4853"
  plan-text-tertiary: "#6a6570"
  plan-graphite: "#5a5560"
  plan-paper: "#ffffff"
  plan-card-hover: "#fbfaf8"
  plan-desk: "#f6f4f1"
  plan-inset: "#e8e4df"
  plan-rule: "#e3dfda"
  plan-hairline: "rgba(28, 26, 31, 0.12)"
  plan-hairline-strong: "rgba(28, 26, 31, 0.24)"
  plan-red: "#c8321f"
  plan-red-text: "#a31d10"
  plan-red-soft: "#ffe6e2"
  plan-area-lectura: "#6d3fc0"
  plan-area-matematicas: "#097d52"
  plan-area-ciencias: "#0a6fb0"
  plan-area-sociales: "#b4540a"
  plan-area-ingles: "#b3257a"
  plan-dark-paper: "#1d1b20"
  plan-dark-card: "#1f1d23"
  plan-dark-desk: "#131215"
  plan-dark-ink: "#f4f2ef"
  plan-dark-cover: "#0c0b0e"
  plan-dark-brand: "#f0364f"
  plan-dark-action: "#d91e3c"
  plan-dark-action-text: "#ff8a9c"
  plan-dark-red: "#f0796a"
  notebook-paper: "#fbfcfe"
  notebook-rule: "#c9d8ea"
  notebook-ink: "#16233f"
  notebook-margin: "#c3352b"
  notebook-green-ink: "#2e6b45"
  notebook-graphite: "#4a5263"
  notebook-pen: "#1d4f91"
  notebook-desk: "#e6edf6"
typography:
  plan-score:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 800
    lineHeight: 1.05
    fontFeature: "tnum"
  plan-title:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 800
    lineHeight: 1.15
  plan-headline:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 800
    lineHeight: 1.2
  plan-section:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.3
  plan-question:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 500
    lineHeight: 1.4
  plan-body:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
  plan-support:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.4
  plan-meta:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 700
  notebook-display:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontWeight: 600
  notebook-body:
    fontFamily: "Public Sans, ui-sans-serif, system-ui, sans-serif"
    fontWeight: 400
rounded:
  plan-sm: "8px"
  plan-md: "12px"
  plan-lg: "16px"
  plan-pill: "999px"
  notebook-sm: "2px"
  notebook-md: "3px"
  notebook-lg: "4px"
spacing:
  plan-gutter: "16px"
  plan-card: "20px"
  plan-stack: "24px"
  plan-touch: "44px"
  plan-row: "64px"
  notebook-cell: "20px"
components:
  plan-button-primary:
    backgroundColor: "{colors.plan-action}"
    textColor: "{colors.plan-paper}"
    typography: "{typography.plan-body}"
    rounded: "{rounded.plan-md}"
    padding: "0.625rem 1.25rem"
    height: "3rem"
  plan-button-primary-hover:
    backgroundColor: "{colors.plan-action-hover}"
    textColor: "{colors.plan-paper}"
  plan-button-secondary:
    backgroundColor: "{colors.plan-paper}"
    textColor: "{colors.plan-ink}"
    rounded: "{rounded.plan-md}"
    padding: "0.625rem 1.25rem"
    height: "3rem"
  plan-button-secondary-hover:
    backgroundColor: "{colors.plan-card-hover}"
  plan-next-card:
    backgroundColor: "{colors.plan-paper}"
    textColor: "{colors.plan-ink}"
    rounded: "{rounded.plan-lg}"
    padding: "20px 20px 20px 24px"
  plan-list-row:
    backgroundColor: "{colors.plan-paper}"
    textColor: "{colors.plan-ink}"
    rounded: "{rounded.plan-lg}"
    padding: "0.875rem 1rem"
    height: "{spacing.plan-row}"
  plan-next-tag:
    backgroundColor: "{colors.plan-mark}"
    textColor: "{colors.plan-ink}"
    typography: "{typography.plan-meta}"
    rounded: "{rounded.plan-pill}"
    padding: "0.125rem 0.5rem"
  plan-area-chip:
    backgroundColor: "{colors.plan-paper}"
    textColor: "{colors.plan-ink}"
    rounded: "{rounded.plan-pill}"
    padding: "0 1rem"
    height: "2.75rem"
  plan-solve-option:
    backgroundColor: "{colors.plan-desk}"
    textColor: "{colors.plan-ink}"
    rounded: "{rounded.plan-md}"
    padding: "12px 14px"
    height: "56px"
  plan-ask-chip:
    backgroundColor: "{colors.plan-paper}"
    textColor: "{colors.plan-ink}"
    rounded: "{rounded.plan-md}"
    padding: "13px 15px"
  notebook-button-primary:
    backgroundColor: "{colors.notebook-pen}"
    textColor: "{colors.notebook-paper}"
    rounded: "{rounded.notebook-md}"
---

# Aprendo — DESIGN.md

> Two systems coexist, chosen per route by `lib/student-look.ts`, which sets `data-look` on `<html>`. Student screens (Hoy, Aprende, Retos, Yo, lessons, practice, placement, duel, `/join`, `/cuenta`), sign-in (`/login`, `/reset-password`) and the teacher's panel (`/teacher/*` except the printable guide and the projector) use **Plan de estudio**, the second half of this file; it replaced Álbum on 2026-11-10 and reached sign-in and teachers on 2026-11-13. School admin, staff, public pages, the printable guide and print use **Cuaderno cuadriculado**, the first half. Passages in the notebook half that mention students (solve and review, button sizes) predate the student look; on a student's screen, Plan de estudio governs.

# Cuaderno cuadriculado: teacher, school, staff, public and print

System of record for those screens: **Cuaderno cuadriculado** (direction seed `6ffabd95`,
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
| `--accent`, `--brand` | `#1d4f91` | `#8db6ee` | Fountain-pen blue: primary actions, links, focus, selection tint |
| `--cover` | `#16233f` | `#1a2742` | The notebook's navy cover: the top bar |
| `--desk` | `#e6edf6` | `#0a101c` | The pale blue desk the pages lie on |

- The error red and the teacher's red are **one token**: the same gesture of
  correction.
- There is no gold, no violet and no gradient anywhere.
- **The landing is the exception** (2026-11-11): it wears the brand red (`.landing` re-maps `--brand`/`--accent` to #b3132f). A full-bleed red cover holds the bar, the promise and both CTAs (white primary on red); the class sheet lies across the cover's lower edge with a float shadow; the contact band closes in the same red. The panels it shows stay on the notebook.
- **Frame:** the top bar is the navy cover; inside it the colour tokens are re-mapped to white (`.student-topbar`), so nothing in it needs its own cover styles. Every page is a sheet (`.ruled-page`, `.page-sheet`: paper, 1px rule border) on the blue desk, so the screen is never a white void.
- Inside an area's page (`--subject-color` on the page), the active tab and the level bars take that area's ink.
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

Rectangular (radii 2–4px). Primary: filled fountain-pen blue, the one saturated colour on a page. Secondary: 1px outline. Ghost:
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

Progress is drawn, not written. Every area sits on one 0-100 bar in its
own ink, with the ICFES cut points as paper gaps and a tick where the student
started (`AreaLevelsChart`). A class is one 100% bar per area split by level:
level 1 in the margin's red, 2-4 deepening the pen's blue, "not levelled yet"
as a pencil hatch (`--level-*`); each student is a row of level chips.
Detail that does not change what to do next stays out (topic mastery lives in
the Temario, sessions in the Historial).

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

## Ajustes del audit de diseño (2026-10-29)

- **Botón pequeño:** `.btn-sm` (2rem) solo en pantallas de docente. En las del estudiante los botones conservan 40 px por el tacto. `text-xs` no sirve sobre `.btn-*`: las clases de `styles.css` no están en capa y le ganan a las utilidades de Tailwind. Lo mismo pasa con `text-right` en `.data-table`: para números se usa `.is-number`.
- **Iconos:** dentro de un botón miden 1rem (0.875rem en `.btn-sm`), lo fija una sola regla.
- **Controles:** todos rectangulares (`--radius-md`). Nada de `999px` ni sombras en reposo.
- **Hover:** solo con `@media (hover: hover) and (pointer: fine)`. En pantallas táctiles el mismo aspecto aparece en `:active`. Sin resaltado azul al tocar.
- **Movimiento:**
  - `.fade-in` es solo opacidad, 180 ms y `backwards`. Una transformación que se queda aplicada atrapaba a los hijos `position: fixed`.
  - La hoja del tutor entra desde su borde: abajo en el teléfono, a la derecha en pantallas anchas. Se cierra al instante.
  - Solo un tema que sube de nivel se anima, en el cierre de sesión.
- **Cifras:** tabulares en tablas y contadores, proporcionales en la prosa (`.page-lede`, `.markdown-body`).
- **Errores:** siempre `.notice.is-danger`, nunca una caja rellena.

---

# Plan de estudio: student screens

Implementation: `apps/web/src/student.css`, scoped to `html[data-look='student']` and to `@media screen`, so a printed student report stays on the notebook. Components it does not restyle inherit structure from `styles.css` with these tokens swapped in. Where this section and the CSS disagree, the CSS is what ships.

## Overview

**Palette A, "Tinta con rojo de acento" (2026-11-11, second change that day):** the owner found the crimson surfaces and the area-coloured cards with a red button arbitrary, and picked palette A from `plans/reports/paletas-escritorio.html` (frame `.a`). Near-black ink is the brand surface, warm paper the desk, white the cards; red is only action and progress. Area colours shrink to dots, thin bars and edges.

**Creative North Star: "Plan de estudio"**

Every screen answers three things in words: what to do now, why, and how each topic is going. Hoy is a plan, not a game board: a white card with a red edge holding the next step and its reason and the one red button, then the rest of the day and the five areas with their level and bar. Aprende lists every topic of an area with its level and accuracy. Progress is named, never a numbered slot.

Density is low and the phone comes first: white cards on a warm paper desk, one family of type, flat controls that answer a press with a small scale. On a computer the same screens get a side rail and use the width. The register is calm and credible, for students of 15 to 17 in short sessions and mixed light. It replaced the Álbum (sticker album) on 2026-11-10 because the metaphor read as unclear and decorative.

**Review status.** Palette A and the desktop layout were reviewed live (2026-11-11) on a fresh dev account after the diagnostic: Hoy, Aprende, Retos, Yo, the reward, the welcome and `/encuesta` at 1280×900 and 390 wide, light and dark, no horizontal scroll. The streak-milestone card (3/7/14/30 days), the class league and "Para continuar" were not on screen with that data.

**Key Characteristics:**
- White cards on warm paper (#f6f4f1), 1px hairlines, 16px corners.
- Ink (#1c1a1f) for the brand surfaces: the side rail and top bar, the Yo cover, the streak moment, the guided-question panel.
- Action red (#d91e3c, white text) for the one primary action and for progress (goal bar, done days, the active nav marker, the next card's edge). Never a large surface.
- Selection is ink: a chosen area pill, day, avatar part or welcome option.
- Area colours as dots, bars and a 4px edge only, never a card's ground.
- Figtree alone, 400 to 800, on seven type steps.
- Flat controls; a press is scale 0.97. One authored moment: the level-up flash on the reward.

## Colors

A quiet warm-paper page, an ink frame, and one saturated voice: red, for "do this" and "you moved".

### Primary
- **Ink** (#1c1a1f, `--cover`, `--ink`): the side rail and the top bar (active item on #2e2b33, `--cover-on`), the Yo cover, the streak moment, the duel bar, the guided panel. Text and selections use the same ink.
- **Action Red** (#d91e3c, hover #bd1631, white text at 4.9:1; tokens `--sticker`, `--brand`, `--accent`): the one primary action, the goal meter, done days in the week strip, the red inset edge of the next-step card and of the first reto, the active section marker (rail icon, tab label, top-nav underline), the welcome progress bar. Text-sized red on white is #b8122f (`--accent-text`).
- **Rose Mark** (#fbdbe0, ink text; `--mark`): small marks that are never pressed: the "Siguiente" tag and the current topic tint, today in the week strip, the daily-goal icon, done beads, the hint panel, the student's own league row, portrait ground, medals.

### Secondary
Area colours, set on an element as `--area` (in solve, `--field`). They do not change in dark mode.
- **Lectura Violet** (#6d3fc0), **Matemáticas Green** (#097d52), **Ciencias Blue** (#0a6fb0), **Sociales Amber** (#b4540a), **Inglés Magenta** (#b3257a).

### Neutral
- **Secondary and Tertiary Text** (#4d4853, #6a6570).
- **Paper** (#ffffff), **Card Hover** (#fbfaf8), **Desk** (#f6f4f1), **Track / Inset** (#e8e4df), **Rule** (#e3dfda); hairlines rgba(28, 26, 31, 0.12) and 0.24.
- **Correct** stays green ink (#08704a). **Correction** stays vermilion (#c8321f, text #a31d10 on #ffe6e2), warmer than the action red; a wrong answer always carries its × and ring, never colour alone.
- **Dark (ink-first night):** rail #0c0b0e with a hairline edge, desk #131215, card #1f1d23, paper #1d1b20, track #2e2b33, ink #f4f2ef, text #d3cfd8 / #aaa4b0. The action keeps #d91e3c with white text; bars and done days use #f0364f; red text is #ff8a9c; mark #4d2531.

### Named Rules
**The Red Is Action Rule.** Red marks only what to press and how far you got: one filled red control per screen, the progress bars and done days, and the active marker. It never fills a card, a bar or a header. Row icons are neutral (ink on desk), and secondary text actions ("Practicar" on a topic row) are ink.

**The Area Rule.** An area's colour appears only as the dot before its name, its bar, and a 4px edge on its header card (Aprende, lesson cover). A new area colour must hold 4.5:1 against white, and none may read as the action red.

## Typography

**Body Font:** Figtree (with ui-sans-serif, system-ui, sans-serif), loaded 400 to 800.

**Character:** One friendly geometric sans; weight and size carry the hierarchy, so names, numbers and sentences read as one voice.

### Hierarchy
- **Score** (800, 2.25rem, 1.05, tabular): the duel scoreboard only.
- **Title** (800, 1.75rem, 1.15): the page title, "Hola, <name>", the area name on its band, the lesson and Yo names, the reward score.
- **Headline** (800, 1.375rem, 1.2): the next step's title, the guided prompt (700), the verdict, the league title.
- **Section** (700, 1.125rem, 1.3): section titles ("Tu siguiente paso", "Tus áreas"), reto names (800), topic names on the reward, the primary button on Hoy, solve and reward.
- **Question** (500, 1.25rem, 1.4): a short stem; a long one drops to 400 at 1.0625rem and 1.55. Both follow the student's text-size setting. Options are 700 at 1.0625rem.
- **Body** (400, 1rem): reasons and prose, within 60 to 65ch. List-row titles and button labels are 700 at this size.
- **Support** (600, 0.875rem, 1.4): status facts, notes, the MasteryBadge word, row subtitles.
- **Meta** (700, 0.8125rem): tab labels, task area and minutes, the "Siguiente" tag (800), area level.

The seven steps are tokens (`--text-xs` 0.8125rem to `--text-2xl` 2.25rem); the question size is the one size outside them. Counts and scores use tabular figures. Text wraps with `balance` on titles and `pretty` on prose.

### Named Rules
**The One Family Rule.** Figtree sets everything on a student screen, at 400 to 800. Hierarchy comes from the seven steps and weight, never from a second face, tracking or uppercase.

## Layout

Phone first. Below 781px tab screens sit in a 16px gutter with 20px above, under an ink top bar and over four bottom tabs (Hoy, Aprende, Retos, Yo); from 781 to 1023px the ink top bar carries the four sections. Solve and review run edge to edge.

**Desktop (1024px and up, 2026-11-11).** The header turns into a fixed ink side rail, 14rem wide (`StudentAppShell` markup unchanged, CSS only in `student.css`): "Aprendo / Saber 11" on top, the four sections as vertical items (44px, the active one on #2e2b33 with a red icon), and at the foot, over a hairline, the role switcher, theme, Cuenta and Salir. The page sits to the right with 24-48px of padding. Solve and review (`is-immersive`) and the pre-placement welcome (`has-no-tabs`) keep the top bar.
- **Hoy:** capped at 73.75rem (~1180px). Main column: greeting (2.25rem), status facts, goal meter, the next step, "También para hoy"; right column (18-22rem): first-week commitment, week strip, league, "Tus áreas", join. The greeting lives in the main column, so the side column starts at the top.
- **Aprende:** the area pills become a sticky vertical list (13rem) beside the area card and its topics, capped at 68rem.
- **Retos:** the challenges are a grid of cards (min 17rem); "Para continuar" and the league take a 20rem column beside them only when they exist.
- **Yo:** the cover, Logros and Ajustes form a 19rem column (one card) beside a card with the score, areas, career, exam, study time and sessions (`.yo.is-split`, `.yo-side`, `.yo-main`; both wrappers are `display: contents` on a phone, so the phone order is unchanged).

Below 1024px, Aprende is 44rem, Retos 44rem, Yo 46rem, and Hoy's two columns start at 781px. Lessons cap at 44rem, the reward card and Cuenta at 40rem. The primary button is full width on the phone and starts at the left, at least 14rem, on wider screens.

Rhythm: 24px between sections on Hoy, 16px on Aprende and Retos, 20px inside cards. List rows are at least 64px, reto tiles 80px. Solve is a field-coloured bar, a white sheet of 44rem, and a bottom dock capped at 62dvh. Safe-area insets are respected at every screen edge. Interactive targets are at least 44px, and inputs are 16px so iOS does not zoom.

## Elevation & Depth

Flat. Depth comes from a white card on the desk and a 1px hairline, not from shadows.

### Shadow Vocabulary
- **Float** (`--shadow-md: 0 4px 14px rgba(16,35,28,0.12)`, `--shadow-lg: 0 12px 32px rgba(16,35,28,0.18)`): menus, dialogs and sheets only.
- **Ring** (`box-shadow: inset 0 0 0 2px`): a state, not depth. The selected, wrong or correct answer option in ink, red or green; a marked question's count in rose.

### Named Rules
**The Flat Press Rule.** Nothing rests on a shadow and nothing leans. A press is `scale(0.97)` at 100ms `cubic-bezier(0.23, 1, 0.32, 1)`, never a 3D edge or an offset shadow.

## Shapes

Soft and plain: 16px cards, lists, bands and sheets; 12px buttons, answer options and chips; 8px small cells and option letters; 10px row icons; full pills for area chips, the "Siguiente" tag, level-change tags and medals. Bars are 6px tall (8px on a band) with 3px ends. Lists are one rounded card with rows split by hairlines, not a stack of cards.

## Components

### Buttons
Flat and direct.
- **Shape:** 12px, at least 3rem (3.25rem on Hoy and the reward, 52px in solve), Figtree 700.
- **Primary:** Action Red with white text, no border, no shadow. One per screen, always on white or ink, never on a coloured surface.
- **Secondary:** card surface with a 1px strong hairline; hover and press to Card Hover.
- **Danger:** Correction Red with white text.
- **Hover / Focus:** hover only on fine pointers; on touch the same look comes from `:active`. Every press scales to 0.97.

### Lists and rows
- **List:** one white card, 1px hairline, 16px corners; rows divided by hairlines.
- **Row:** a 40px neutral icon tile (ink on desk), a 700 title, a secondary line, meta (area dot and minutes), a chevron. Press to Inset.

### Next-step card
A white card, 16px, 1px hairline, with a 4px red inset left edge (`box-shadow: inset 4px 0 0`): the task title (Headline), its reason in secondary text, area and minutes, then the red primary. The first reto on Retos wears the same edge with a red icon tile. After 5 p.m. Colombia, with a streak and nothing done today, a red Support line above the title: "Tu racha de N días sigue viva: {meta} preguntas la cuidan". Three or more days away, the card becomes "Qué bueno verte. Empecemos suave" with one button for five questions (repaso if due, else the plan's first topic, else the recommended five).

### Daily loop on Hoy (2026-11-11)
- **Goal meter** under the status facts: a rose icon, "Meta de hoy", "n de m preguntas" and an 8px brand bar that fills (280ms, `--ease-out-strong`). Met: the icon turns green with a check that pops once (scale 0.25 to 1 with blur), the bar turns green, the words read "Meta cumplida".
- **Week strip** (side column, every student): seven 32px dots Monday to Sunday with their initial. Done is brand red with a white check; today is rose with a 2px brand ring; a past day without practice is the quiet inset fill, a day to come is an outline. Never red for a missed day.
- **Shield note**: a white row, rose shield, "Un escudo cuidó tu racha ayer." and "Entendido"; dismissed per device.
- The class league sits in the side column too, and hides itself when the student has none.

### Area band and area rows
- **Area card (Aprende, lesson cover):** a white card with a 4px inset top edge in the area colour, the area dot before the ink Title, a neutral level pill, an 8px bar in the area colour on the track, the count, the note, and the usual red primary.
- **Area row (Hoy):** dot, name, level word, a 6px bar in the area colour, "n de m temas en Competente o más".
- **Area chips:** pills with the area dot; the chosen one fills with ink and keeps its dot. On desktop they stack as a list beside the topics.

### Topic row and MasteryBadge
Each topic shows its name, its MasteryBadge (a four-bar signal meter and the level word at 600), and its evidence (accuracy) when there is any. The current topic carries the "Siguiente" tag and a light rose tint. The row's action is a quiet red text button; the level is what the row is about.

### Answer Options
Desk background, no border, 12px corners, at least 56px, Figtree 700, the letter in a 32px white tile. Selected: paper with a 2px ink ring, the tile inverts. Wrong and correct: soft red or green with a 2px ring; wrong shakes 260ms, the correct letter pops 240ms. Eliminated: 2px line-through at 60%.

### Guided question
A Panel (#2a1218) under the question after a wrong answer: a Headline prompt, full-width white chips (12px) that turn rose on press, underlined links, and a red "go". Never shows the correct option.

### Navigation
Four tabs with icons, 0.8125rem labels at 700; the active tab takes the red text colour and a 22% icon fill. The 781-1023px top bar underlines the active section in red; the desktop rail is described under Layout. In solve, a bar in the area colour holds the back button, progress beads (rose done, white current; one track past 15 questions), the clock and the "3/10" count.

### Reward
A white card: the score as a Title, the topics that moved (each with its MasteryBadge, a green "Subiste" or grey "Bajó" pill and a note), then what was earned as plain facts, then the red primary.

**The One Moment Rule.** A topic that went up on a fresh close settles in once: its row flashes from 55% rose to soft green (520ms, after 250ms). Under reduced motion it does not play, and no press scales; colour changes stay.

**Streak moments (2026-11-11).** The only other celebration, and only on a fresh close. The day's first session shows yesterday's count, then the new number rises in (280ms, after 400ms). Reaching 3, 7, 14 or 30 days adds an ink card under the score (the one full ink card in the content): a red flame, the number at 3.5rem/800, "días seguidos" and one line; it scales in from 0.96 (400ms, after 280ms). A shield earned in the session is one more plain fact, "Ganaste un escudo para tu racha". Under reduced motion only opacity moves.

## Do's and Don'ts

### Do:
- **Do** set every student screen through these tokens, and add new student routes to `lib/student-look.ts`.
- **Do** give each screen one red primary action, and write the next step as a name with its reason, area and minutes.
- **Do** show every topic in a topic list with its MasteryBadge.
- **Do** use the area colour only as dot, bar and header edge, through `--area`.
- **Do** use 100ms strong ease-out for presses and 140ms for colour, and remove transforms and the level-up flash under reduced motion.

### Don't:
- **Don't** show a numbered slot, sticker or tile without a name; progress is written in words.
- **Don't** make decoration look interactive: status facts on Hoy are plain icon and text, never pills or buttons.
- **Don't** add a second red control to a screen, or tilts, 3D press edges or resting shadows.
- **Don't** bring the notebook's ruling or red margin to student screens, or this look to school, staff, public or printed screens.
- **Don't** add a label line above a heading; the heading speaks.
- **Don't** hardcode the red, the ink or the area colours where a token exists.

## Sign-in and the teacher's panel (2026-11-13)

The owner liked the student look and asked for sign-in and the teacher's screens to match. `lib/student-look.ts` lists them; `student.css` holds the rest, screen only.
- **Sign-in** (`AuthFrame`): an ink cover with the wordmark, "Un paso cada día." and the week strip (three red done days pop in once, 70ms apart; today ringed), the form on a white card. Phone: the cover is a band and the card overlaps its edge. From 900px: the cover is the left 42%, the card centred beside it. Links are ink; the one red is the submit.
- **Teacher shell** (`StaffShell`): the student's ink rail from 1024px (Cursos and Colegio with icons, the open course's name and its three tabs under Cursos with a red dot on the open one, the account at the foot). Below 1024px the ink top bar; on a phone the brand and the account on one row, the sections on the next.
- **Teacher pages**: the notebook markup reads as white cards on the desk inside `.staff-main` (sections are cards, lists run edge to edge, tables sit in their card). The course facts and code are a card beside the page from 1024px, under the title below it. The course tabs below 1024px are pills on a track, the open one in ink. Levels 1-4: correction red, then three steps to ink. Focus on inputs is ink.

## Onboarding (2026-11-11)

Placement is one general diagnostic (20 questions, 4 per area, 40 min), not one nivelación per area. The welcome (2026-11-11, `Welcome.tsx`) is a white card on the desk with one decision per screen: hello with the five area chips, consent (age and a required box), exam date, daily goal (5/10/15/20 questions as option cards, with the days of the week), character, reminders, then the diagnostic's rules. A red bar on top fills with a spring; steps slide by direction (280ms, `--ease-out-strong`), their blocks stagger 50ms, the weekly total counts up, the avatar pops on change. Chosen options take a 2px ink ring (days fill with ink) and press to 0.97. Motion durations are tokens in `student.css` (`--duration-*`), read by `lib/motion-tokens.ts`; under reduced motion only opacity moves. Students placed before consent was asked see only consent and the goal. The diagnostic intro is the same card (`.diagnostic-intro > .timed-intro`) with the areas listed under its facts. The result lists every area on one bar, weakest first, marked preliminary; the bars grow in that order, then "Tu plan está listo" with the one CTA to Hoy.

## Pilot survey (2026-11-11)

`/encuesta` (`PilotSurvey.tsx`) is the welcome card again: the same red bar, step slide and footer, one question per screen. Scales 1–5 and 0–10 are a row of option cells (0–10 wraps six and five on the phone, one row from 640px) with the two ends named under them; choices reuse the welcome options. The six scales are required, the rest show "Saltar" as the secondary button. The end screen pops a rose check once. Hoy offers it as a plan row after three completed sessions; Cuenta has its section.

## Live duel (2026-11-13)

Three steps, no hunting. **Teacher:** a red "Duelo en vivo" button (`DuelLaunchButton`) at the top of the course page and on every course card; one click opens the projector. **Projector** (`/teacher/duelo/$id`, `.duel-stage`): its own light tokens whatever the look or theme, because dark washes out in a lit room; Figtree, sizes in `vw`/`vh` so 720p and 1080p both fit one screen. The lobby is "Duelo en vivo", three numbered steps (Abre Aprendo, Hoy, Entrar), the app's QR (`public/qr-aprendo.svg`, a fixed address) with the class code, one white card per team with its count and a dot per student, and the red "Empezar" once two are in. A student who joins pops in as a red dot that settles to ink, and the count rises in with a blur (the one delight here; reduced motion keeps only the colour and opacity). The game is the scores on an ink band and the question on a white sheet. **Student:** the red banner (`ActiveDuelBanner`, the one red surface allowed, because it is the action) on Hoy and at the top of Retos, with a breathing ring on its icon; tapping it joins.
