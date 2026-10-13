import { describe, expect, mock, test } from 'bun:test'
import { sendEmail } from '../src/email'

const message = { to: 'ana@x.co', subject: 'Confirma tu correo', text: 'Abre https://aprendo.co/v' }

describe('sendEmail', () => {
  test('without a Resend key it sends nothing and says so in the log', async () => {
    const fetchMock = mock(() => Promise.resolve(new Response('{}')))
    const log = mock(() => {})
    await sendEmail(message, { apiKey: undefined, from: 'Aprendo <a@aprendo.co>', fetch: fetchMock, log })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(log).toHaveBeenCalled()
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
