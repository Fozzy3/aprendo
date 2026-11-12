# Aprendo: pilot-ready cut (audit, retention, onboarding, pilot survey)

## Context

Aprendo is about to go to production and into a pilot with **individual students** (owner decision). An audit of the code found:

- The in-app reward loop exists (XP, streak with automatic shields, 4 medals, class league, duels, spaced review, daily plan), but **nothing reaches a student who does not open the app**: no crons, no reminders, no analytics. Shields are invisible, the daily goal is a fixed 5 answers with no meter, there is no comeback flow.
- **Launch blockers**: sign-up is open to any email if `RESEND_API_KEY` is unset; no age or consent step; the privacy policy names no data controller; terms do not declare the pilot non-commercial while ICFES items are served.
- Onboarding is three skippable steps with a crossfade; "welcome seen" lives in localStorage; `motion` is installed and unused.
- No survey or feedback feature exists.

Owner decisions (2026-11-11): pilot = individual students; keep ICFES items, pilot declared free and non-commercial; reminders by email only; scope = pilot-ready cut.

Outcome: a student signs up safely, goes through an animated onboarding that sets a goal, sees a visible daily loop, gets an email when the streak is at risk, and answers a pilot survey; the owner sees funnel and retention numbers.

## How this is executed

- Fable 5.2 orchestrates: one Opus 5.5 agent per phase, in order; Fable reviews each diff and runs verification before the next phase starts.
- Work on a new branch `feat/piloto-retencion`. **No commits, pushes or deploys unless the owner asks.** Never build.
- Strict TDD: failing test first for every backend function and pure helper. Tests: `packages/convex/test` (`bun test`, convex-test), `apps/web/src/tests` (Vitest).
- Read `memory/verification-commands.md` first (Convex has no `typecheck` script; `api.d.ts` needs manual registration for new modules).
- UI phases (2, 3, 5) load the full front-end design skill package from the owner's CLAUDE.md, follow `DESIGN.md` "Plan de estudio" (`apps/web/src/student.css`), and check screens with `playwright-cli` at 390px and desktop.
- Copy is Spanish, no shaming ("perdiste tu racha" is banned, `plans/reconstruccion-estudiante-y-banco.md:254`). Run `humanizer` on new copy.
- Every new per-student table or field is added to `accountExport.ts` and `deleteStudentData` (`students.ts:236`) with tests (`deleteStudentData.test.ts`).
- Copy this plan to `plans/piloto-retencion.md` and add it to `AGENTS.md` at the start.

## Phase 0 — Launch blockers

1. **Fail closed on email** (`packages/convex/src/auth.ts:24,101`): `requireEmailVerification` is true when `RESEND_API_KEY` is set **or** `SITE_URL` is set (production). In `email.ts:28`, when `SITE_URL` is set, log only recipient and subject, never the body (it carries the reset token).
2. **Consent and age**: new fields `students.consentAt`, `students.isMinor`. Mutation `students.recordConsent`. Collected as an onboarding step (Phase 2), not skippable. `use-student-guard.ts` sends a student without `consentAt` to onboarding. Minor copy: "Mi acudiente sabe que uso Aprendo y lo autoriza".
3. **Privacy and terms** (`routes/privacidad.tsx`, `routes/terminos.tsx`): data controller block (legal name, NIT, address, contact email) from one constant in `lib/site.ts`; terms gain a clause: the pilot is free, non-commercial, ICFES items are shown with attribution for study only; reminder emails and the survey are added to the privacy text.
4. **Stale copy**: `use-student-guard.ts:65` and the comment at `students.ts:156-166` still describe per-area nivelación; align to the general diagnostic.
5. `public/robots.txt` and `sitemap.xml`: replace the hardcoded `aprendo-nine.vercel.app` with the production domain.

## Phase 1 — Measurement

1. Table `events` `{ studentId, name, at, props? }`, index `by_studentId` and `by_name_at`. Mutation `events.track` (guarded by `assertIsStudent`, `name` a closed union: `onboarding_step`, `onboarding_done`, `screen_view`, `email_click`, `survey_shown`). Only what sessions and attempts cannot already tell.
2. One hook `useTrack` in `apps/web/src/lib/`; `screen_view` fired from `StudentAppShell` on route change.
3. **Pilot panel** as a new tab in `/admin`: render the existing, unused `measurement.getEngagementMetrics` (`measurement.ts:48`) plus a new `measurement.getPilotFunnel`: signed up → consented → onboarding done → diagnostic done → first practice → active day 2 → active day 7; D1/D7 return; reminder emails sent vs clicked.

