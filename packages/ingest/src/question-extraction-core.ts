import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateText, Output } from 'ai'
import { QuestionExtractionSchema } from './question-schema'
import type { QuestionExtraction } from './question-schema'

const SYSTEM_PROMPT = `You are a structured data extractor for standardized exam PDFs that have been
OCR'd into markdown. Your task is to extract every multiple-choice question
from the document below.

## Rules

1. Each question has a number, a stem (the question text), and options (A, B,
   C, D).

2. GROUPED QUESTIONS. Some questions share a stimulus — a text, table, excerpt,
   map or data block introduced by an instruction like "RESPONDA LAS PREGUNTAS X
   A Y DE ACUERDO CON LA SIGUIENTE INFORMACIÓN". For every question in such a
   group you MUST set all three of:
   - context: the shared stimulus itself, in full, repeated identically on each
     question of the group. Do NOT put the "RESPONDA LAS PREGUNTAS…"
     instruction line inside context — it is metadata, not part of the stimulus.
   - contextRange: {from: X, to: Y}, the range taken from that instruction. If
     the document does not state a range, use the first and last question number
     that actually rely on the stimulus.
   - contextKey: a short identifier for the stimulus, e.g. "ctx-q4-q7". It MUST
     be byte-for-byte identical on every question of the group and different
     from every other group's key. This is the only thing linking the group.
   Questions 5, 6 and 7 of a "4 a 7" group are just as much part of the group as
   question 4 — do not leave them without context/contextKey/contextRange. A
   group may span a page break; follow the numbering, not the page.
   Questions with no shared stimulus omit context and set contextKey and
   contextRange to null.

3. Images appear in the markdown as ![alt](path). Do NOT describe or interpret
   images. Instead, place the path string (e.g. "../assets/page-05-image-01.jpg")
   into the appropriate field:
   - contextImages: images that are part of a shared context block
   - stemImages: images that are part of a specific question's stem
   - options[].images: images that ARE the answer option (or part of it)

4. When an answer option is only an image with no text, set text to null and
   put the image path in images.

5. Preserve all LaTeX notation exactly as it appears (both $inline$ and
   $$block$$ forms).

6. Preserve markdown table content exactly as it appears when it is part of a
   question context or stem.

7. Ignore any content that is not part of a question — cover pages, headers,
   footers, answer keys, and general instructions about how to fill in the exam.
   This does NOT apply to a shared stimulus: the text/table/excerpt a group of
   questions depends on is question content and must be captured per rule 2.

8. Number questions exactly as they appear in the document.`

function buildPrompt(pagesMarkdown: string): string {
  return `${SYSTEM_PROMPT}

## Document

<document>
${pagesMarkdown}
</document>`
}

export function joinPagesMarkdown(pages: string[]) {
  return pages.join('\n\n---\n\n')
}

export async function extractQuestionsFromMarkdown(args: {
  apiKey: string
  pagesMarkdown: string
}): Promise<QuestionExtraction[]> {
  const google = createGoogleGenerativeAI({ apiKey: args.apiKey })
  const { output } = await generateText({
    model: google('gemini-3-flash-preview'),
    output: Output.array({
      element: QuestionExtractionSchema,
    }),
    providerOptions: {
      google: {
        // Grouping requires tracking question numbering across the whole
        // document (a "4 a 7" group can straddle a page break), which a
        // zero-budget pass reliably loses. Small, but not zero.
        thinkingConfig: { thinkingBudget: 2048 },
      },
    },
    prompt: buildPrompt(args.pagesMarkdown),
  })

  if (output == null) {
    throw new Error('Gemini returned null output.')
  }

  return output
}
