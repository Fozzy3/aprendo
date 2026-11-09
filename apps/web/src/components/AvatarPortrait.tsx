type Avatar = { skin: string; hair: string; top: string; accessory: string }

const DEFAULT_AVATAR: Avatar = { skin: 'tono3', hair: 'corto', top: 'camiseta', accessory: 'ninguno' }

const SKIN: Record<string, string> = {
  tono1: '#f8dcc4',
  tono2: '#eec39c',
  tono3: '#d8a478',
  tono4: '#b67c50',
  tono5: '#8a5934',
  tono6: '#5c3a22',
}

const HAIR = '#2a1a12'
const INK = '#10231c'

// Behind the head: what shows around the face and down the shoulders.
const HAIR_BACK: Record<string, React.ReactNode> = {
  liso: <path d="M20 40c0-16 9-24 20-24s20 8 20 24v22H52V40H28v22h-8z" fill={HAIR} />,
  afro: <circle cx="40" cy="36" r="29" fill={HAIR} />,
  recogido: <circle cx="40" cy="14" r="9" fill={HAIR} />,
  trenzas: <path d="M16 42h9v8l-2 5 2 6-2 6 2 6h-9l2-6-2-6 2-6-2-5zM55 42h9v8l-2 5 2 6-2 6 2 6h-9l2-6-2-6 2-6-2-5z" fill={HAIR} />,
}

// Over the forehead.
const CAP = 'M22 40c0-14 8-22 18-22s18 8 18 22c-3-6-8-10-18-10s-15 4-18 10z'
const HAIR_FRONT: Record<string, React.ReactNode> = {
  corto: <path d={CAP} fill={HAIR} />,
  liso: <path d="M22 40c0-13 8-20 18-20s18 7 18 20c-5-9-11-12-18-12s-13 3-18 12z" fill={HAIR} />,
  rizado: (
    <g fill={HAIR}>
      {[[24, 32, 6], [30, 25, 7], [40, 21, 8], [50, 25, 7], [56, 32, 6]].map(([cx, cy, r]) => (
        <circle key={cx} cx={cx} cy={cy} r={r} />
      ))}
    </g>
  ),
  afro: <path d="M24 36c2-8 9-13 16-13s14 5 16 13c-4-4-9-5-16-5s-12 1-16 5z" fill={HAIR} />,
  trenzas: <path d={CAP} fill={HAIR} />,
  recogido: <path d={CAP} fill={HAIR} />,
  rapado: <path d={CAP} fill={HAIR} opacity={0.35} />,
}

const SHOULDERS = 'M10 96c0-20 13-30 30-30s30 10 30 30z'
const TOP: Record<string, React.ReactNode> = {
  camiseta: <path d={SHOULDERS} fill="#0a6fb0" />,
  buso: (
    <>
      <path d={SHOULDERS} fill="#c2342a" />
      <path d="M26 72c2-9 8-13 14-13s12 4 14 13c-4 3-9 5-14 5s-10-2-14-5z" fill="#9e2820" />
    </>
  ),
  uniforme: (
    <>
      <path d={SHOULDERS} fill="#f4f7f5" />
      <path d="M31 66l9 10 9-10 4 2-8 14-5-6-5 6-8-14z" fill="#d6e5dd" />
    </>
  ),
  chaqueta: (
    <>
      <path d={SHOULDERS} fill="#097d52" />
      <path d="M34 66h12l-6 30z" fill="#f4f7f5" />
    </>
  ),
}

const ACCESSORY: Record<string, React.ReactNode> = {
  gafas: (
    <g fill="none" stroke={INK} strokeWidth="2.2">
      <circle cx="32.5" cy="41" r="6" />
      <circle cx="47.5" cy="41" r="6" />
      <path d="M38.5 41h3" />
    </g>
  ),
  audifonos: (
    <>
      <path d="M21 42c0-14 8-23 19-23s19 9 19 23" fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
      <rect x="16" y="38" width="8" height="14" rx="3.5" fill={INK} />
      <rect x="56" y="38" width="8" height="14" rx="3.5" fill={INK} />
    </>
  ),
  gorra: (
    <>
      <path d="M21 34c0-11 8-18 19-18s19 7 19 18z" fill="#c2342a" />
      <path d="M21 34h44c1 0 1 3 0 3H21z" fill="#9e2820" />
    </>
  ),
}

/** The student's own sticker: closed SVG parts, nothing uploaded (F55). */
export function AvatarPortrait({ avatar, title }: { avatar: Avatar | null | undefined; title?: string }) {
  const { skin, hair, top, accessory } = avatar ?? DEFAULT_AVATAR
  const face = SKIN[skin] ?? SKIN.tono3
  return (
    <svg viewBox="0 0 80 96" className="avatar-portrait" role={title == null ? undefined : 'img'} aria-label={title} aria-hidden={title == null}>
      {HAIR_BACK[hair]}
      <rect x="33" y="52" width="14" height="18" fill={face} />
      {TOP[top]}
      <circle cx="40" cy="40" r="18" fill={face} />
      <circle cx="33" cy="41" r="2.2" fill={INK} />
      <circle cx="47" cy="41" r="2.2" fill={INK} />
      <path d="M34 49c2 3 10 3 12 0" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
      {HAIR_FRONT[hair]}
      {ACCESSORY[accessory]}
    </svg>
  )
}
