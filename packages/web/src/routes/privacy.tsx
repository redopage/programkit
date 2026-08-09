import { createFileRoute } from '@tanstack/react-router'

import { LegalView } from '../views/LegalView.tsx'

export const Route = createFileRoute('/privacy')({ component: PrivacyPage })

function PrivacyPage() {
  return (
    <LegalView title="Privacy policy" updated="August 9, 2026">
      <h2>What ProgramKit stores</h2>
      <p>
        ProgramKit stores the conference program information you enter, such as event settings,
        submissions, speaker profiles, reviews, tasks, schedules, and communications. A connected
        Airtable base can be the durable source of truth for this information.
      </p>

      <h2>Airtable connection</h2>
      <p>
        When you connect Airtable, Airtable shows the exact permissions and bases you grant.
        ProgramKit stores the resulting authorization tokens on the server and uses them only to
        operate the bases you selected. Tokens are never sent to the browser. You can disconnect
        Airtable from ProgramKit or revoke access in Airtable at any time.
      </p>

      <h2>Service providers</h2>
      <p>
        The hosted demo runs on Cloudflare. If you connect Airtable, Airtable processes the data in
        the selected base. A self-hosted installation is controlled by its operator and may use
        different service providers disclosed by that operator.
      </p>

      <h2>Sharing and sale</h2>
      <p>
        ProgramKit does not sell personal information. Data is shared only with providers needed to
        run the service, when you direct ProgramKit to do so, or when required by law.
      </p>

      <h2>Retention and deletion</h2>
      <p>
        Hosted demo data is automatically deleted after seven days and can be deleted sooner from
        the in-app banner. Deleting a demo removes ProgramKit&apos;s local state and connection, but
        does not delete records from an Airtable base you granted. Self-hosted operators control
        their own retention, backups, and deletion process.
      </p>

      <h2>Security</h2>
      <p>
        ProgramKit uses scoped authorization, server-side token storage, and encrypted transport. No
        system is perfectly secure, so production operators should follow the repository security
        checklist before using real participant data.
      </p>
    </LegalView>
  )
}
