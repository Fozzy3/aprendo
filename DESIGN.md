---
name: Aprendo
description: ICFES Saber 11 preparation. Plan de estudio on student screens, Cuaderno cuadriculado everywhere else.
colors:
  plan-cover: "#b3132f"
  plan-brand: "#c41e3a"
  plan-brand-deep: "#a3172f"
  plan-action: "#d91e3c"
  plan-action-hover: "#bd1631"
  plan-mark: "#ffd3db"
  plan-panel: "#2a1218"
  plan-green-ink: "#08704a"
  plan-success-text: "#075f3f"
  plan-ink: "#24141a"
  plan-text-secondary: "#54404a"
  plan-text-tertiary: "#6b555c"
  plan-graphite: "#5e4a4f"
  plan-paper: "#ffffff"
  plan-card-hover: "#fcf6f7"
  plan-desk: "#f8f1f2"
  plan-inset: "#f3e8ea"
  plan-rule: "#ecdcdf"
  plan-hairline: "rgba(36, 20, 26, 0.12)"
  plan-hairline-strong: "rgba(36, 20, 26, 0.24)"
  plan-red: "#c8321f"
  plan-red-text: "#a31d10"
  plan-red-soft: "#ffe6e2"
  plan-area-lectura: "#6d3fc0"
  plan-area-matematicas: "#097d52"
  plan-area-ciencias: "#0a6fb0"
  plan-area-sociales: "#b4540a"
  plan-area-ingles: "#b3257a"
  plan-dark-paper: "#1c1215"
  plan-dark-card: "#24171b"
  plan-dark-desk: "#130b0e"
  plan-dark-ink: "#f6eced"
  plan-dark-cover: "#8a1328"
  plan-dark-brand: "#ff8597"
  plan-dark-action: "#ff6b81"
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
    backgroundColor: "{colors.plan-cover}"
    textColor: "{colors.plan-paper}"
    rounded: "{rounded.plan-lg}"
    padding: "20px"
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

> Two systems coexist, chosen per route by `lib/student-look.ts`, which sets `data-look` on `<html>`. Student screens (Hoy, Aprende, Retos, Yo, lessons, practice, placement, duel, `/join`, `/cuenta`) use **Plan de estudio**, the second half of this file; it replaced Álbum on 2026-11-10. Teacher, school, staff, public and print use **Cuaderno cuadriculado**, the first half. Passages in the notebook half that mention students (solve and review, button sizes) predate the student look; on a student's screen, Plan de estudio governs.

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

**Palette change (2026-11-11):** the owner moved the brand to red. Green pitch and sticker yellow are gone: red cover and action, rose marks, warm neutrals. Matemáticas stays green and correct stays green; Lectura moved from red to violet so no area reads as the brand.

**Creative North Star: "Plan de estudio"**

Every screen answers three things in words: what to do now, why, and how each topic is going. Hoy is a plan, not a game board: a red card with the next step and its reason, one white button, then the rest of the day and the five areas with their level and bar. Aprende lists every topic of an area with its level and accuracy. Progress is named, never a numbered slot.

Density is low and the phone comes first: white cards on a pale warm desk, one family of type, flat controls that answer a press with a small scale. The register is calm and credible, for students of 15 to 17 in short sessions and mixed light. It replaced the Álbum (sticker album) on 2026-11-10 because the metaphor read as unclear and decorative.

**Review status.** This section records what the code ships. Signed-in screens were reviewed from component renders with fictional data, not live data; solve, review and Yo were not captured. Empty, long-label and real-volume states are unconfirmed on screen, and values may move after a live review.

**Key Characteristics:**
- White cards on a pale green desk, 1px hairlines, 16px corners.
- Brand red for the next-step card and the cover bars; one colour per area for its header band, dot and bar.
- Action red (white text) for the one primary action; on a red surface the action turns white with red text. Rose marks for what is never pressed.
- Figtree alone, 400 to 800, on seven type steps.
- Flat controls; a press is scale 0.97. One authored moment: the level-up flash on the reward.

## Colors

A quiet warm-white page with one saturated voice: red, for "this is your plan" and "do this".

