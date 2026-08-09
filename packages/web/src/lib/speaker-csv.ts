export interface SpeakerCsvRow {
  firstName: string
  lastName: string
  email: string
  title: string
  company: string
  bio: string
}

function parseCsvRows(text: string) {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"'
        index += 1
      } else if (character === '"') {
        quoted = false
      } else {
        field += character
      }
      continue
    }
    if (character === '"') {
      quoted = true
    } else if (character === ',') {
      row.push(field.trim())
      field = ''
    } else if (character === '\n') {
      row.push(field.trim())
      if (row.some(Boolean)) rows.push(row)
      row = []
      field = ''
    } else if (character !== '\r') {
      field += character
    }
  }
  row.push(field.trim())
  if (row.some(Boolean)) rows.push(row)
  return rows
}

function normalizedHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/gu, '_')
}

export function parseSpeakerCsv(text: string): SpeakerCsvRow[] {
  const [headerRow, ...dataRows] = parseCsvRows(text)
  if (!headerRow) throw new Error('The CSV is empty.')
  const headers = headerRow.map(normalizedHeader)
  const value = (row: string[], ...names: string[]) => {
    const index = names.map((name) => headers.indexOf(name)).find((entry) => entry >= 0) ?? -1
    return index >= 0 ? (row[index] ?? '').trim() : ''
  }
  if (!headers.includes('email')) throw new Error('Add an email column before importing.')
  if (!headers.includes('name') && !headers.includes('first_name')) {
    throw new Error('Add a name column, or first_name and last_name columns, before importing.')
  }

  return dataRows.map((row, index) => {
    const fullName = value(row, 'name')
    const parts = fullName.split(/\s+/u).filter(Boolean)
    const firstName = value(row, 'first_name', 'firstname') || parts.shift() || ''
    const lastName = value(row, 'last_name', 'lastname') || parts.join(' ')
    const email = value(row, 'email')
    if (!firstName || !lastName || !email) {
      throw new Error(`Row ${index + 2} needs a first name, last name, and email.`)
    }
    return {
      firstName,
      lastName,
      email,
      title: value(row, 'title', 'job_title'),
      company: value(row, 'company', 'organization'),
      bio: value(row, 'bio', 'biography'),
    }
  })
}
