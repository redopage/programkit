const actionColor = '#2563eb'

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

export interface ActionEmailInput {
  title: string
  intro: string
  actionLabel: string
  actionUrl: string
  footnote: string
}

export function actionEmail(input: ActionEmailInput) {
  const title = escapeHtml(input.title)
  const intro = escapeHtml(input.intro)
  const actionLabel = escapeHtml(input.actionLabel)
  const actionUrl = escapeHtml(input.actionUrl)
  const footnote = escapeHtml(input.footnote)

  return {
    text: `${input.title}\n\n${input.intro}\n\n${input.actionLabel}: ${input.actionUrl}\n\n${input.footnote}`,
    html: `<!doctype html><html><body style="margin:0;background:#ffffff;color:#18181b"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:40px 20px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px"><tr><td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.5"><h1 style="margin:0 0 12px;font-size:24px;line-height:1.2;font-weight:650;letter-spacing:-0.02em;color:#18181b">${title}</h1><p style="margin:0 0 24px;font-size:16px;color:#52525b">${intro}</p><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="${actionColor}" style="border-radius:999px"><a href="${actionUrl}" style="display:inline-block;padding:11px 18px;font-size:15px;line-height:20px;font-weight:600;color:#ffffff!important;text-decoration:none;border-radius:999px;background:${actionColor}">${actionLabel}</a></td></tr></table><p style="margin:24px 0 0;font-size:13px;color:#71717a">${footnote}</p></td></tr></table></td></tr></table></body></html>`,
  }
}
