---
version: 1
slug: "apps-web-src-components-todaypage-tsx"
primary_target: "apps/web/src/components/TodayPage.tsx"
related_targets: []
---

# Student app surface

Scope: every authenticated student screen (Hoy, Aprende, Retos, Yo, lesson, solve, review, placement, duel). Visitor mode: Operate, phone first. Teacher, school, staff and print stay on the sober notebook system.

Audience: Colombian students aged 15-16 (later from grade 6), short sessions on a phone, in mixed light. Job: know what to do next, do it in five minutes, feel progress. Constraint: one primary action per screen, headline at most 8 words, at most 25 words before the action.

Chosen direction: Álbum, picked by the owner on 2026-11-08 from the decision page. Memorable moment: a sticker landing in its numbered slot at the end of a session.

Unresolved: real illustration for each of the 33 subtopic stickers is drawn as simple SVG glyphs for now.

## Direction contract

THESIS: every topic you master is the sticker you were missing. Progress is a page of numbered slots filling up; it refuses the percentage dashboard and the winding lesson path.

OWN-WORLD: full fields of pitch green with one per-area field colour, white work sheets, sticker yellow for the one primary action, near-black green ink, Anton for big names and numbers, Figtree for everything read. Numbered slots, stickers with a slight tilt only when they are the next one, a pressed bottom edge on the primary button.

STORY: the student opens the app, sees the page of the area they are working on, sees which sticker is missing, plays five questions to earn it, and when wrong is asked a question instead of being told. They understand they are progressing and do the next session.

FIRST VIEWPORT: Hoy on a phone. Area name in Anton at the top of a full green field, count of stickers and streak beneath, a four-column grid of numbered slots filling the field with filled stickers, the next missing one lifted and tilted, a full-width yellow button naming the missing topic with "5 preguntas · 5 min", a white strip with the teacher's task, then four tabs: Hoy, Aprende, Retos, Yo.

FORM: Álbum, position 1 on the ordered list (owner took the pick over the rolled lobby world). seed:7738da8185028309

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
