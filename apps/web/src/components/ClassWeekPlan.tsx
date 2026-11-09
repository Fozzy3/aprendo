import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import type { FunctionReturnType } from 'convex/server'
import { useState, type CSSProperties } from 'react'
import { api } from '@aprendo/convex/api'
import { getSubtopicLabel } from '@aprendo/convex/taxonomy'
import { readConvexError } from '../lib/convex-error.ts'
import { getSubjectTheme } from '../lib/subject-theme.ts'
import { conversationOpener, lastActivityLabel, riskLabel, studentDisplayName } from '../lib/teacher-display.ts'

type WeekPlan = FunctionReturnType<typeof api.teacher.getClassTeachingPlan>

const percent = (part: number, whole: number) => `${Math.round((part / whole) * 100)}%`

function SubtopicName({ subtopicId, subjectId }: { subtopicId: string; subjectId: string }) {
  return (
    <span className="flex items-center gap-2 font-semibold">
      <span
        aria-hidden
        className="subject-dot"
        style={{ '--subject-color': getSubjectTheme(subjectId).color } as CSSProperties}
      />
      {getSubtopicLabel(subtopicId)}
    </span>
  )
}

/**
 * The teacher's week (plans/ruta-mejora-pedagogica.md, "Metodología"): what to
 * teach the whole class, whom to pull into a small group, whom to talk to, and
 * the questions the class misses most. Every block says why in one line.
 */
