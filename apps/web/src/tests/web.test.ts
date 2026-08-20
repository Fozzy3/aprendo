import { describe, expect, it } from 'vitest'
import {
  latestDiagnosticQuery,
  practiceTutorThreadQuery,
  sessionQuery,
  studentProgressQuery,
} from '../lib/student-queries'

describe('web scaffold', () => {
  it('keeps the initial workspace test suite green', () => {
    expect(true).toBe(true)
  })

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

    expect(practiceTutorThreadQuery('', undefined)).toMatchObject({
      enabled: false,
      queryKey: ['convexQuery', 'tutor:getPracticeTutorThread', 'skip'],
    })
  })
})
