# Security Policy

## Reporting a vulnerability

If you find a security vulnerability in Ascent, please report it privately —
**do not open a public GitHub issue** for it, since that discloses the issue to
everyone before a fix is available.

Instead, use GitHub's private vulnerability reporting for this repo:
[github.com/adv11/ascent/security/advisories/new](https://github.com/adv11/ascent/security/advisories/new).
If that's not available to you, open a normal issue asking to be pointed to a
private contact — don't include vulnerability details in that issue itself.

Please include, where you can:

- A clear description of the vulnerability and its potential impact.
- Steps to reproduce it (a minimal example is ideal).
- Which part of the app is affected (client-side code, Firebase security rules,
  a specific API/endpoint, a dependency, etc.).

You should get an acknowledgement within a few days. This is a solo-maintained
project, not a company with a dedicated security team, so response times will
vary — but every report is read and taken seriously.

## Scope

In scope:

- The application code in this repository (`src/`, `firebase/`, `scripts/`,
  `sw.js`).
- The Firebase Realtime Database security rules
  (`firebase/database.rules.json`) — a rule that lets one user read or write
  another user's data, or that fails to validate a field it should, is a real
  vulnerability, not just a bug.
- The Content Security Policy and Subresource Integrity configuration in
  `index.html`.

Out of scope:

- Vulnerabilities in third-party dependencies with no known exploit path
  through this app specifically (report those upstream, to the dependency
  itself).
- Denial-of-service reports based purely on volume/rate (this is a small,
  low-traffic app; rate-limiting concerns can be filed as a normal
  feature-request issue instead).
- Social engineering, phishing, or physical-access attacks against the
  maintainer or users.

## What's already in place

See the [README's Security section](README.md#security) for a summary of the
concrete measures already implemented (CSP + SRI, server-side security-rule
validation, no `innerHTML` anywhere in the codebase, encrypted automated
backups, CI-gated production deploys) — useful context before filing a report,
since some classes of issue are already mitigated at that layer.

## Supported versions

Ascent is a continuously-deployed single-version web app — there is no older
release branch receiving separate security patches. A fix lands on `main` and
deploys to production as soon as it merges and passes CI.
