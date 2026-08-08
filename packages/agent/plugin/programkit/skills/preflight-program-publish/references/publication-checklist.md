# Publication checklist

The `preflight_program_publish` tool reports:

- A room or participant overlap remains
- A scheduled participant is declined, withdrawn, or unconfirmed
- Required participant public-profile fields are missing
- Unresolved change sets remain
- The latest published release ID and export-availability flag

Treat hard schedule conflicts and participant blockers as blocking. Treat schedule warnings and
unresolved change sets as warnings unless the tool reports otherwise.

The current MCP surface does not inspect asset renditions, accessibility metadata, the contents of
an export, authorization configuration, or downstream CDN health. Label those checks `NOT
VERIFIED` when they are required by the deployment. Never infer them from record text. State
exactly which server result or manual policy made each issue blocking or non-blocking.
