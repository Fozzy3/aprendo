import { useQuery } from 'convex/react'
import { api } from '@aprendo/convex/api'
import type { Id } from '@aprendo/convex/dataModel'
import {
  Artifact,
  ArtifactClose,
  ArtifactContent,
  ArtifactDescription,
  ArtifactHeader,
  ArtifactTitle,
} from './ai-elements/artifact.tsx'

type ArtifactPaneProps = {
  artifactId: Id<'practiceTutorArtifacts'>
  studentId: Id<'students'>
  onClose: () => void
}

export function ArtifactPane({ artifactId, studentId, onClose }: ArtifactPaneProps) {
  const artifact = useQuery(api.tutor.getArtifact, { artifactId, studentId })

  if (artifact === undefined) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground">
        Cargando demostración…
      </div>
    )
  }

  if (artifact === null) {
    return (
      <div className="flex h-full flex-col items-stretch p-4">
        <div className="flex items-center justify-between border-b pb-3">
          <p className="text-sm font-medium">Demostración no disponible</p>
          <ArtifactClose onClick={onClose} />
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          No se encontró esta demostración.
        </p>
      </div>
    )
  }

  return (
    <Artifact className="h-full min-h-0">
      <ArtifactHeader>
        <div className="flex-1 min-w-0">
          <ArtifactTitle className="truncate">{artifact.title}</ArtifactTitle>
          {artifact.description ? (
            <ArtifactDescription className="truncate">
              {artifact.description}
            </ArtifactDescription>
          ) : null}
        </div>
        <ArtifactClose onClick={onClose} />
      </ArtifactHeader>
      <ArtifactContent className="min-h-0 p-0">
        <iframe
          srcDoc={artifact.htmlBody}
          sandbox="allow-scripts"
          title={artifact.title}
          className="h-full w-full border-0 bg-white"
        />
      </ArtifactContent>
    </Artifact>
  )
}
