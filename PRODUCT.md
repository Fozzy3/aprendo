# Aprendo — PRODUCT.md

Strategic context for design work. The full functional spec lives in
`specs/PRODUCT_SPEC.md`; this file answers who, why, and in what voice.

## Register

**Product.** Design serves the task, not the other way round. Every surface is
authenticated and the student is mid-task. The landing page is the one exception
and is not where the product's value is decided.

## Users

**Primary: a Colombian 11th-grader preparing for the ICFES Saber 11.** Typically
16–17, on a phone, in short sessions between school and everything else. The
exam is high-stakes — it gates university admission and scholarships — so the
emotional baseline is anxiety, not curiosity. Sessions are often interrupted.

**Secondary: admins** who upload and process source PDFs, and monitor content
quality. A dense, functional surface; no delight budget needed.

## The job

*"Tell me exactly what I don't know yet, and how much time I have left."*

Not "give me questions" — a PDF does that for free. The product earns its place
by turning attempts into a diagnosis: which subtopic, at which ICFES level, with
how much evidence, and what to do about it today.

## Personality

**Straight with you, on your side, never cutesy about the stakes.**

- Speaks Spanish, with accents, addressing the student as *tú*.
- Reports what the evidence supports and no more. When there isn't enough data,
  it says so instead of inventing a number.
- Encouraging about effort, honest about results. It never congratulates a
  student for a score they didn't earn.

## Anti-references

- **Duolingo's guilt loop.** Streaks exist here, but nothing shames a student for
  breaking one. No pleading mascot, no manipulative notifications.
- **The corporate SaaS dashboard.** This is not an analytics tool for a manager.
  No hero-metric templates, no KPI tiles.
- **The infinite question bank.** Volume is not the value; direction is.
- **The owl.** Both literally (see the mascot note in DESIGN.md) and as a
  posture: the wise authority lecturing from above.

## Strategic design principles

1. **Never show a number the evidence doesn't support.** The global score carries
   an uncertainty band; a level is withheld until there are enough attempts; the
   national comparison refuses to derive a percentile from an incomplete
   distribution. A confident wrong number is worse than a blank.
2. **Colour means state; shape and position mean identity.** See DESIGN.md.
3. **Delight at thresholds, silence during work.** Nico appears at empty states
   and completions, never beside a question being answered.
4. **Every number the student will believe carries its source in a JSON
   contract**, not in code — `docs/levels.v1.json`,
   `docs/national-results.v1.json`, `docs/taxonomy.v1.json` — so it can be
   corrected without a deploy.
5. **The exam date is the organising fact.** Without it the product is a
   suggestion engine; with it, everything can be framed as "at your pace, from
   here, by then".

## Accessibility

- Body text ≥4.5:1, large text ≥3:1. Subject colours are marks, never text.
- Every animation has a `prefers-reduced-motion` alternative.
- Errors carry `role="alert"` and are never conveyed by colour alone.
- Solve screen is fully keyboard-operable (A–D to answer, arrows to navigate).
