export interface PublicSpeakerMetadata {
  name: string
  title?: string | null
  company?: string | null
}

export function publicSpeakerRole(speaker: PublicSpeakerMetadata) {
  const title = speaker.title?.trim() ?? ''
  const company = speaker.company?.trim() ?? ''
  if (title && company) return `${title} at ${company}`
  return title || company
}

export function publicSpeakerAttribution(speaker: PublicSpeakerMetadata) {
  const role = publicSpeakerRole(speaker)
  return role ? `${speaker.name} · ${role}` : speaker.name
}
