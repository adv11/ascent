# ADR-003: Firebase Hosting as the production platform for v1.0

**Date**: 2026-07-05
**Status**: Active
**Deciders**: solo project — adv01
**Issue**: #28

## Context

SwitchPrep needs a hosting platform capable of:
- Serving a ~130 KB uncompressed static site globally with a CDN edge
- Automatic deploys on every push to `main`
- PR preview channels so deploys can be reviewed before merging
- Custom domain with auto-provisioned SSL
- No paid tier for the expected traffic at v1.0 launch

The app already uses Firebase Authentication and Realtime Database in the same Firebase
project. The platform choice affects infrastructure complexity, billing surface, and the
number of CLIs/dashboards the project requires.

## Options evaluated

| Platform | Free bandwidth | CDN | Custom domain | Auto-deploy | Notes |
|---|---|---|---|---|---|
| **Firebase Hosting** | 10 GB/month | ✅ Global | ✅ | ✅ via Actions | Co-located with Auth + RTDB; `firebase.json` also needed for Issue #25 security headers |
| Cloudflare Pages | Unlimited | ✅ (fastest) | ✅ | ✅ | Best fallback at scale; requires `_headers` file instead of firebase.json |
| Netlify | 100 GB/month | ✅ | ✅ | ✅ | Fine, but adds a third platform |
| GitHub Pages | 100 GB soft | ✅ | ✅ | ✅ | No custom response headers — blocks Issue #25 |
| Vercel | 100 GB/month | ✅ | ✅ | ✅ | Overkill for a static site |

## Decision

**Firebase Hosting on the Spark (free) tier.**

### Reasoning

**Co-location**: Auth and Realtime Database already live in a Firebase project. Hosting
in the same project means one CLI (`firebase deploy`), one dashboard, one billing account
(all free), and no cross-platform IAM or CORS configuration.

**`firebase.json` already required**: Issue #25 (CSP + security headers) needs a
`firebase.json` with a `hosting` block to set HTTP security headers. Firebase Hosting
creates this naturally; other platforms would need a separate mechanism (`_headers`,
`netlify.toml`, `vercel.json`, etc.).

**Bandwidth math**: The entire deployable payload is ~130 KB uncompressed / ~50 KB
gzipped. Firebase SDK and Google Fonts load from their own CDNs and do not count against
project hosting bandwidth. At 10 K users/month with a 30% new-visitor rate:
`(3 000 × 50 KB) + (7 000 × 5 KB) ≈ 185 MB/month` — well under the 10 GB free limit.

**Preview channels**: Firebase Hosting's `channelId: pr-N` feature posts a temporary
preview URL on every PR comment, enabling pre-merge visual review.

## Consequences

- **Positive**: Zero infra overhead beyond existing Firebase project. Security headers
  (`firebase.json`) and deploy automation land in the same PR.
- **Positive**: Rollback is instant — Firebase Hosting keeps full release history;
  reverting is two clicks in the console (Hosting → Release history → Revert).
- **Negative**: 10 GB/month bandwidth cap. Exceeding it costs $0.15/GB on the Blaze
  (pay-as-you-go) tier. At the expected v1.0 traffic level this is not a concern.
- **Mitigation**: The migration path to Cloudflare Pages (if bandwidth becomes an issue)
  is documented below.

## Migration path to Cloudflare Pages

If the project outgrows the Firebase Hosting bandwidth limit:

1. Add a `_headers` file at the project root containing the same security headers
   currently in `firebase.json`.
2. Connect the GitHub repo to Cloudflare Pages (dashboard → Create a project → Connect
   to Git → select the repo, set build command to empty, output directory to `.`).
3. Remove the `hosting` block from `firebase.json` (keep `emulators` and `database`).
4. Update `.github/workflows/deploy.yml` to remove the Firebase deploy steps (Cloudflare
   Pages auto-deploys from GitHub directly — no Actions step needed unless you want
   explicit control).
5. Update the custom domain DNS records at the domain registrar to point at Cloudflare
   Pages.

Estimated migration effort: ~4 hours.

## Setup instructions

### Required GitHub configuration

| Name | Type | Value |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | Secret | Firebase service account JSON (Firebase Console → Project Settings → Service accounts → Generate new private key) |
| `FIREBASE_CONFIG` | Secret | Contents of `src/services/firebase.config.js` for the production Firebase project |
| `FIREBASE_PROJECT_ID` | Variable (non-secret) | The Firebase project ID (e.g. `switchprep-prod`) |

### Manual one-time steps

1. In Firebase Console → Hosting → Get started — follow the wizard to activate hosting
   for the project.
2. Set the three values above in GitHub → Settings → Secrets and variables → Actions.
3. Optionally set `.firebaserc` default project to your actual project ID.

### Cache strategy

| Route | `Cache-Control` | Reason |
|---|---|---|
| `/index.html` | `no-cache, no-store` | Entry point must always be fresh so JS/CSS changes take effect immediately |
| `/src/**` | `max-age=31536000, immutable` | First-party JS/CSS — Firebase Hosting serves each deploy revision from a unique CDN URL, so cache busting is handled by the fresh `index.html` reference |
| `**/*.css` | `max-age=31536000, immutable` | Same rationale as above |

### Custom domain (Phase 4)

Firebase Hosting supports custom domains (e.g. `useascent.app`) with auto-provisioned
SSL. Steps:
1. Firebase Console → Hosting → Add custom domain
2. Add the provided TXT verification record at your domain registrar
3. Add the A records pointing to Firebase Hosting IPs
4. SSL provisions automatically within 24 hours

Document the exact DNS records in `docs/architecture.md` at setup time.
