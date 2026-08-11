import { describe, expect, it } from 'vitest'
import { actionEmail } from '../apps/cloudflare/src/email.ts'

describe('transactional email presentation', () => {
  it('uses the product action color and a consistent simple layout', () => {
    const email = actionEmail({
      title: 'Sign in',
      intro: 'Use this link to continue.',
      actionLabel: 'Sign in',
      actionUrl: 'https://app.programkit.dev/auth/verify?token=example',
      footnote: 'This link expires in 15 minutes and can be used once.',
    })

    expect(email.html).toContain('bgcolor="#2563eb"')
    expect(email.html).toContain('background:#2563eb')
    expect(email.html).toContain('border-radius:999px')
    expect(email.html).not.toContain('ProgramKit')
    expect(email.text).not.toContain('ProgramKit')
  })

  it('escapes recipient-facing content and links', () => {
    const email = actionEmail({
      title: 'Join <Event & Friends>',
      intro: 'A "friend" invited you.',
      actionLabel: 'Accept invitation',
      actionUrl: 'https://example.com/invite?one=1&two=2',
      footnote: "Don't forward this link.",
    })

    expect(email.html).toContain('Join &lt;Event &amp; Friends&gt;')
    expect(email.html).toContain('A &quot;friend&quot; invited you.')
    expect(email.html).toContain('one=1&amp;two=2')
    expect(email.html).toContain('Don&#039;t forward this link.')
  })
})
