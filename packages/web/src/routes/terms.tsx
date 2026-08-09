import { createFileRoute } from '@tanstack/react-router'

import { LegalView } from '../views/LegalView.tsx'

export const Route = createFileRoute('/terms')({ component: TermsPage })

function TermsPage() {
  return (
    <LegalView title="Terms of use" updated="August 9, 2026">
      <h2>Using ProgramKit</h2>
      <p>
        ProgramKit is an open-source conference program tool. You may use the hosted demo to
        evaluate the product and may self-host the source code under the license included in the
        repository.
      </p>

      <h2>Your responsibilities</h2>
      <p>
        You are responsible for the data you enter, the people you invite, and the permissions you
        grant. Do not use ProgramKit to violate the law, infringe another person&apos;s rights,
        distribute malware, or interfere with the service.
      </p>

      <h2>Connected services</h2>
      <p>
        When you connect Airtable or another service, its terms also apply. You control which
        resources are granted and may revoke that access through the connected service.
      </p>

      <h2>Availability</h2>
      <p>
        The hosted demo is provided for evaluation and may change or be reset. It is not a paid
        hosted service or a promise of uninterrupted availability. Self-hosted installations are
        operated by the person or organization that deploys them.
      </p>

      <h2>Disclaimer</h2>
      <p>
        ProgramKit is provided as available, without warranties to the extent permitted by law. The
        maintainers are not liable for indirect, incidental, or consequential losses arising from
        its use.
      </p>

      <h2>Changes</h2>
      <p>
        These terms may change as the hosted service develops. Material changes will be reflected by
        the date on this page.
      </p>
    </LegalView>
  )
}
