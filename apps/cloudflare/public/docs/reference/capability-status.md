<!-- Canonical: https://programkit.dev/docs/reference/capability-status -->
<!-- Markdown: https://programkit.dev/docs/reference/capability-status.md -->

# Capability status vocabulary

ProgramKit uses a small status vocabulary so product, deployment, and integration documentation do
not imply more—or less—than the repository actually provides.

| Label                 | Meaning                                                                 |
| --------------------- | ----------------------------------------------------------------------- |
| **Included**          | Implemented in the supported repository assembly and covered by tests   |
| **Optional**          | Implemented, but requires an extra provider, binding, secret, or choice |
| **Experimental**      | Available for evaluation; contract or operations may still change       |
| **Operator-supplied** | Production control owned by the deployer or an external platform        |
| **Planned**           | Not available as a complete supported workflow                          |
| **Out of scope**      | Deliberately not part of ProgramKit's current product boundary          |

Labels can be combined when needed: Airtable persistence is **optional and experimental**; email
delivery is **optional**; edge abuse rules and malware scanning are **operator-supplied**. A feature
is not “production-ready” merely because it is included—the installation also needs the production
controls in the [launch checklist](/docs/self-hosting/launch-checklist.md).

## Evidence for a status claim

An **Included** claim should have all of the following:

- a reachable user, API, or agent surface;
- an end-to-end path through the supported host;
- authorization and failure behavior appropriate to the surface;
- focused automated coverage; and
- an accurate audience-facing guide.

A package export, unfinished screen, fixture, type, or roadmap paragraph is not enough. If the
complete journey exists but a deployment-specific control remains with the operator, describe both
facts rather than downgrading the implemented workflow to planned.

## Canonical product status

[`ROADMAP.md`](https://forge.smol.ai/andheller/programkit/src/branch/main/ROADMAP.md) is the canonical inventory of current capabilities, deliberate
limits, and remaining hardening work. Audience guides can summarize a status for a decision, but
they should link back instead of maintaining a competing checklist.
