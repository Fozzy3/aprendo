# Aprendo — DESIGN.md

Visual system of record. `apps/web/src/styles.css` is the implementation; this
file is the reasoning. When the two disagree, the CSS is what ships — fix one or
the other, don't let them drift.

## Register

**Product.** Design serves the task. The student is preparing for a national
exam under time pressure; the interface should disappear into practising, not
perform at them. Delight is reserved for thresholds (empty states, a finished
session, a level up), never spread across working screens.

## Theme

Light by default, dark supported. The physical scene: a 16-year-old in Colombia,
on a phone, in a school corridor or a lit bedroom, in short sessions between
other obligations. That forces light-first — most sessions happen in daylight on
a screen held at arm's length — with dark as a real alternative for night study,
not an afterthought.

The resolved theme is always written as a class on the root element by the
blocking script in `__root.tsx`, including in `auto` mode. **There is exactly one
dark block** (`:root.dark, :root[data-theme="dark"]`). A second copy inside
`@media (prefers-color-scheme: dark)` existed once and the two diverged.

## Color

Strategy: **Restrained.** Tinted neutrals, one brand colour, semantic colours
with fixed meanings, and area identity demoted to a mark.

### Semantic anchors — colour means state

| Token | Light | Meaning |
|---|---|---|
| `--brand` | `#6c4cf1` (H 285) | Identity, primary action, current selection |
| `--gold` | `#ffc93c` (H 86) | Goal markers, streaks |
| `--success` | `#21c08b` (H 164) | Correct, mastered |
| `--danger` | `#ff5d5d` (H 24) | Incorrect, destructive, errors |

`--accent` is an alias of `--brand`, kept so the ~200 legacy classes never had to
be touched. **Semantic tokens must never hang off the brand token.** Both
failures of this rule are on record: `.option-card.is-incorrect` read as "red"
only because the brand happened to be coral, and the login error was painted in
brand violet, where an error simply does not read as an error.

### Area identity — shape means identity

Five ICFES areas, one family by construction: **identical lightness and chroma,
hue is the only variable.**

```
--subject-lectura_critica:      oklch(0.60 0.15 350)
--subject-matematicas:          oklch(0.60 0.15 250)
--subject-ciencias_naturales:   oklch(0.60 0.15 195)
--subject-sociales_ciudadanas:  oklch(0.60 0.15  55)
--subject-ingles:               oklch(0.60 0.15 315)
```

Hues sit in the gaps between the semantic anchors, at least 30° from each. The
previous ramp did not: Ciencias Naturales was `#21c08b`, **byte-identical to
`--success`**, and Lectura Crítica sat one degree from `--danger`. A green chip
could mean "you got it right" or "this is a science question". Lightness also
ranged 0.62–0.785 and chroma 0.146–0.212, so the five did not read as a family
either.

Two rules follow, and they are the whole system:

1. **An area is marked by a dot (`.subject-dot`), never by a coloured border or
   fill.** Five saturated outlines on one screen is confetti, and the product
   register bans heavy colour on inactive states outright.
2. **Never use a subject token for text.** At L 0.60 on white it lands near
   3.5:1 — fine for a 7px mark, short of the 4.5:1 body text requires. Labels
   stay `--text-primary` and let the dot carry the identity.

## Typography

- Display: **Bricolage Grotesque** (700) — headings only.
- Body/UI: **Hanken Grotesk** — everything else.
- Not Fraunces, Manrope, Inter, Roboto, or Plus Jakarta Sans. The first two were
  the superseded v1 identity; the last was dropped as overexposed.

## Shape and motion

The "pressable" language: 2px `--border-hard` outline plus `--shadow-hard`, with
`translateY(2px)` on `:active`. It is what makes the product feel like a game
rather than a form. `.card` stays soft so dense screens (Progreso, Historial)
don't become a wall of black outlines.

Transitions 120–250ms, ease-out. Motion conveys state, never decorates. Every
animation has a `prefers-reduced-motion` alternative.

## Mascot

**Nico**, a spectacled bear (`components/Mascot.tsx`). Native to the Colombian
Andes; its facial markings read as glasses without anyone drawing glasses on an
animal. The owl was rejected on purpose — it belongs to Duolingo and is the
reflex answer for every education product.

Moods: `idle`, `happy`, `thinking`, `cheering`, `sleeping`. Flat shapes on a
64×64 grid, no gradients, legible at 32px. Its fur uses tokens that belong to no
other role, so Nico can never be confused with a state or an area. He blinks on
an irregular cadence — a metronome blink is worse than none.

**Appears at thresholds only.** If Nico is on screen while the student is
answering or reviewing a question, that is a bug. The review screen in
particular is work, not a moment, and deliberately has no mascot.

Where he does belong, and nowhere else:

| Surface | Mood |
|---|---|
| Landing hero / close | `idle` / `cheering` |
| Nivelación intro | `idle`, or `happy` once an area is placed |
| Route loading (`FullScreenLoader`) | `thinking` |
| Empty state, nothing yet | `sleeping` |
| Empty state, something went wrong | `idle` |

## Loading and empty states

There are exactly **two** loading components, and the split is not stylistic:

- **`FullScreenLoader`** — the guard resolving before the shell exists. Once per
  visit, nothing else on screen, so Nico is welcome.
- **`PageLoader`** — content arriving inside a shell that is already painted.
  Fires on every navigation, so it gets three pulsing dots and no character. A
  cartoon on every tab change is choreography the student did not ask for.

Empty states all go through **`MascotMessage`**, so no screen invents its own
arrangement.

This replaced 20 loading states written 12 different ways (`Cargando…`,
`Preparando…`, `Cargando admin...`, `Preparando tu ruta...`, two of them with
three dots instead of an ellipsis), each with hand-rolled markup — and a
`MascotMessage` component that nothing used.

## Colour hygiene

No hex or rgb literals outside the token blocks, and **no fallbacks inside
`var()`**. `var(--accent, #2563eb)` appeared five times: the fallback never fires
while the token exists, and the day someone renames the token, five rules turn
blue in an app whose brand is violet. `.chip-success` likewise had a literal
green border beside a tokenised background, so the border would not have followed
a palette change the other two properties did.

## Containers

- Student shell: `min(1320px, 100% - 2rem)`
- Diagnostic shell: `min(1180px, 100% - 2rem)`
- Single-decision screens (the nivelación picker): `min(54rem, 100% - 2rem)`

`.diagnostic-solve-main` is deliberately full-bleed for `SessionSolve`, so
anything else rendered inside it must bring its own container. Forgetting this is
what once put the heading flush against x=0 with 940px-wide cards.
