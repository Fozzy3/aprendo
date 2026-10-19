import { describe, expect, it } from 'vitest'
import {
  latestDiagnosticQuery,
  practiceTutorThreadQuery,
  sessionQuery,
  studentProgressQuery,
} from '../lib/student-queries'

describe('student queries', () => {
  it('skips student-scoped queries when the student id is missing', () => {
    expect(latestDiagnosticQuery('')).toMatchObject({
      enabled: false,
      queryKey: ['convexQuery', 'sessions:getLatestDiagnostic', 'skip'],
    })

    expect(studentProgressQuery(undefined)).toMatchObject({
      enabled: false,
      queryKey: ['convexQuery', 'progress:getStudentProgress', 'skip'],
    })

    expect(sessionQuery(null)).toMatchObject({
      enabled: false,
      queryKey: ['convexQuery', 'sessions:getSession', 'skip'],
    })

    expect(practiceTutorThreadQuery('', undefined, 'q1')).toMatchObject({
      enabled: false,
      queryKey: ['convexQuery', 'tutor:getPracticeTutorThread', 'skip'],
    })

    // A chat belongs to one question: without it there is no thread to read.
    expect(practiceTutorThreadQuery('s1', 'u1', null)).toMatchObject({
      enabled: false,
      queryKey: ['convexQuery', 'tutor:getPracticeTutorThread', 'skip'],
    })
  })
})
