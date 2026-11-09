import { useConvexMutation } from '@convex-dev/react-query'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '@aprendo/convex/api'
import { ADJECTIVES, NOUNS } from '@aprendo/convex/rewards'
import { readConvexError } from '../lib/convex-error.ts'

/** The name classmates see in a league: two words off closed lists, no free text (G4). */
export function NicknamePicker({ studentId, nickname }: { studentId: string; nickname: string | null }) {
  const queryClient = useQueryClient()
  const [savedNoun, savedAdjective] = nickname?.split(' ') ?? []
  const [noun, setNoun] = useState<string>(savedNoun ?? NOUNS[0])
  const [adjective, setAdjective] = useState<string>(savedAdjective ?? ADJECTIVES[0])
  const setNickname = useConvexMutation(api.students.setNickname)
  const save = useMutation({
    mutationFn: () => setNickname({ studentId: studentId as never, noun, adjective }),
    onSuccess: () => queryClient.invalidateQueries(),
  })
  const isSaved = nickname === `${noun} ${adjective}`

  return (
    <form
      className="nickname-picker"
      onSubmit={(event) => {
        event.preventDefault()
        save.mutate()
      }}
    >
      <label>
        <span>Nombre</span>
        <select value={noun} onChange={(event) => setNoun(event.target.value)}>
          {NOUNS.map((item) => <option key={item}>{item}</option>)}
        </select>
      </label>
      <label>
        <span>Cómo eres</span>
        <select value={adjective} onChange={(event) => setAdjective(event.target.value)}>
          {ADJECTIVES.map((item) => <option key={item}>{item}</option>)}
        </select>
      </label>
      <button type="submit" className="btn-secondary" disabled={save.isPending || isSaved}>
        {isSaved ? 'Guardado' : save.isPending ? 'Guardando…' : 'Guardar apodo'}
      </button>
      {save.error != null ? (
        <p role="alert" className="notice is-danger">{readConvexError(save.error, 'No se pudo guardar tu apodo.')}</p>
      ) : null}
    </form>
  )
}