export function ClassWeekPlan({ plan, now, classGroupId, canWrite }: { plan: WeekPlan; now: number; classGroupId: string; canWrite: boolean }) {
  return (
    <>
      <section className="ruled-section" aria-labelledby="week-class-title">
        <h2 id="week-class-title" className="section-title">Esta semana con todo el curso</h2>
        {plan.wholeClass.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">
            Ningún tema deja atrás al 40% del curso, o aún no hay evidencia suficiente (5 estudiantes con 3
            respuestas en el tema). Trabaja con los grupos de abajo.
          </p>
        ) : (
          <ol className="ruled-list">
            {plan.wholeClass.map((item) => (
              <li key={item.subtopicId} className="ruled-row">
                <span className="ruled-row-main">
                  <SubtopicName subtopicId={item.subtopicId} subjectId={item.subjectId} />
                  <span className="ruled-row-note">
                    {item.belowCount} de {item.evidencedCount} ({percent(item.belowCount, item.evidencedCount)}) están por
                    debajo de Familiar
                    {item.misconceptionShare >= 0.2
                      ? ` · ${percent(item.misconceptionShare, 1)} de sus errores fueron "seguros": hay un error de concepto`
                      : ''}
                    . Clase corta de 15–20 min y una votación en parejas con una de las preguntas de Resultados.
                  </span>
                  <span className="mt-2 flex flex-wrap gap-2">
                    {canWrite ? (
                      <>
                        <AssignButton classGroupId={classGroupId} subtopicId={item.subtopicId} kind="practica" label="Asignar práctica al curso" />
                        <AssignButton classGroupId={classGroupId} subtopicId={item.subtopicId} kind="tiquete" label="Tiquete de salida (3 preguntas)" />
                      </>
                    ) : null}
                    <Link
                      to="/teacher/guia/$subtopicId"
                      params={{ subtopicId: item.subtopicId }}
                      search={{ curso: classGroupId }}
                      className="btn-ghost btn-sm no-underline"
                    >
                      Guía de clase
                    </Link>
                  </span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="ruled-section" aria-labelledby="week-groups-title">
        <h2 id="week-groups-title" className="section-title">En grupos pequeños</h2>
        {plan.groups.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">Ningún tema necesita un grupo esta semana.</p>
        ) : (
          <ul className="ruled-list">
            {plan.groups.map((group, index) => (
              <li key={`${group.subtopicId}-${index}`} className="ruled-row">
                <span className="ruled-row-main">
                  <SubtopicName subtopicId={group.subtopicId} subjectId={group.subjectId} />
                  <span className="ruled-row-note [overflow-wrap:anywhere]">
                    {group.students.map((student) => studentDisplayName({ name: student.name ?? null, email: student.email ?? '' })).join(', ')}
                  </span>
                  <span className="margin-note">
                    10–15 min mientras el resto practica: tú resuelves un ejemplo en voz alta, luego uno juntos, luego
                    cada uno solo.
                  </span>
                  <span className="mt-2 flex flex-wrap gap-2">
                    {canWrite ? (
                      <AssignButton
                        classGroupId={classGroupId}
                        subtopicId={group.subtopicId}
                        kind="practica"
                        studentIds={group.students.map((student) => student.studentId)}
                        label="Asignar práctica al grupo"
                      />
                    ) : null}
                    <Link
                      to="/teacher/guia/$subtopicId"
                      params={{ subtopicId: group.subtopicId }}
                      search={{ curso: classGroupId }}
                      className="btn-ghost btn-sm no-underline"
                    >
                      Guía de clase
                    </Link>
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="ruled-section" aria-labelledby="week-individual-title">
        <h2 id="week-individual-title" className="section-title">Uno a uno</h2>
        {plan.individual.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">
            Nadie por ahora: todos están nivelados, practican y ninguno está en el nivel 1 de un área.
          </p>
        ) : (
          <ul className="ruled-list">
            {plan.individual.map((student) => (
              <li key={student.studentId}>
                <Link
                  to="/teacher/student/$studentId"
                  params={{ studentId: student.studentId }}
                  search={{ curso: classGroupId }}
                  className="ruled-row no-underline"
                >
                  <span className="ruled-row-main">
                    <span className="font-semibold [overflow-wrap:anywhere]">{studentDisplayName(student)}</span>
                    <span className="margin-note">{student.riskReasons.map(riskLabel).join(' · ')}</span>
                    <span className="ruled-row-note">Para abrir la charla: {conversationOpener(student.riskReasons)}</span>
                  </span>
                  <span className="ruled-row-note shrink-0">{lastActivityLabel(student.lastActiveAt, now)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

    </>
  )
}

/** One click: the assignment goes to the class, or to the group's students (F40). */
function AssignButton({
  classGroupId,
  subtopicId,
  kind,
  studentIds,
  label,
}: {
  classGroupId: string
  subtopicId: string
  kind: 'practica' | 'tiquete'
  studentIds?: string[]
  label: string
}) {
  const create = useConvexMutation(api.teacher.createAssignment)
  const mutation = useMutation({
    mutationFn: () =>
      create({
        classGroupId: classGroupId as never,
        subtopicId,
        kind,
        ...(studentIds != null ? { studentIds: studentIds as never } : {}),
      }),
  })
  return (
    <button
      type="button"
      className="btn-secondary btn-sm"
      disabled={mutation.isPending || mutation.isSuccess}
      onClick={() => mutation.mutate()}
    >
      {mutation.isSuccess ? 'Asignada' : mutation.isError ? 'No se pudo: reintentar' : label}
    </button>
  )
}

const ASSIGNMENT_KIND_LABEL = { practica: 'Práctica', tiquete: 'Tiquete de salida' } as const

/** What the class was assigned and how it went: done, in progress, accuracy (F40). */
export function ClassAssignments({ classGroupId, canWrite }: { classGroupId: string; canWrite: boolean }) {
  const assignments = useQuery(convexQuery(api.teacher.getClassAssignments, { classGroupId: classGroupId as never }))
  if (assignments.isError) {
    return <p role="alert" className="notice is-danger">{readConvexError(assignments.error, 'No pudimos cargar las tareas del curso.')}</p>
  }
  if (assignments.data == null || assignments.data.length === 0) return null
  return (
    <section className="ruled-section" aria-labelledby="class-assignments-title">
      <h2 id="class-assignments-title" className="section-title">Tareas asignadas</h2>
      <ul className="ruled-list">
        {assignments.data.map((assignment) => (
          <li key={assignment.assignmentId} className="ruled-row">
            <span className="ruled-row-main">
              <span className="font-semibold">{getSubtopicLabel(assignment.subtopicId)}</span>
              <span className="ruled-row-note">
                {ASSIGNMENT_KIND_LABEL[assignment.kind]}
                {assignment.isGroup ? ' · grupo' : ' · todo el curso'} · {assignment.doneCount} de {assignment.targetCount} la
                hicieron
                {assignment.inProgressCount > 0 ? ` · ${assignment.inProgressCount} en curso` : ''}
                {assignment.accuracy != null ? ` · ${Math.round(assignment.accuracy * 100)}% de acierto` : ''}
              </span>
            </span>
            {canWrite ? <RemoveAssignment assignmentId={assignment.assignmentId} subtopicId={assignment.subtopicId} /> : null}
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Two taps, not one: in a long list a mis-tap would delete someone's homework. */
function RemoveAssignment({ assignmentId, subtopicId }: { assignmentId: string; subtopicId: string }) {
  const [isConfirming, setIsConfirming] = useState(false)
  const remove = useMutation({ mutationFn: useConvexMutation(api.teacher.deleteAssignment) })
  if (!isConfirming) {
    return (
      <button
        type="button"
        className="btn-ghost btn-sm"
        aria-label={`Quitar la tarea de ${getSubtopicLabel(subtopicId)}`}
        onClick={() => setIsConfirming(true)}
      >
        Quitar
      </button>
    )
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1">
      <button
        type="button"
        className="btn-secondary btn-sm"
        disabled={remove.isPending}
        onClick={() => remove.mutate({ assignmentId: assignmentId as never })}
      >
        {remove.isError ? 'No se pudo: reintentar' : 'Sí, quitar'}
      </button>
      <button type="button" className="btn-ghost btn-sm" onClick={() => setIsConfirming(false)}>
        Cancelar
      </button>
    </span>
  )
}
