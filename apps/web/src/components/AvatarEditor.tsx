import { useConvexMutation } from '@convex-dev/react-query'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAnimate, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { api } from '@aprendo/convex/api'
import { AVATAR_PARTS } from '@aprendo/convex/rewards'
import { readConvexError } from '../lib/convex-error.ts'
import { motionTokens } from '../lib/motion-tokens.ts'
import { AvatarPortrait } from './AvatarPortrait.tsx'
import { NicknamePicker } from './NicknamePicker.tsx'

type Avatar = { skin: string; hair: string; top: string; accessory: string }
type Part = keyof typeof AVATAR_PARTS

const PART_NAMES: Record<Part, string> = { skin: 'Piel', hair: 'Pelo', top: 'Ropa', accessory: 'Extra' }

const PART_LABEL: Record<string, string> = {
  tono1: 'Tono 1', tono2: 'Tono 2', tono3: 'Tono 3', tono4: 'Tono 4', tono5: 'Tono 5', tono6: 'Tono 6',
  corto: 'Corto', liso: 'Liso', rizado: 'Rizado', afro: 'Afro', trenzas: 'Trenzas', recogido: 'Recogido', rapado: 'Rapado',
  camiseta: 'Camiseta', buso: 'Buso', uniforme: 'Uniforme', chaqueta: 'Chaqueta',
  ninguno: 'Nada', gafas: 'Gafas', audifonos: 'Audífonos', gorra: 'Gorra',
}

const FIRST_AVATAR: Avatar = { skin: 'tono3', hair: 'corto', top: 'camiseta', accessory: 'ninguno' }

/** Each tap saves: there is no form to submit and nothing to lose. */
export function AvatarEditor({ studentId, avatar, nickname }: { studentId: string; avatar: Avatar | null; nickname: string | null }) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<Avatar>(avatar ?? FIRST_AVATAR)
  const setAvatar = useConvexMutation(api.students.setAvatar)
  const save = useMutation({
    mutationFn: (next: Avatar) => setAvatar({ studentId: studentId as never, avatar: next }),
    onSuccess: () => queryClient.invalidateQueries(),
  })
  // The portrait pops when a part changes: the tap landed on the face, not only the chip.
  const [preview, animatePreview] = useAnimate<HTMLDivElement>()
  const reduceMotion = useReducedMotion()
  const choose = (part: Part, value: string) => {
    const next = { ...draft, [part]: value }
    setDraft(next)
    save.mutate(next)
    if (!reduceMotion && preview.current != null) {
      void animatePreview(preview.current, { transform: ['scale(0.92)', 'scale(1)'] }, {
        type: 'spring', bounce: 0.3, duration: motionTokens().spring,
      })
    }
  }

  return (
    <div className="avatar-editor">
      <div ref={preview} className="avatar-sticker avatar-editor-preview">
        <AvatarPortrait avatar={draft} title="Tu lámina" />
      </div>
      {(Object.keys(AVATAR_PARTS) as Part[]).map((part) => (
        <fieldset key={part} className="avatar-part">
          <legend>{PART_NAMES[part]}</legend>
          <div className="avatar-part-options">
            {AVATAR_PARTS[part].map((value) => (
              <button
                key={value}
                type="button"
                className="avatar-part-option"
                aria-pressed={draft[part] === value}
                onClick={() => choose(part, value)}
              >
                {PART_LABEL[value]}
              </button>
            ))}
          </div>
        </fieldset>
      ))}
      {save.error != null ? (
        <p role="alert" className="notice is-danger">{readConvexError(save.error, 'No se pudo guardar tu lámina.')}</p>
      ) : null}
      <NicknamePicker studentId={studentId} nickname={nickname} />
    </div>
  )
}
