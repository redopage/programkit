# Getting started

The fastest way to understand ProgramKit is to run the sample and walk one proposal all the way to
a published agenda. Allow about ten minutes.

## Run the sample

You need Git and Node.js 24 or newer.

```bash
git clone https://forge.smol.ai/andheller/programkit.git
cd programkit
npm run setup
npm start
```

Open `http://localhost:4173`. One process runs the React application, the Cloudflare Worker, and
local SQLite-backed Durable Objects. There is no Cloudflare login, R2 bucket, email provider, or API
key involved, and the seeded data is the same every time you reset it.

## Walk the lifecycle

Every ProgramKit event follows one spine:

```text
configure event → publish CFP → receive proposals → review → decide
                → onboard speakers → schedule sessions → publish program
```

Try it in that order:

1. Inspect the call for proposals in **Forms**.
2. Submit a proposal through the public form.
3. Assign and complete a review.
4. Accept the proposal, then look at the speaker, task, and session it created.
5. Complete the assigned work in the speaker portal.
6. Place the session, run schedule preflight, and publish.
7. Open the public agenda.

Organizers, submitters, reviewers, speakers, and attendees never share one view of the data. Each
role receives only the data and actions it needs, which is why step 7 looks nothing like step 1.

## Next

- [Set up your first event](first-event.md) — the same journey run as a rehearsal, with a
  checkpoint after every handoff.
- [Local development](../guides/local-development.md) — sample routes, resetting the seed, and the
  verification commands.
- [Deploy your own installation](../self-hosting/README.md) — one Cloudflare Worker in your own
  account.
- [Choose how to run ProgramKit](choose-a-deployment.md) — hosted app, demo, self-host, or fork.
