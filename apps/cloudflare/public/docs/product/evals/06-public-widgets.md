<!-- Canonical: https://programkit.dev/docs/product/evals/06-public-widgets -->
<!-- Markdown: https://programkit.dev/docs/product/evals/06-public-widgets.md -->

# Public widgets and embed evaluation

This is the implementation and verification map for
`killmysaas-evals/specs/06-public-widgets.yaml`. ProgramKit exposes one published program through
five anonymous, shareable views plus portable JSON, XML, and iCal feeds.

## Current coverage

| Rubric | Status   | ProgramKit evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| EMB-01 | Verified | The Sessions view renders a card per published session with title, expandable description, local date and time, room, complete speaker identity, format, and track.                                                                                                                                                                                                                                                                                                                         |
| EMB-02 | Verified | One search index includes session title and description, room, format, track, and every speaker's name, title, and company. The visible result count updates with the filtered set.                                                                                                                                                                                                                                                                                                         |
| EMB-03 | Verified | Track, format, and room facets can be combined. Every filtered surface is derived from the same published-session set.                                                                                                                                                                                                                                                                                                                                                                      |
| EMB-04 | Verified | The Speakers view is a distinct directory ordered by surname. Entries include headshot or fallback, name, title, and company.                                                                                                                                                                                                                                                                                                                                                               |
| EMB-05 | Verified | Speaker search covers name, title, company, and bio. Opening an entry shows the bio and every published session with date, time, and room.                                                                                                                                                                                                                                                                                                                                                  |
| EMB-06 | Verified | The Agenda view is grouped by event-local day and time. Session rows show the correct time, room, title, track, and format from the latest published release.                                                                                                                                                                                                                                                                                                                               |
| EMB-07 | Verified | Day navigation changes both the active date and the published sessions rendered for that day.                                                                                                                                                                                                                                                                                                                                                                                               |
| EMB-08 | Verified | Opening an agenda session shows its full time range, room, description, format, track, and speakers. Closing the drawer restores the agenda state.                                                                                                                                                                                                                                                                                                                                          |
| EMB-09 | Verified | Itinerary sessions are ordered chronologically within day navigation and include track, format, title, optional description, full time, room, and complete speaker identities.                                                                                                                                                                                                                                                                                                              |
| EMB-10 | Verified | Attendees can add or remove sessions and switch to My schedule, which contains only their selected sessions in chronological order.                                                                                                                                                                                                                                                                                                                                                         |
| EMB-11 | Verified | Selections persist per event in local storage across reloads. Add to calendar downloads an iCal file containing the selected sessions with their titles, times, descriptions, and rooms.                                                                                                                                                                                                                                                                                                    |
| EMB-12 | Verified | The Gallery is a visual, surname-sorted grid with name search, photos or resilient initial fallbacks, names, titles, and companies.                                                                                                                                                                                                                                                                                                                                                         |
| EMB-13 | Verified | Gallery cards open the same complete speaker detail, including bio and session list, then return to the intact grid on close.                                                                                                                                                                                                                                                                                                                                                               |
| EMB-14 | Verified | Agenda, Sessions, Speakers, Itinerary, and Gallery are all views of the anonymous `/agenda?event=...` route. No organizer session is required.                                                                                                                                                                                                                                                                                                                                              |
| EMB-15 | Verified | Schedule studio's Share program dialog offers all five views; styled-script, basic-HTML, hosted-link, JSON, XML, and iCal outputs; track and room filters; description visibility; and an accent-color control. Organizers can save named embeds, retrieve their code later, and enable or disable them. Generated feeds are CORS-enabled and independently select the event. The production script was exercised from a separate localhost origin; calendar import remains a manual check. |
| EMB-16 | Verified | Organizer and public surfaces resolve through the same event state and release selector. All five views and all three feeds share one public projection, so titles, times, rooms, tracks, and speaker identity cannot drift between formats.                                                                                                                                                                                                                                                |

## Public contract

The interactive route accepts stable query parameters:

- `event` chooses the public event on a multi-event host;
- `view` chooses `agenda`, `sessions`, `speakers`, `itinerary`, or `gallery`;
- `track` and `room` narrow content by stable record ID;
- `accent` applies a six-digit hexadecimal accent to the active public view; and
- `descriptions=hide` removes session descriptions from the sessions list, itinerary, and session
  detail.

Portable outputs use the same event, filters, and description policy:

- `/public/v1/program.json`
- `/public/v1/program.xml`
- `/public/v1/program.ics`

The feeds expose only event metadata and published session, room, track, and public speaker fields.
They allow cross-origin `GET` requests, cache for one minute, and never return operator records.

## Verification completed

Automated HTTP coverage proves that:

1. JSON returns all ten seeded published sessions and no private workspace data;
2. a combined track and room filter returns only matching sessions;
3. `descriptions=hide` omits the field rather than returning an empty placeholder;
4. XML contains event, track, session, and speaker records;
5. iCal emits one `VEVENT` per published session with time and location;
6. CORS preflight succeeds; and
7. direct hosted feed URLs can select an event without relying on a prior page-view cookie.

The schedule core suite separately proves that a draft move does not alter the public release, a
later publish advances it, and older releases stay immutable.

## Manual evaluator handoff

From Schedule studio, open **Share program**, save a named embed, retrieve its code, and exercise
each output. The production styled script has been loaded from a separate localhost origin and
mounted the anonymous public program with all five view controls. Repeat that check after the final
freeze with published sessions so search, filters, and detail drawers are visible in the retained
evidence. Import the iCal URL into a calendar app and verify the published titles, dates, times, and
rooms. These are delivery checks rather than unimplemented product state.
