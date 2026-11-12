import { describe, expect, mock, test } from 'bun:test'
import { emailVerificationRequired, sendEmail } from '../src/email'

const message = { to: 'ana@x.co', subject: 'Confirma tu correo', text: 'Abre https://aprendo.co/v' }

describe('sendEmail', () => {
  test('without a Resend key it sends nothing and says so in the log', async () => {
    const fetchMock = mock(() => Promise.resolve(new Response('{}')))
    const log = mock(() => {})
    await sendEmail(message, { apiKey: undefined, from: 'Aprendo <a@aprendo.co>', fetch: fetchMock, log })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(log).toHaveBeenCalled()
  })

  test('on a real site without a key the log carries recipient and subject, never the link', async () => {
    const lines: string[] = []
    await sendEmail(message, {
      apiKey: undefined, siteUrl: 'https://aprendo.co', from: 'Aprendo <a@aprendo.co>',
      fetch: mock(() => Promise.resolve(new Response('{}'))), log: (line) => lines.push(line),
    })
    expect(lines.join('\n')).toContain('ana@x.co')
    expect(lines.join('\n')).toContain('Confirma tu correo')
    expect(lines.join('\n')).not.toContain('https://aprendo.co/v')
  })

  test('posts the message to Resend', async () => {
    const fetchMock = mock((_url: string, _init: RequestInit) => Promise.resolve(new Response('{}')))
    await sendEmail(message, { apiKey: 're_123', from: 'Aprendo <a@aprendo.co>', fetch: fetchMock, log: () => {} })
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://api.resend.com/emails')
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer re_123')
    expect(JSON.parse(init.body as string)).toEqual({ from: 'Aprendo <a@aprendo.co>', ...message })
  })

  test('a refused send is an error, not a silent loss', async () => {
    const fetchMock = mock(() => Promise.resolve(new Response('bad', { status: 422 })))
    await expect(
      sendEmail(message, { apiKey: 're_123', from: 'Aprendo <a@aprendo.co>', fetch: fetchMock, log: () => {} }),
    ).rejects.toThrow(/422/)
  })
})

describe('emailVerificationRequired', () => {
  test('is on only when a Resend key can actually send the email', () => {
    expect(emailVerificationRequired({})).toBe(false)
    expect(emailVerificationRequired({ RESEND_API_KEY: 're_123' })).toBe(true)
    // Owner decision (2026-11-11): the pilot runs without email, so a site without a key stays open.
    expect(emailVerificationRequired({ SITE_URL: 'https://aprendo.co' })).toBe(false)
  })

  test('the owner can switch it off on purpose, even with a key and a site', () => {
    expect(emailVerificationRequired({ RESEND_API_KEY: 're_123', SITE_URL: 'https://aprendo.co', EMAIL_VERIFICATION: 'off' })).toBe(false)
  })
})
