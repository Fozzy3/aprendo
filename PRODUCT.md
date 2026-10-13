# Aprendo — PRODUCT.md

Strategic context for design work. The full functional spec lives in
`specs/PRODUCT_SPEC.md`; this file answers who, why, and in what voice. The
visual system is in `DESIGN.md`; the plan that produced it is
`plans/rediseno-institucional.md`.

## Register

**Product, sold to schools.** Every authenticated surface is *Operate*: the
person is mid-task and design serves the task. The landing is the one *Persuade*
surface, written for the rector who decides whether the school buys.

## Users

**The student: a Colombian 11th-grader preparing for the ICFES Saber 11.**
Typically 16–17, on a phone, in short sessions between school and everything
else. The exam gates university admission and scholarships, so the emotional
baseline is anxiety, not curiosity. Phone first.

**The teacher or coordinator.** On a school computer, following a class of
30–40 students. Needs to know who needs support and in which competency, and
the code to bring students in. Desktop first. Reads; never acts for a student.

**The school admin.** Opens classes, adds teachers, manages seats and the
school's name and crest (co-branding).

**The rector or buyer.** Arrives at the landing. Needs to see what Aprendo
measures, what a teacher gets, where the questions come from and how minors'
data is handled.

**Aprendo staff (platform admin).** Ingest PDFs, triage question reports and
issue school licenses. A dense, functional surface.

## The job

- Student: *"Tell me exactly what I don't know yet, and how much time I have left."*
- Teacher: *"Tell me which students and which competencies are at risk, with evidence."*
- School: *"Show it as ours, and as something serious."*

## Personality

**Institutional, exact, on the student's side.** A well-kept notebook, not a
game and not a corporate dashboard.

- Speaks Spanish, with accents, addressing the student as *tú* and the school
  as *usted*.
- Reports what the evidence supports and no more. When there isn't enough data,
  it says so instead of inventing a number.
- Sober about effort and results: study days and mastery levels are academic
  signals, never rewards.

## Anti-references

- **The generic blue LMS with cards** (Canvas, Moodle).
- **The corporate KPI dashboard.** No hero metrics, no KPI tiles.
- **Anything childish.** No mascot, stickers, emojis, spiral bindings or
  handwriting fonts. The notebook is an instrument, not a costume.
- **Duolingo's guilt loop.** Nothing shames a student for a missed day.
- **The infinite question bank.** Volume is not the value; direction is.

## Strategic design principles

1. **Never show a number the evidence doesn't support.** The global score carries
   an uncertainty band; a level is withheld until there are enough attempts; a
   teacher sees "—", not a guess.
2. **The grid is a state, not wallpaper.** The ruling shows only where the
   student works (solving, reviewing) and on the sheets that frame sign-in.
3. **Red is the margin's ink.** Mistakes, risk and the teacher's judgment share
   one red; correct is green ink; tentative is pencil grey.
4. **A school sees a student only through its memberships.** Learner data stays
   the student's; a teacher reads it and never writes it.
5. **Every number the student will believe carries its source in a JSON
   contract** (`docs/levels.v1.json`, `docs/national-results.v1.json`,
   `docs/taxonomy.v1.json`), and every ICFES question carries its booklet.
6. **The exam date is the organising fact.**

## Accessibility

- Body text ≥4.5:1, large text ≥3:1. Subject colours are marks, never text.
- Every animation has a `prefers-reduced-motion` alternative.
- Errors carry `role="alert"` and are never conveyed by colour alone.
- The solve screen is fully keyboard-operable (A–D to answer, arrows, F to mark).
