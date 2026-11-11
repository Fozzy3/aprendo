---
version: 1
slug: "apps-web-src-components-todaypage-tsx"
primary_target: "apps/web/src/components/TodayPage.tsx"
related_targets: []
---

# Student app surface

Scope: every authenticated student screen (Hoy, Aprende, Retos, Yo, lesson, solve, review, reward, placement, duel). Visitor mode: Operate, phone first. Teacher, school, staff and print stay on the notebook system.

Audience: Colombian students aged 15-17, short sessions on a phone, mixed light. Job: know what to do now and why, do it, see how each topic and area is going. Constraint: one yellow primary action per screen, headline at most 8 words.

Chosen direction: "Plan de estudio", replacing Álbum on 2026-11-10 after the owner found the sticker album unclear, decorative and typographically incongruent. Memorable moment: a topic that went up settling in on the reward screen, named, with what the next level needs.

Unresolved: Repaso cannot name the due topics (getReviewQueue returns only a count). Signed-in screens were reviewed from component renders with fictional data, not live data.

## Direction contract

THESIS: every screen answers what to do now, why, and how each topic is going, in words. It refuses the sticker metaphor, numbered slots with no names, and decoration that looks interactive.

OWN-WORLD: pale green desk, white cards with 1px hairlines and 16px corners, pitch green for the next-step card and the cover bars, sticker yellow only for the one primary action and the "Siguiente" tag, one colour per area for its header band, dot and bar. Figtree alone, 400-800, on a seven-step scale. Flat controls, press = scale 0.97.

STORY: the student opens Hoy, reads the next step and its reason, taps Empezar, practises, sees the score and which topics moved, and goes to what follows. Aprende shows every topic of an area with its level and accuracy.

FIRST VIEWPORT: Hoy on a phone: "Hola, <name>" at 28px/800, a line of plain facts (racha, XP hoy, escudos, examen), "Tu siguiente paso" with a green card holding the task title, its reason, area and minutes, and a full-width yellow Empezar; below, "También para hoy" rows and "Tus áreas" rows with level and bar; four tabs at the bottom.

FORM: category standard played straight (Khan Academy mastery clarity, Brilliant calm), owner pinned clarity over metaphor; position 1. seed: none (unavailable)

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
