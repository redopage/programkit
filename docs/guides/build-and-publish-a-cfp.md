# Build and publish a call for proposals

This guide is for an organizer using the reference application and for an agent helping that
organizer understand the same workflow. The reference host is seeded demo software; use sample data
until the production requirements in [Security](../../SECURITY.md) are complete.

## Start locally

```bash
npm run setup
npm start
```

Open `http://localhost:4173/forms`. The seed includes an open general CFP and a separate invited
session form so the multiple-form workflow is visible immediately.

## Shape the public form

1. Choose the form from the header. Form switching is disabled while unsaved edits exist.
2. Set the internal name, public URL slug, public title, introduction, confirmation message, and
   accepted submission kinds.
3. Add a question from the categorized picker. Choose the answer shape first; then edit the label,
   help text, data mapping, placeholder, options, visibility rule, and required status in Field
   settings.
4. Keep questions ordered around the submitter's mental model: proposal first, speaker identity
   second, supporting material last.
5. Use conditional visibility only when an earlier answer genuinely changes what is needed. A
   short complete form is better than a large form full of clever branches.

The **Data mapping** control makes the form-to-program contract explicit. Speaker mappings populate
the accepted speaker's profile; session mappings populate the accepted session. Each mapping can be
used once, and its answer type must be compatible with the destination. Newly inserted fields start
as **Custom answer**. If an answer type becomes incompatible, the builder safely returns that field
to **Custom answer** instead of preserving a misleading mapping.

Before publishing, use **Publish readiness** to confirm that all eight required mappings are present
and required. The same readiness rules live in core, so the organizer UI, API host, and future agent
surface cannot disagree about whether a form is publishable.

## Preview before saving or publishing

Select **Preview draft** to render the current unsaved form in desktop or mobile width. Test every
conditional path, required marker, choice list, and long label. Unsaved preview is intentionally
separate from the live public URL.

Then:

1. Save changes.
2. Publish or reopen the form from the status bar.
3. Open `/submit/{formSlug}` and complete a public submission as a submitter would.
4. Confirm the proposal appears in `/submissions` and the reviewer flow receives the expected
   assignment.

Do not treat a successful organizer preview as a full test. The public surface has its own scoped
projection, allowed operations, loading behavior, and validation path.

## Operation and code map

| Intent                             | Named operation           | Primary implementation                                  |
| ---------------------------------- | ------------------------- | ------------------------------------------------------- |
| Create a draft form                | `submission-form.create`  | `packages/core/src/engine.ts`                           |
| Replace content and ordered fields | `submission-form.update`  | `packages/core/src/engine.ts`                           |
| Open a form after validation       | `submission-form.publish` | `packages/core/src/engine.ts`                           |
| Start a public draft               | `submission.create`       | `packages/core/src/engine.ts`                           |
| Validate and submit                | `submission.submit`       | `packages/core/src/engine.ts`                           |
| Organizer builder                  | —                         | `packages/web/src/views/FormsView.tsx`                  |
| Draft preview                      | —                         | `packages/web/src/components/SubmissionFormPreview.tsx` |
| Public form                        | —                         | `packages/web/src/views/PublicSubmissionView.tsx`       |

The manifest at `packages/core/src/manifest.ts` is the canonical operation catalog. HTTP and web
clients must call those operations rather than recreating transitions.

## Production checklist for this workflow

- real organizer and submitter identity where required;
- tenant membership derived by the host, not a public workspace header;
- private blob storage with type/size limits, scanning, signed access, and deletion policy;
- rate limiting and abuse controls on public form routes;
- durable confirmation delivery with provider results and retry state;
- retention, export, backup, restore, and deletion procedures;
- accessibility and narrow-screen testing for customized forms;
- tests for every conditional branch and required-field combination.

Track current progress in the CFP row and convergence milestones of
[`ROADMAP.md`](../../ROADMAP.md).
