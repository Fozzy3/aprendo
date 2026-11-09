---
name: Aprendo
description: ICFES Saber 11 preparation. Álbum on student screens, Cuaderno cuadriculado everywhere else.
colors:
  album-pitch: "#097d52"
  album-pitch-deep: "#076a45"
  album-green-ink: "#08704a"
  album-sticker: "#ffd23f"
  album-sticker-hover: "#ffdb66"
  album-sticker-edge: "#c79a12"
  album-tone-sky: "#8fe3ff"
  album-tone-coral: "#ff8a5c"
  album-next-mark: "#d7361f"
  album-ink: "#10231c"
  album-text-secondary: "#3c5148"
  album-text-tertiary: "#52665d"
  album-graphite: "#4b5f57"
  album-paper: "#ffffff"
  album-desk: "#eef5f1"
  album-inset: "#eaf2ee"
  album-rule: "#d6e5dd"
  album-red: "#c8321f"
  album-red-text: "#a31d10"
  album-red-soft: "#ffe6e2"
  album-area-lectura: "#c2342a"
  album-area-matematicas: "#097d52"
  album-area-ciencias: "#0a6fb0"
  album-area-sociales: "#b4540a"
  album-area-ingles: "#b3257a"
  album-dark-paper: "#12201a"
  album-dark-card: "#17281f"
  album-dark-desk: "#0b1511"
  album-dark-ink: "#e9f3ee"
  album-dark-cover: "#0a5f40"
  album-dark-brand: "#62d2a2"
  album-dark-red: "#f0796a"
  notebook-paper: "#fbfcfe"
  notebook-rule: "#c9d8ea"
  notebook-ink: "#16233f"
  notebook-margin: "#c3352b"
  notebook-green-ink: "#2e6b45"
  notebook-graphite: "#4a5263"
  notebook-pen: "#1d4f91"
  notebook-desk: "#e6edf6"
typography:
  album-hero:
    fontFamily: "Anton, Arial Narrow, sans-serif"
    fontSize: "clamp(2.75rem, 13vw, 3.25rem)"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.005em"
  album-numeral:
    fontFamily: "Anton, Arial Narrow, sans-serif"
    fontSize: "clamp(4.5rem, 22vw, 6.5rem)"
    fontWeight: 400
    lineHeight: 0.95
  album-headline:
    fontFamily: "Anton, Arial Narrow, sans-serif"
    fontSize: "clamp(1.625rem, 8vw, 2rem)"
    fontWeight: 400
    lineHeight: 1.05
    letterSpacing: "0.005em"
  album-button:
    fontFamily: "Anton, Arial Narrow, sans-serif"
    fontSize: "29px"
    fontWeight: 400
    lineHeight: 1.05
  album-sticker-number:
    fontFamily: "Anton, Arial Narrow, sans-serif"
    fontSize: "22px"
    fontWeight: 400
    lineHeight: 1
  album-question:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.3125rem"
    fontWeight: 600
    lineHeight: 1.32
  album-title:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 800
  album-label:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
  notebook-display:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontWeight: 600
  notebook-body:
    fontFamily: "Public Sans, ui-sans-serif, system-ui, sans-serif"
    fontWeight: 400
rounded:
  album-sm: "8px"
  album-sticker: "10px"
  album-md: "12px"
  album-hero: "14px"
  album-lg: "16px"
  album-xl: "20px"
  album-pill: "999px"
  notebook-sm: "2px"
  notebook-md: "3px"
  notebook-lg: "4px"
spacing:
  album-grid-gap: "9px"
  album-page: "20px"
  album-touch: "44px"
  notebook-cell: "20px"