## Phase 2 — Onboarding

Rebuild `components/Welcome.tsx` (still mounted from `routes/diagnostic.tsx:84-93`). Completion is stored in `students.onboardedAt` (replaces the `aprendo:welcome-seen` localStorage key, so it does not repeat per device).

Steps, one decision per screen:

1. **Hola, {nombre}** — the five areas arrive one by one in their colours (`getAllSubjectThemes`).
2. **Antes de empezar** — age (menor / mayor de 18) and consent (Phase 0.2). Required.
3. **Tu examen** — exam date (reuse `ExamCountdown`, `students.setExamDate`). Skippable.
4. **Tu meta diaria** — 5 / 10 / 15 / 20 questions a day, each with its minutes ("unos 10 min"). New `students.dailyGoalQuestions`, mutation `students.setDailyGoal`; `studyPlan.ts:103-111` reads it in place of the fixed 5. Keep the days-per-week commitment (`FirstWeekCommit`) on this step.
5. **Tu personaje** — reuse `AvatarEditor` and `NicknamePicker` (today only on Yo). Skippable.
6. **Recordatorios** — "Te escribimos solo si tu racha está por cortarse". On by default; `students.remindersOff`.
7. **Tu diagnóstico** — the rules already in `TimedSessionIntro`, CTA "Empezar mi diagnóstico".

Motion (use the installed `motion` package; `MotionConfig reducedMotion="user"`):

- Steps slide by direction with `AnimatePresence` (forward and back), 240–320ms, `--ease-out-strong`; children stagger 40–60ms.
- Progress bar fills with a spring; selected option presses to 0.97 and settles.
- Avatar parts pop on change; goal choice shows the weekly total counting up.
- Add duration tokens to `student.css` next to `--ease-out-strong` (`student.css:95`); no hardcoded durations in new code.
- **Diagnostic result** (`components/DiagnosticResult.tsx`): area bars grow weakest first, then "Tu plan está listo" with one CTA to `/today`.
- Fix the stale `vi.mock('motion/react')` usage in `tests/reward-and-lesson.test.tsx:12` as needed; extend `tests/welcome.test.tsx`.

## Phase 3 — Visible daily loop

Backend changes are in pure functions with tests (`rewards.ts`, `studyPlan.ts`, `today.ts`).

