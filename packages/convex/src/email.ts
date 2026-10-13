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
  from: string
  fetch: (url: string, init: RequestInit) => Promise<Response>
  log: (line: string) => void
}

export const defaultTransport = (): EmailTransport => ({
  apiKey: process.env.RESEND_API_KEY,
  from: process.env.EMAIL_FROM ?? 'Aprendo <no-reply@aprendo.co>',
  fetch: (url, init) => fetch(url, init),
  log: (line) => console.log(line),
})

export async function sendEmail(message: EmailMessage, transport: EmailTransport = defaultTransport()) {
  if (transport.apiKey == null) {
    transport.log(`[email no enviado: falta RESEND_API_KEY] ${message.to} · ${message.subject}\n${message.text}`)
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