components:
  album-button-primary:
    backgroundColor: "{colors.album-sticker}"
    textColor: "{colors.album-ink}"
    rounded: "{rounded.album-md}"
    padding: "0.625rem 1.5rem"
    height: "3rem"
  album-button-primary-hover:
    backgroundColor: "{colors.album-sticker-hover}"
    textColor: "{colors.album-ink}"
  album-button-hero:
    backgroundColor: "{colors.album-sticker}"
    textColor: "{colors.album-ink}"
    typography: "{typography.album-button}"
    rounded: "{rounded.album-hero}"
    padding: "14px"
  album-button-secondary:
    backgroundColor: "{colors.album-paper}"
    textColor: "{colors.album-ink}"
    rounded: "{rounded.album-md}"
    padding: "0.625rem 1.5rem"
    height: "3rem"
  album-sticker-next:
    backgroundColor: "{colors.album-paper}"
    textColor: "{colors.album-ink}"
    typography: "{typography.album-sticker-number}"
    rounded: "{rounded.album-sticker}"
    padding: "7px 8px"
  album-solve-option:
    backgroundColor: "{colors.album-desk}"
    textColor: "{colors.album-ink}"
    rounded: "{rounded.album-md}"
    padding: "12px 14px"
    height: "56px"
  album-ask-chip:
    backgroundColor: "{colors.album-paper}"
    textColor: "{colors.album-ink}"
    rounded: "11px"
    padding: "13px 15px"
  notebook-button-primary:
    backgroundColor: "{colors.notebook-pen}"
    textColor: "{colors.notebook-paper}"
    rounded: "{rounded.notebook-md}"
---

# Aprendo — DESIGN.md

> Two systems coexist, chosen per route by `lib/student-look.ts`, which sets `data-look` on `<html>`. Student screens (Hoy, Aprende, Retos, Yo, lessons, practice, placement, duel, `/join`, `/cuenta`) use **Álbum**, the second half of this file. Teacher, school, staff, public and print use **Cuaderno cuadriculado**, the first half. Passages in the notebook half that mention students (solve and review, button sizes) predate Álbum; on a student's screen, Álbum governs.

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

# Álbum: student screens

Implementation: `apps/web/src/student.css`, scoped to `html[data-look='student']` and to `@media screen`, so a printed student report stays on the notebook. Components the Álbum does not restyle inherit structure from `styles.css` with these tokens swapped in. Where this section and the CSS disagree, the CSS is what ships.

## Overview

**Creative North Star: "The Sticker You Were Missing"**

Every topic mastered is a numbered slot filled on an area's page. Progress is a page filling up, not a percentage and not a winding lesson path. The screen is a full field of the area's colour, white sheets for work, near-black green ink, and one yellow button that goes and gets the next sticker.

Density is low and the phone comes first: one thing to do, large names and numbers, thumb-sized targets. The register is young and credible, for students of 15 and 16 in short sessions and mixed light.

**Review status.** This section records what the code ships. The student surface has not yet been reviewed rendered against live data, so empty, long-label and full-album states are unconfirmed on screen, and values here may move after that review. The 33 subtopic sticker pictures are simple provisional SVG glyphs.

**Key Characteristics:**
- Full fields of per-area colour with white type.
- Numbered slots, on a four-column page on the phone and six on desktop.
- Yellow means the thing to go and get.
- Anton for names and numbers, Figtree for everything read.
- A physical press on the primary button, and one authored landing.

## Colors

Saturated fields, white sheets, and one yellow that does the pulling. Dark mode turns the sheets to deep green and keeps the fields and the yellow.

