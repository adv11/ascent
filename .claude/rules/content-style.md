# User-facing content style

Loaded whenever a page/component with user-facing text is touched — button labels,
modal copy, guide/help text, empty states, error/toast messages, onboarding
instructions, form labels/placeholders. New file added by issue #106 (a copy audit that
found the app's existing text was already close to this standard — the fixes were mostly
small consistency gaps, not rewrites) — see `docs/adr/ADR-007-agent-memory-architecture.md`
for why area-specific conventions live here instead of root `CLAUDE.md`.

This does **not** cover code comments, commit messages, or internal docs — those are
developer-facing, not something an end user ever reads in the running app.

## Plain language

- Short sentences. One idea per sentence; split anything that needs "and" to join two
  unrelated facts.
- Everyday words over jargon. Say "topic" not "roadmap item" or "entity" — match the
  vocabulary the UI itself already uses (see "Vocabulary" below).
- Active voice: "This deletes the phase" not "The phase will be deleted."
- Second person for instructions: "you" and "your", not "the user."

## Grammar and mechanics baseline

- No sentence fragments in body copy (headings, button labels, and status chips are
  exempt — "Autosaved" next to a checkmark icon (`itemPanel.js`'s `.notes-status`, issue
  #136 Phase 2 — was a literal "✓" glyph appended to the string, now a real `createIcon()`
  svg sibling) is a label, not a sentence).
- Sentence case for buttons/headings ("Delete roadmap", not "Delete Roadmap" or "DELETE
  ROADMAP") — matches the existing UI convention, not Title Case.
- Every toast message and modal body sentence ends with terminal punctuation (a period
  or `?`), even a short one — "Password updated." not "Password updated". This was the
  single most common gap found in the #106 audit (see the before/after below).
- No double spaces, no trailing whitespace, no smart-quote/straight-quote mixing within
  the same string.
- Numbers/limits interpolated into a message should read as part of the sentence:
  `` `Topic title must be ${MAX_TITLE_LENGTH} characters or fewer.` ``, not a bare number
  dropped in with no surrounding grammar.

## Button and action labels

- Verb-first, specific: "Delete roadmap" not "Delete", "Export JSON" not "Export".
  A label should make sense read on its own, without its surrounding context.
- Use the tone-appropriate acknowledgement for a given modal, not a reflexive "OK" —
  "Got it" for an informational guide (`buildYourOwnGuide.js`, `dailyTodoGuide.js`),
  "Delete" for a destructive confirm, "Cancel" for backing out.
- Destructive actions get destructive labels: "Delete account", not "Confirm" or "Yes."

## Error and toast messages

- State what happened and, where there's a next step, what to do about it: "Could not
  open that roadmap. Check your connection and try again." not "Something went wrong."
- Never show a raw `Error` object, stack trace, or backend error code to the user —
  route caught errors through a mapping function (`authErrorMessage()` in
  `firebase.js` is the existing pattern) that translates them into one of these
  messages, and log the raw error to the console instead (`console.error(...)`, already
  the convention at every `catch` block that also shows a toast).
- Success toasts confirm the specific thing that happened: `` `Deleted "${title}".` ``,
  not a generic "Success."
- Exception: the AI-import validator's field-level errors
  (`src/core/roadmap/importValidator.js`, e.g. `phases[2].sections[0].title is
  required`) are deliberately structured/technical, not prose — that modal's whole job
  is helping a user locate an exact spot in JSON they pasted, and the path notation is
  the fastest way to do that. Don't "fix" these into full sentences; that would make
  them harder to scan against the pasted text.

## Vocabulary — stay consistent with what's already established

A roadmap's rows are always called "topics" in user-facing text (`itemPanel.js`'s "Edit
topic"/"Delete topic", `dashboard.js`'s "Add a custom topic…", the 800-topic-limit
toast) — never "item," "entity," or "task" in copy the user reads, even though the code
itself calls them `item` throughout (`roadmapStore.js`, etc.). Code identifiers and
user-facing words are allowed to differ; user-facing words must not.

## Worked before/after (from the #106 audit)

Real fixes made by this issue, illustrating the punctuation and phrasing rules above —
not hypothetical examples:

| Before | After | Why |
|---|---|---|
| `showToast('Password updated', 'success')` | `showToast('Password updated.', 'success')` | Toast sentences need terminal punctuation, matching every other toast in the same file. |
| `showToast(\`Deleted phase "${phase.title}"\`, 'success')` | `showToast(\`Deleted phase "${phase.title}".\`, 'success')` | Same — the interpolated title doesn't exempt the sentence from a period. |
| "Choose a template to get started. You can add, edit, or remove topics anytime after, and start more templates later without losing progress." | "...anytime, and start more templates later..." | "anytime after" was a dangling modifier with nothing for "after" to attach to. |
| "...it's validated and imported automatically — no copying topics in one at a time." | "...no need to add topics one at a time." | The original read as a sentence fragment bolted onto an em dash with awkward phrasing; this version scans as a complete clause. |

## When you touch user-facing text

1. Check this file's rules before writing a new string.
2. Check whether the same concept already has an established word (see "Vocabulary")
   before introducing a synonym.
3. If you rewrite an existing string, grep for it across `tests/e2e/` and
   `tests/unit/` — an E2E spec or unit test asserting on the exact old copy will break
   silently otherwise (this is required, not optional — see the Testing requirements
   section of issue #106).
