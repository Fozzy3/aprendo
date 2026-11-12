/**
 * Transactional email (verification, password reset) through Resend's HTTP API.
 * No SDK: one POST. Without `RESEND_API_KEY` nothing is sent and the message
 * goes to the log, so local development keeps working.
 */
export interface EmailMessage {
  to: string
  subject: string
  text: string
}

interface EmailTransport {
  apiKey: string | undefined
  /** Set on a real deployment: the log then must not carry the body's tokens. */
  siteUrl?: string
  from: string
  fetch: (url: string, init: RequestInit) => Promise<Response>
  log: (line: string) => void
}

/**
 * Sign-up asks for a verified email once a mail provider is configured, and also
 * on any real site (`SITE_URL`) missing its key: there it fails closed rather
 * than letting any address in. Only local development (neither set) stays open.
 *
 * `EMAIL_VERIFICATION=off` opens it on purpose (the pilot, before a sending
 * domain is verified). While it is off anyone can register with any address,
 * including one a school later adds as staff: remove it before schools join.
 */
export function emailVerificationRequired(env: { RESEND_API_KEY?: string; SITE_URL?: string; EMAIL_VERIFICATION?: string }) {
  if (env.EMAIL_VERIFICATION === 'off') return false
  // ponytail: open sign-up without a key (pilot runs without email); set RESEND_API_KEY to require verification.
  return env.RESEND_API_KEY != null
}

export const defaultTransport = (): EmailTransport => ({
  apiKey: process.env.RESEND_API_KEY,
  siteUrl: process.env.SITE_URL,
  from: process.env.EMAIL_FROM ?? 'Aprendo <no-reply@aprendo.co>',
  fetch: (url, init) => fetch(url, init),
  log: (line) => console.log(line),
})

export async function sendEmail(message: EmailMessage, transport: EmailTransport = defaultTransport()) {
  if (transport.apiKey == null) {
    // The body holds reset and verification links; on a real site the logs are
    // readable by more people than the inbox, so only the envelope goes there.
    const body = transport.siteUrl == null ? `\n${message.text}` : ''
    transport.log(`[email no enviado: falta RESEND_API_KEY] ${message.to} · ${message.subject}${body}`)
    return
  }
  const response = await transport.fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${transport.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: transport.from, ...message }),
  })
  if (!response.ok) {
    throw new Error(`Resend rechazó el correo (${response.status}): ${await response.text()}`)
  }
}