### Primary
- **Cover Red** (#b3132f): the next-step card, the Yo cover, the top bars, the duel bar. White text at 6.9:1.
- **Brand Red** (#c41e3a, hover #a3172f): links, accents, focus, the welcome progress and step numerals. Text-sized red on white is #a8172f.
- **Action Red** (#d91e3c, hover #bd1631, white text at 5:1): the one primary action (`--sticker`). On a red surface (`.next-card`) the action re-maps to white with Cover Red text.
- **Rose Mark** (#ffd3db, ink text; token `--mark`): what is marked but never pressed: the current topic tint and "Siguiente" tag, done progress beads, today in the first week, the hint panel, the student's own league row, portrait ground, medals, avatar parts, the level-up flash.

### Secondary
Area colours, set on an element as `--area` (in solve, `--field`). White text on each reads at 4.5:1 or better. They do not change in dark mode.
- **Lectura Violet** (#6d3fc0), **Matemáticas Green** (#097d52), **Ciencias Blue** (#0a6fb0), **Sociales Amber** (#b4540a), **Inglés Magenta** (#b3257a).

### Neutral
- **Warm Black** (#24141a): text and ink. **Panel** (#2a1218): the guided-question panel.
- **Secondary and Tertiary Text** (#54404a, #6b555c).
- **Paper** (#ffffff), **Card Hover** (#fcf6f7), **Desk** (#f8f1f2), **Inset** (#f3e8ea), **Rule** (#ecdcdf); hairlines rgba(36, 20, 26, 0.12) and 0.24.
- **Correct** stays green ink (#08704a). **Correction** stays vermilion (#c8321f, text #a31d10 on #ffe6e2), warmer than the brand crimson; a wrong answer always carries its × and ring, never colour alone.
- **Dark:** paper #1c1215, card #24171b, desk #130b0e, ink #f6eced, cover #8a1328, brand #ff8597, action #ff6b81 with dark text, mark #6b2433.

### Named Rules
**The One Red Action Rule.** One filled red control per screen: the primary action. On a red surface it turns white. Every rose is a mark that is never pressed.

**The Area Rule.** An area's colour appears in three places only: the header band, the dot before its name, and its bar. Words on a band are white. A new area colour must hold 4.5:1 against white, and none may read as the brand red.

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

Phone first, one breakpoint at 780/781px. On the phone, tab screens sit in a 16px gutter with 20px above, over four tabs (Hoy, Aprende, Retos, Yo); solve and review run edge to edge.

Hoy is one column on the phone and, from 781px, a main column beside a 22rem side column (first week, "Tus áreas", join), capped at 68rem. Aprende, Retos and lessons cap at 44rem, Yo at 46rem, the reward card and Cuenta at 40rem. The primary button is full width on the phone and starts at the left, at least 14rem, on desktop.

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
- **Primary:** Action Red with white text, no border, no shadow. One per screen; white with red text on a red surface.
- **Secondary:** card surface with a 1px strong hairline; hover and press to Card Hover.
- **Danger:** Correction Red with white text.
- **Hover / Focus:** hover only on fine pointers; on touch the same look comes from `:active`. Every press scales to 0.97.

### Lists and rows
- **List:** one white card, 1px hairline, 16px corners; rows divided by hairlines.
- **Row:** a 40px soft-green icon tile, a 700 title, a secondary line, meta (area dot and minutes), a chevron. Press to Inset.

### Next-step card
Cover Red, 16px, 20px padding: the task title (Headline), its reason, area and minutes in white, then the white primary.

### Area band and area rows
- **Band (Aprende, lesson cover):** the area colour, white Title, a level pill at 20% white, a white bar on a 22% black track, and the count.
- **Area row (Hoy):** dot, name, level word, a 6px bar in the area colour, "n de m temas en Competente o más".
- **Area chips:** pills with the area dot; the chosen one fills with its area colour and white text.

### Topic row and MasteryBadge
Each topic shows its name, its MasteryBadge (a four-bar signal meter and the level word at 600), and its evidence (accuracy) when there is any. The current topic carries the "Siguiente" tag and a light rose tint. The row's action is a quiet red text button; the level is what the row is about.

### Answer Options
Desk background, no border, 12px corners, at least 56px, Figtree 700, the letter in a 32px white tile. Selected: paper with a 2px ink ring, the tile inverts. Wrong and correct: soft red or green with a 2px ring; wrong shakes 260ms, the correct letter pops 240ms. Eliminated: 2px line-through at 60%.

### Guided question
A Panel (#2a1218) under the question after a wrong answer: a Headline prompt, full-width white chips (12px) that turn rose on press, underlined links, and a red "go". Never shows the correct option.

### Navigation
Four tabs with icons, 0.8125rem labels at 700; the active tab takes the brand red and a 22% icon fill. In solve, a bar in the area colour holds the back button, progress beads (rose done, white current; one track past 15 questions), the clock and the "3/10" count.

### Reward
A white card: the score as a Title, the topics that moved (each with its MasteryBadge, a green "Subiste" or grey "Bajó" pill and a note), then what was earned as plain facts, then the red primary.

**The One Moment Rule.** A topic that went up on a fresh close settles in once: its row flashes from 55% rose to soft green (520ms, after 250ms). It is the only celebration. Under reduced motion it does not play, and no press scales; colour changes stay.

## Do's and Don'ts

### Do:
- **Do** set every student screen through these tokens, and add new student routes to `lib/student-look.ts`.
- **Do** give each screen one red primary action, and write the next step as a name with its reason, area and minutes.
- **Do** show every topic in a topic list with its MasteryBadge.
- **Do** use the area colour only as band, dot and bar, through `--area`.
- **Do** use 100ms strong ease-out for presses and 140ms for colour, and remove transforms and the level-up flash under reduced motion.

### Don't:
- **Don't** show a numbered slot, sticker or tile without a name; progress is written in words.
- **Don't** make decoration look interactive: status facts on Hoy are plain icon and text, never pills or buttons.
- **Don't** add a second red control to a screen, or tilts, 3D press edges or resting shadows.
- **Don't** bring the notebook's ruling or red margin to student screens, or this look to teacher, school, staff, public or printed screens.
- **Don't** add a label line above a heading; the heading speaks.
- **Don't** hardcode the red, the ink or the area colours where a token exists.

## Onboarding (2026-11-11)

Placement is one general diagnostic (20 questions, 4 per area, 40 min), not one nivelación per area. The welcome is a white card on the desk: a red segmented progress bar on top, the five areas as named chips, the flow as three numbered steps joined by a hairline, then the first-week commitment. The diagnostic intro is the same card (`.diagnostic-intro > .timed-intro`) with the areas listed under its facts. The result lists every area on one bar, weakest first, marked preliminary.
