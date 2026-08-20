import { z } from 'zod'

const OptionSchema = z.object({
  label: z.string().describe('The option letter: A, B, C, or D'),
  text: z
    .string()
    .nullable()
    .optional()
    .describe(
      'Text content of the option. Use null or omit when the option is image-only.',
    ),
  images: z
    .array(z.string())
    .optional()
    .describe(
      'Image paths (from the markdown) when the option is or contains an image.',
    ),
})

export const QuestionExtractionSchema = z.object({
  questionNumber: z.number().describe('The question number as it appears in the document.'),
  context: z
    .string()
    .optional()
    .describe(
      'The shared stimulus that introduces a group of questions: the text, table, excerpt or data itself. Do NOT include the instruction line ("RESPONDA LAS PREGUNTAS X A Y DE ACUERDO CON LA SIGUIENTE INFORMACIÓN") — that becomes contextRange. Repeat the full stimulus on EVERY question of the group. Omit if the question has no shared stimulus.',
    ),
  contextKey: z
    .string()
    .nullable()
    .optional()
    .describe(
      'Stable identifier for the shared stimulus, repeated IDENTICALLY on every question that shares it (e.g. "ctx-p05-q4-q7"). This is what links the group together. Null when the question has no shared stimulus.',
    ),
  contextRange: z
    .object({
      from: z.number().describe('First question number the stimulus applies to.'),
      to: z.number().describe('Last question number the stimulus applies to.'),
    })
    .nullable()
    .optional()
    .describe(
      'The range from the "RESPONDA LAS PREGUNTAS X A Y" instruction. Null when there is no shared stimulus.',
    ),
  contextImages: z
    .array(z.string())
    .optional()
    .describe(
      'Image paths referenced inside the shared stimulus. Omit if none.',
    ),
  stem: z
    .string()
    .describe('The question text itself, without the options.'),
  stemImages: z
    .array(z.string())
    .optional()
    .describe(
      'Image paths referenced inside the question stem. Omit if none.',
    ),
  options: z
    .array(OptionSchema)
    .describe('The answer options (typically A through D).'),
})

export type QuestionExtraction = z.infer<typeof QuestionExtractionSchema>
