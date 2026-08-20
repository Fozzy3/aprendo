/**
 * Derives a URL-safe slug from a PDF filename.
 *
 * Examples:
 *   "Matemáticas2010.pdf"        → "matematicas2010"
 *   "Ciencias Naturales 2011.pdf" → "ciencias-naturales-2011"
 *   "LECTURA_CRÍTICA 2012.pdf"    → "lectura-critica-2012"
 */
export function slugify(pdfFilename: string): string {
  return (
    pdfFilename
      // Strip .pdf extension (case-insensitive)
      .replace(/\.pdf$/i, '')
      // NFD normalize so accented chars become base + combining mark
      .normalize('NFD')
      // Strip combining diacritical marks (accents)
      .replace(/[\u0300-\u036f]/g, '')
      // Lowercase
      .toLowerCase()
      // Replace spaces and underscores with hyphens
      .replace(/[\s_]+/g, '-')
      // Remove anything that isn't a-z, 0-9, or hyphen
      .replace(/[^a-z0-9-]/g, '')
      // Collapse multiple consecutive hyphens
      .replace(/-{2,}/g, '-')
      // Trim leading/trailing hyphens
      .replace(/^-+|-+$/g, '')
  )
}