1. **Daily goal meter** on Hoy (`TodayPage.tsx:98-104`): answered today / goal, replacing the pill that only appears when met. `getTodayDashboard` already computes `answeredToday`; return it with the goal.
2. **Week strip**: seven dots Monday–Sunday on Hoy for every student, not only the first week. Return this week's active days from `today.ts` (today it returns only the count).
3. **Shields made visible**: `streakFrom` (`rewards.ts:99`) also returns the last day a shield was spent. Hoy shows once "Un escudo cuidó tu racha ayer"; `RewardScreen` announces a shield earned.
4. **Streak at risk**: after 5 p.m. Colombia, streak > 0 and not practised today, the next-step card reads "Tu racha de N días sigue viva: {meta} preguntas la cuidan".
5. **Streak moments** on `RewardScreen.tsx`: the count ticks up on the first session of the day; milestones at 3, 7, 14, 30 get a full-card moment. Add medals `racha_3` and `racha_14` to `MEDAL_LABELS` and `STREAK_MEDALS`.
6. **Comeback**: 3 or more days away, Hoy opens with "¡Qué bueno verte! Empecemos suave" and a 5-question session launched through the existing `sessions.createSession` (review if anything is due, else the plan's first task). No new session kind.
7. **League for the pilot without new code**: one organization "Piloto" (plan `pilot`) with one class; students join by link `/join?codigo=…`. Add the missing UI toggle in `SchoolsAdmin.tsx` for `measurement.setSchoolLeague` (`measurement.ts:99`). Show `LeagueStrip` on Hoy as well as `/practice`. The pilot operator also gets the existing teacher panel with its 14-day inactive flag.

## Phase 4 — Reminder emails

1. `students.lastActiveDay` (Colombia day number), index `by_lastActiveDay`, patched where an attempt is graded, only when the day changes. `students.lastReminderDay` for dedup.
2. `packages/convex/src/crons.ts` (first cron in the repo): daily at 23:00 UTC (6 p.m. Colombia) runs an internal action:
   - `lastActiveDay == today − 1` → "Tu racha de N días sigue viva" (streak replayed with `streakFrom` for these candidates only).
   - `lastActiveDay == today − 3` and `today − 7` → comeback email. Then silence.
   - Skips `remindersOff`, no `consentAt`, or already reminded today.
3. Reuse `sendEmail` (`email.ts`), plain text, link `SITE_URL/today?ref=recordatorio` → `email_click` event. Pure function `reminderFor(student, today)` holds the rules and is what gets tested.
4. Toggle "Recordatorios por correo" in `/cuenta`. Each email ends with the path to that toggle. `ponytail:` no one-click unsubscribe token; add before any non-pilot mailing.

## Phase 5 — Pilot survey in Cuenta

- Table `pilotSurveyResponses` `{ studentId, answers, submittedAt }`, one per student. `pilotSurvey.submit`, `pilotSurvey.getMine`, admin `pilotSurvey.summary`.
- `/cuenta` gets a section "Encuesta del piloto" (`routes/cuenta.tsx`). Hoy shows a card "Cuéntanos cómo te va (4 min)" after 3 completed sessions, until answered. One question per screen, same step motion as onboarding.
- Results (counts, means, free text, CSV download) in the pilot panel from Phase 1.

Questions:

1. ¿Qué tan fácil fue empezar a usar Aprendo? (1–5)
2. ¿El diagnóstico inicial reflejó bien tu nivel? (1–5)
3. Al abrir "Hoy", ¿tenías claro qué hacer? (1–5)
4. Cuando fallaste una pregunta, ¿qué tan útiles fueron la explicación y el tutor? (1–5, "no lo usé")
5. ¿Las preguntas se parecen a las del Saber 11? (1–5)
6. ¿Sientes que Aprendo te ayuda a mejorar para el examen? (1–5)
7. ¿Qué te hizo volver a practicar? (varias: la racha, la meta del día, el XP, la liga, el correo de recordatorio, ver mi progreso, se acerca el examen, nada en especial)
8. ¿Qué te impidió practicar más? (varias: falta de tiempo, se me olvidó, internet o datos, el celular va lento, me aburrí, muy difícil, muy fácil, otra)
9. ¿Dónde lo usaste más? (celular propio, celular prestado, computador en casa, computador del colegio)
10. ¿Qué más usas para prepararte? (varias: preicfes presencial, YouTube, cartillas, otra app, nada)
11. ¿Cómo te sentirías si ya no pudieras usar Aprendo? (muy decepcionado, algo decepcionado, me da igual)
12. ¿Qué tan probable es que se lo recomiendes a un compañero? (0–10)
13. ¿Tú o tu familia pagarían por Aprendo? (no; hasta $10.000 al mes; $10.000–20.000; $20.000–40.000; más)
14. ¿Qué fue lo más confuso o molesto? (texto)
15. ¿Qué le cambiarías o agregarías? (texto)

## Deferred (listed, not built in this cut)

CI and pre-commit; error reporting (Sentry); rate limiting on auth and join; unbounded `.collect()` on Today and session creation (`today.ts:37-44`, `sessions.ts:205-226`); CSP headers; web push and service worker; league tiers; drawing the sticker album; tutor quota refund on failed calls; teacher seeing students outside their class (`auth.ts:211-218`); B2C payments.

## Owner must do

- Set `RESEND_API_KEY`, `EMAIL_FROM`, `SITE_URL` in production Convex and verify the sending domain in Resend.
- Give the data controller details (legal name, NIT, address, contact email) and the production domain.
- Get signed guardian authorization for minors in the pilot; legal review of ICFES use stays pending.
- Create the "Piloto" organization and class in `/admin` and share the join link.

## Verification

- Per phase: `bun test` in `packages/convex`, `bun run test` in `apps/web`, `bun run typecheck` at root, `bun run lint` in `packages/convex`. No build.
- End to end on dev with `playwright-cli`: sign up → onboarding (all 7 steps, back and forward, reduced motion on) → diagnostic → result → Hoy shows meter and week strip → finish a session → reward shows streak tick → `/cuenta` survey submit → export JSON contains events and survey → delete account leaves no rows.
- Reminders: unit tests on `reminderFor`; run the cron's internal action once on dev with `RESEND_API_KEY` unset and confirm the log line per candidate.
- Pilot panel: funnel and survey counts match the test accounts created above.