### Primary
- **Pitch Green** (#097d52): the default field, the cover bars, links and accents. Hover deepens to Pitch Green Deep (#076a45). Text-sized green on a sheet uses Green Ink (#08704a).
- **Sticker Yellow** (#ffd23f): the primary action, the next sticker's outline, done progress beads, and what is the student's own (their row in the league, a chosen avatar part). Hover lifts to #ffdb66; its press edge is #c79a12.

### Secondary
Area fields, set on the page as `--field`. White text on each measures 4.98:1 or better.
- **Lectura Red** (#c2342a), **Matemáticas Green** (#097d52), **Ciencias Blue** (#0a6fb0), **Sociales Amber** (#b4540a), **Inglés Magenta** (#b3257a).

### Tertiary
- **Sky** (#8fe3ff) and **Coral** (#ff8a5c): earned sticker tones, cycling with yellow and white by sticker number. Tone carries no meaning.
- **Next Mark** (#d7361f): the picture on the next sticker only.

### Neutral
- **Green Black** (#10231c): text, the text on yellow, and the guided-question panel.
- **Secondary and Tertiary Text** (#3c5148, #52665d): supporting lines and quiet labels.
- **Paper** (#ffffff): work sheets and cards. **Desk** (#eef5f1): the page behind sheets and resting answer options. **Inset** (#eaf2ee): empty wells. **Rule** (#d6e5dd): the few hairlines left.
- **Correction Red** (#c8321f), with text #a31d10 on soft #ffe6e2: a wrong answer and errors.
- **Dark:** paper #12201a, card #17281f, desk #0b1511, ink #e9f3ee, cover #0a5f40, green accent #62d2a2, red #f0796a. Area fields do not change.

### Named Rules
**The Field Rule.** An area owns the whole field in its colour, and every word on a field is white. A new area colour must hold 4.5:1 against white.

**The Earned Colour Rule.** A filled sticker means earned, and nothing else fills a slot. An empty slot shows only its number, on a darker shade of the field.

## Typography

**Display Font:** Anton (with Arial Narrow, sans-serif)
**Body Font:** Figtree (with ui-sans-serif, system-ui, sans-serif)

**Character:** A loud poster condensed for names and numbers, against a friendly geometric sans that does the reading.

### Hierarchy
- **Numeral** (400, clamp(4.5rem, 22vw, 6.5rem), 0.95): XP on the reward screen.
- **Hero** (400, clamp(2.75rem, 13vw, 3.25rem), 1): the area name on a field. Lesson and Aprende names sit close to it.
- **Headline** (400, clamp(1.625rem, 8vw, 2rem), 1.05): the guided question.
- **Button** (400, 29px on Hoy, 1.375rem to 1.625rem elsewhere, 1.05): the primary action's name.
- **Sticker Number** (400, 22px, 1): slots and option letters at nearby sizes, all tabular.
- **Question** (Figtree 600, 1.3125rem, 1.32): a short stem, dropping to 500 at 1.0625rem and 1.5 when long; both follow the student's text-size setting.
- **Title** (Figtree 800, 1rem): small headings and task names. Every `h3` is Figtree.
- **Label** (Figtree 700, 0.75rem): tab labels. Supporting lines are 0.875rem to 0.9375rem at 600 or 700.

Figtree loads from 500 up, so a 400 request renders at 500. Prose stays within 65ch. Counts use tabular figures.

### Named Rules
**The Names and Numbers Rule.** Anton sets names, numbers and the words on the main button, always at 400. Anything read as a sentence is Figtree.

## Layout

Phone first, with one breakpoint at 780/781px. On the phone, Hoy and the reward run edge to edge with no top bar, above four tabs (Hoy, Aprende, Retos, Yo). The album page is four columns with a 9px gap and rows of clamp(5.5rem, 19dvh, 9.5rem), so the page fills the field.

From 781px the album is six columns with 9rem rows, Hoy gains a 22rem side column, and the reward becomes a centred 40rem card. Reading and working columns cap at 44rem. Solve is a field bar, a white sheet, and a bottom dock capped at 62dvh. Safe-area insets are respected at every screen edge.

Interactive targets are at least 44px, and inputs are 16px so iOS does not zoom.

## Elevation & Depth

Flat fields and sheets, with depth used for two things: an object you can press, and the sticker you are after.

### Shadow Vocabulary
- **Press Edge** (`box-shadow: 0 4px 0 #c79a12`, `0 5px 0` on hero buttons): the solid lower edge of a primary button. It collapses as the button travels down 3px to 4px.
- **Next Lift** (`box-shadow: 0 10px 18px rgba(0,0,0,0.28)`): the next sticker only. The student's portrait carries a smaller lift.
- **Float** (`--shadow-md`, `--shadow-lg`, green-tinted): menus, dialogs and sheets.

### Named Rules
**The Press Edge Rule.** The solid edge belongs to the primary action, in a darker shade of that button's own colour. It is a key you push, chosen with the world, never a decorative offset.

**The Next One Rule.** Only the next sticker lifts and tilts (-4deg). The student's own portrait may tilt (-3deg). Nothing else leans.

## Shapes

Soft and object-like, in contrast to the notebook's near-square corners: 8px small, 12px controls, 16px sheets and fields on desktop, 10px stickers, 14px hero buttons, full pills for area filters, avatar options and medals. Slots are taller than wide, like a real sticker. A shiny sticker alone carries a 135deg gold gradient and a 2px inner edge.

## Components

### Buttons
Tactile: pressed, not hovered.
- **Shape:** gently rounded (12px), 3rem tall, Figtree 800.
- **Primary:** Sticker Yellow with Green Black text and the Press Edge. One per screen.
- **Hero:** full-width on the phone, Anton topic name over a Figtree line of questions and minutes.
- **Secondary:** card surface with a 2px strong border.
- **Danger:** Correction Red with white text and an edge in its own darker shade.
- **Hover / Focus:** hover only on fine pointers; on touch the same look comes from `:active`. Other controls press at scale 0.94 to 0.97.

### Sticker
- **Earned:** tone by number, number top left, picture bottom right.
- **Empty:** the number on a darker field shade with a 2px inner outline.
- **Next:** white, 4px yellow outline, picture in Next Mark, Next Lift, tilted and scaled 1.08. It already shows its picture before it is earned.
- **Shiny:** gold gradient with a spark icon.
- **Slot behaviour:** each slot links to its lesson and announces number, topic and state.

### Answer Options
- **Style:** Desk background, no border, 12px corners, at least 56px, Figtree 700. The letter sits in a 32px Anton tile.
- **Selected:** paper with a 2px inner ink ring; the letter tile inverts.
- **Wrong / Correct:** soft red or green with a 2px inner ring; wrong shakes for 260ms, the correct letter pops for 240ms.
- **Eliminated:** 2px line-through at 60% opacity.

### Guided Question
Near-black panel under the question after a wrong answer. Anton prompt, full-width white chips (11px corners) that flash yellow on press, underlined text links. Never shows the correct option.

### Navigation
Four tabs with icons, 0.75rem labels at 700; the active tab takes Green Ink and a 22% icon fill. In solve, a field-coloured bar holds progress beads (yellow done, white current), or one continuous track past 15 questions, and the number slot.

### Reward
Field-coloured close: XP numeral, streak, the area's page with the new sticker landing, then a white sheet of medals, topic changes and the score last.

**The One Landing Rule.** The sticker dropping into its slot (spring, 0.7s, after 0.8s) is the only celebration, and it plays once on a fresh close. Under reduced motion it fades, and the XP count-up shows its number at once.

### League
A card of neighbouring rows: rank, avatar, nickname, XP gap. The student's row is Sticker Yellow. Other students show a gap, never a score.

### Portrait
A layered SVG avatar on a yellow sticker, used as the Yo cover and at small size in the league.

## Do's and Don'ts

### Do:
- **Do** set every student screen through the Álbum tokens, and add new student routes to `lib/student-look.ts`.
- **Do** give each screen one yellow primary action.
- **Do** use 100ms strong ease-out for presses and 140ms for colour, and remove transforms under reduced motion.
- **Do** write the next step as a name ("Te falta Proporciones") with its cost in questions and minutes.

### Don't:
- **Don't** bring the Álbum to teacher, school, staff, public or printed screens.
- **Don't** bring the notebook's ruling or red margin to student screens; the sheet background is removed on purpose.
- **Don't** draw student progress as percentage dashboards or a winding path; it is slots on a page.
- **Don't** copy the kicker lines above a heading or the neutral press edges on secondary controls, tiles and non-solve options. They ship today and are not part of this system.
- **Don't** hardcode the yellow, its edge or the ink where a token exists.
