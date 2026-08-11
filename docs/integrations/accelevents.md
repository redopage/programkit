# Accelevents handoff

ProgramKit can package the current event's published program for a one-way import into
Accelevents. ProgramKit remains the planning source of truth. The export does not read from or
write to an Accelevents account.

This is the supported V1 integration. It removes manual record re-entry, but it is not yet a native
credentialed connector. Accelevents documents its existing Sessionboard integration as a pull from
the source system using an API key and event ID. Its general API is available only on Enterprise and
White Label plans. ProgramKit should not ship a push consumer until an event owner can validate the
exact supported contract and endpoints.

Open **Integrations** and choose **Download Accelevents package**. The ZIP contains:

| File                  | Purpose                                                              |
| --------------------- | -------------------------------------------------------------------- |
| `speakers.csv`        | Accepted speakers referenced by published sessions                   |
| `sessions.csv`        | Ready sessions and their published placements                        |
| `rooms-reference.csv` | ProgramKit room names beside an empty Accelevents Location ID column |
| `README.txt`          | Import order, timezone, schedule version, and export warnings        |
| `manifest.json`       | Machine-readable event, release, file counts, and warnings           |

## Import order

1. Import `speakers.csv` from the Accelevents Speakers area.
2. Create or confirm event Locations in Accelevents.
3. If locations should be assigned, copy each Accelevents numeric Location ID into the matching
   session rows. `rooms-reference.csv` provides the ProgramKit names and capacities.
4. Import `sessions.csv` from the Accelevents Sessions area.
5. Review both import previews before completing them.

The session file uses Location ID `0` by default, which Accelevents accepts when no location is
assigned. Speaker assignments use email addresses. Dates and times are rendered in the event's
configured IANA timezone, not the browser timezone.

ProgramKit follows the current official Accelevents CSV column names, including the source
template's `Instragram Handle` spelling. See the Accelevents guides for
[speaker CSV imports](https://support.accelevents.com/en/articles/74958-uploading-items-from-a-csv)
and [session CSV imports](https://support.accelevents.com/en/articles/13510323-upload-sessions-via-csv)
before importing into a production event. The future native boundary should be checked against the
[Sessionboard integration](https://support.accelevents.com/en/articles/9049978-sessionboard-integration)
and [Accelevents API availability](https://support.accelevents.com/en/articles/5990834-the-accelevents-api-and-webhooks)
for the customer's plan.

## Boundary

This integration is deliberately an export rather than continuous sync:

- only the latest published schedule release is included;
- draft and cancelled sessions stay in ProgramKit;
- edits made in Accelevents do not flow back;
- Accelevents credentials are not required or stored;
- re-exporting creates a fresh, reviewable handoff package.

Use the ProgramKit full export for backup and portability. Use the Accelevents package only for a
downstream event-delivery handoff.
