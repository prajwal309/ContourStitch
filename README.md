# ContourStitch

ContourStitch uses a guided live video session to estimate seven body measurements on-device. Supported estimates appear as their required evidence becomes available. Users can review the estimates, enter corrections manually, and save a reusable fit profile in their browser or account.

## Local development

Use Node.js 22.12 or later and npm. Guest measurement works without database configuration. Account and cloud-profile development uses the existing Vercel PostgreSQL integration; it does not provision a database.

```sh
npm ci
npm run dev
```

Open `http://localhost:3000`. The camera requires a secure context. Use localhost for desktop development or HTTPS when testing on a phone.

Use a dedicated PostgreSQL database for local development. Set its connection string in `.env.local` along with `AUTH_URL=http://localhost:3000`, then apply `npm run db:migrate`. The Prisma CLI reads `.env.local` and `.env`. Obtain a direct connection string from the existing Prisma Postgres resource for production migrations when Vercel CLI exports integration values as blank. Keep connection strings out of Git and logs.

The app uses the Vercel Postgres connection variables directly. Runtime prefers `DATABASE_URL_POOLED`, then `POSTGRES_PRISMA_URL`, `DATABASE_URL`, `POSTGRES_URL`, `POSTGRES_URL_NON_POOLING`, and `PRISMA_DATABASE_URL`. Migrations prefer `DATABASE_URL` and `POSTGRES_URL_NON_POOLING` so they use a direct connection when available.

| Setting                                    | Purpose                                                                                                               |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `AUTH_URL`                                 | Canonical origin. Use `http://localhost:3000` locally and `https://contourstitchv1.vercel.app` in Vercel Production.  |
| `AUTH_SECRET`                              | Required only for optional OAuth. Generate a separate random secret per environment with `openssl rand -base64 32`.   |
| `RESEND_API_KEY`                           | Server-only API key used to deliver Contact & Feedback messages through Resend.                                       |
| `CONTACT_FROM_EMAIL`                       | Sender address verified with Resend, for example `ContourStitch <contact@example.com>`.                               |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`     | Optional Google Web application OAuth client credentials                                                              |
| `AUTH_FACEBOOK_ID`, `AUTH_FACEBOOK_SECRET` | Optional Meta app ID and app secret for Facebook Login                                                                |
| `DATABASE_CONNECTION_MODE`                 | Optional. Set to `direct` temporarily when a verified pooled connection is unavailable. Uses the existing direct URL. |
| `DATABASE_URL`                             | Optional direct PostgreSQL connection for Prisma migrations and local use                                             |
| `DATABASE_URL_POOLED`                      | Optional pooled PostgreSQL connection for runtime                                                                     |
| `POSTGRES_PRISMA_URL`                      | Vercel Postgres Prisma-compatible pooled runtime connection                                                           |
| `POSTGRES_URL`                             | Vercel Postgres connection fallback                                                                                   |
| `POSTGRES_URL_NON_POOLING`                 | Vercel Postgres direct connection for Prisma migrations                                                               |

Username and password accounts use the application origin and PostgreSQL. They work without `AUTH_SECRET` or provider credentials. To enable OAuth as an additional sign-in option, configure `AUTH_SECRET` and at least one complete credential pair. Google accepts an HTTP localhost callback during development. Use a dedicated Meta development app or a stable HTTPS staging origin for Facebook testing. Complete each provider’s publishing requirements with the site’s real privacy policy and, for Meta, a user-data deletion process before enabling public access. [Google provider setup](https://authjs.dev/getting-started/providers/google) · [Facebook provider setup](https://authjs.dev/getting-started/providers/facebook)

```text
https://contourstitchv1.vercel.app/api/auth/callback/google
https://contourstitchv1.vercel.app/api/auth/callback/facebook
```

## Accounts and storage

The optional profile saved on a device stays in that browser, including through sign-in or sign-out. After signing in, **My Fit Profile** can save the current draft or explicitly import the saved browser copy. An identical set of measurement values resolves to the existing profile without overwriting it. The cloud editor retains original estimate ranges when a tape correction is added. Local and account deletion controls act on their respective copies.

Account ownership is checked on every profile read and write. Sign-in uses revocable PostgreSQL sessions and HTTP-only cookies, with secure cookies on HTTPS. Username registration requires no email address and uses salted scrypt password hashes and shared PostgreSQL attempt limits. New and reset passwords require 8–128 characters, including at least one punctuation or symbol character; spaces are allowed and no other composition rules apply. Existing passwords remain valid for sign-in. A new or reset password must pass a server-side, padded Have I Been Pwned prefix lookup. If the lookup service is unavailable, existing passwords still work and password creation or reset must be retried. In My Account, users can upload a PNG, JPEG, or WebP profile picture up to 200 KB, and update their display name, private name and phone fields, username, measurement-unit and garment-fit preferences, and password. Profile pictures are stored with account data only after explicit upload; camera measurement photos, video, masks, and landmarks stay in the browser. Sensitive password-account changes require the current password; password changes revoke other sessions and any existing recovery code. A recovery code is generated only after confirming the current password, shown once, and stored as a hash. A reset consumes the code and revokes existing sessions. Password accounts without a saved code cannot be reset through this flow. Email-based verification and recovery are unavailable because this deployment has no email delivery service; email supplied by a sign-in provider cannot be changed in the app. The interface is currently English-only. Existing provider-only accounts still use their original provider. When OAuth is configured, an authenticated user can connect a provider in My Account. Matching email addresses alone never connect accounts. The cloud database stores only the account information and derived profile fields needed by these features.

Use **My Account → Privacy & Data** to download a JSON export of account details, connected providers, consent history, saved measurements and revisions, and family-group records. The export excludes password hashes, recovery-code hashes, and session tokens. Password accounts must confirm the current password before deleting account measurements or the account. Use **Delete my account** to remove the account, sessions, connected providers, fit profiles, their history, and private shares. If the account organized a family group, the earliest remaining member becomes organizer and pending invitations are revoked. A group with no remaining members is deleted. Browser-only measurements can be deleted separately from the results page.

Saving or updating a cloud profile explicitly creates a `MeasurementRevision` session and normalized `MeasurementObservation` rows—one per current measurement. Each row stores centimetres, display unit, method, quality, available uncertainty, and timestamp; its revision foreign key connects it to the owner through the profile. Live frame updates remain in browser state and never write to PostgreSQL. Profile edits create a new revision, history displays per-measurement changes from the latest session, and deleting a profile cascades through its revisions and observations.

## Contact & feedback

The footer opens the in-app composer at `/contact`. Messages are sent as plain text through Resend to server-side recipient mappings; the selected recipient emails are not included in the browser bundle. The sender's account email is used as Reply-To when available; guests can enter their email. Contact message contents are not stored in the application database. The endpoint checks same-origin requests, validates fields, uses a hidden spam-trap field, applies shared PostgreSQL attempt limits (12 per client-address key and 5 per sender address per ten minutes), and forwards a stable idempotency key to Resend.

Configure `RESEND_API_KEY` and `CONTACT_FROM_EMAIL` in `.env.local` for local delivery and in Vercel for each environment where contact messages should be sent. Verify the sender domain/address with Resend before using it. The existing PostgreSQL migrations must be applied because the rate limiter uses the `PasswordAttempt` table. If the email service or rate-limit database is unavailable, the endpoint reports an error and does not display a success confirmation.

## Verification

```sh
npx playwright install chromium
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```

The standard Playwright suite uses mocked camera input. The account integration tests use real password validation, rate limits, recovery and database-backed sessions against disposable PostgreSQL. Only the external breach-corpus responses and optional provider responses are simulated. Apply migrations to that test database first, then point `CONTOURSTITCH_TEST_DATABASE_URL` at it when running Playwright.

```sh
DATABASE_URL=postgresql://localhost/contourstitch_test npm run db:migrate
CONTOURSTITCH_TEST_DATABASE_URL=postgresql://localhost/contourstitch_test npm run test:e2e
CONTOURSTITCH_TEST_DATABASE_URL=postgresql://localhost/contourstitch_test CONTOURSTITCH_TEST_PASSWORD_ONLY=1 npm run test:e2e -- e2e/password.spec.ts
```

## Deployment

1. Keep the existing Prisma Postgres integration attached to the Vercel project; do not provision another database. If you enable optional OAuth, use separate credentials for production and staging. [Prisma on Vercel](https://www.prisma.io/docs/guides/postgres/vercel)
2. In the Vercel project’s **Settings → Environment Variables**, verify a supported PostgreSQL connection URL is enabled in the required environments. Set `AUTH_URL` explicitly so registered callbacks use the intended domain. Configure `RESEND_API_KEY` and a Resend-verified `CONTACT_FROM_EMAIL` in every environment where the Contact & Feedback form should deliver mail. When `AUTH_URL` is absent, production can use `VERCEL_PROJECT_PRODUCTION_URL` when Vercel system variables are enabled. Preview deployments require their own configured origin. Add preview OAuth credentials only if you want provider sign-in there. [Vercel environment variables](https://vercel.com/docs/environment-variables/managing-environment-variables) · [Vercel system variables](https://vercel.com/docs/environment-variables/system-environment-variables)
3. Before promoting a release, connect to the existing Prisma Postgres resource with its direct URL in `DATABASE_URL`. Run `npm run db:migrate` to apply the checked-in migrations, then `npm run db:verify` to confirm the migration history and compare the live schema with `prisma/schema.prisma`. Both checks in `db:verify` are read-only. The regular build generates Prisma Client and builds Next.js. Keep the migration step in the release process and use `migrate deploy` for existing production databases. [Prisma Postgres on Vercel](https://www.prisma.io/docs/guides/postgres/vercel)
4. Redeploy after changing Vercel variables. Create an account with a username and password, refresh, sign out, and sign in again. Verify account ownership with a second account and confirm the guest flow on a mobile browser. If you enable OAuth, `/api/auth/providers` lists configured providers and each enabled provider needs a real sign-in check. With password-only sign-in it returns an empty object. A 503 indicates account configuration is unavailable. Check for `ContourStitch sign-in disabled` or `ContourStitch account failure` in Vercel runtime logs. An account failure log contains the operation, support reference and allowlisted error codes. For a schema error, run `npm run db:verify` against the same database that the Production pooler uses. For a connection error, check the linked resource and that Production receives its pooled URL. If a read through the pooler reports it cannot reach its upstream while the direct connection succeeds, set `DATABASE_CONNECTION_MODE=direct` for Production and redeploy. Direct connections have a lower concurrency limit. Remove the override and redeploy when the pooler is healthy again.

To check the schema during Production builds, enable the Vercel system environment variables and set **Settings → Build and Deployment → Build Command** to the following. Apply migrations before starting the build. Preview builds continue to use the regular build command.

```sh
if [ "$VERCEL_ENV" = production ]; then npm run db:verify || exit 1; fi
npm run build
```

In **Google Auth Platform**, configure your app branding and audience. Create a **Web application** OAuth client under **Clients**, add the exact Google callback above under **Authorized redirect URIs**, and put its client ID and client secret into `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`. Use test users while the app is in Testing, then publish the consent screen when ready. [Google OAuth client setup](https://support.google.com/cloud/answer/15549257)

In **Meta for Developers**, create or select an app with the **Facebook Login** use case. In its web OAuth settings, enable **Client OAuth Login** and **Web OAuth Login**, and add the exact Facebook callback above to **Valid OAuth Redirect URIs**. Use the app ID and app secret from **App settings → Basic** for `AUTH_FACEBOOK_ID` and `AUTH_FACEBOOK_SECRET`. Test with a user assigned an app role, then meet Meta’s publication and access requirements before allowing general sign-in. [Facebook Login setup](https://developers.facebook.com/docs/facebook-login/manually-build-a-login-flow/) · [Auth.js Facebook provider](https://authjs.dev/getting-started/providers/facebook)

MediaPipe models and WASM assets are served from the application origin under `public/models`. The CSP allows the same-origin assets and WebAssembly. The sign-in and account routes allow form redirects to Google and Facebook.

An authenticated, no-store database check is available at `/api/health/database`. It verifies the required application tables through PostgreSQL's `information_schema` and returns only `ok`, `unauthorized`, or `unavailable`; it never returns connection details or database records.

## Measurement limitations and validation

The progressive multi-view engine is available in local or preview environments with `CONTOURSTITCH_PROGRESSIVE_ENGINE=1`. It uses the same consent and profile workflows. The fixed-pose engine remains the default pending independent tape and camera validation. See the [engine design and validation report](IMPLEMENTATION.md).

The guided scan uses MediaPipe pose landmarks and person masks on-device. It collects repeatable evidence through front, arms-extended, side, back, and relaxed neck poses. Stable frontal and side silhouette samples provide ellipse inputs for circumferences. Rear evidence can corroborate torso widths and arm paths. Shoulder breadth is a front-view shoulder-joint distance proxy; arm length uses shoulder-joint to wrist distance. Sleeve length follows the elbow using the shoulder landmark as a proxy for the starting point. Neck estimates require clear silhouettes from the relaxed neck and side views and often need manual entry.

The live panel starts with height-conditioned population references and shows camera estimates as usable views arrive. Precision bars use camera repeatability separately from population variation. The default ±2 cm target and consecutive-observation count are configurable in `lib/live-measurement/config.ts`. The pose guide and camera reports use their existing sample-count and spread gates. Estimates that miss the live repeatability target can still be reviewed as experimental values. The scan does not advance until each pose passes its capture checks; use Manual Entry if a pose cannot be completed. Voice guidance is enabled by default and can be disabled. It gives the same concise corrective instruction on screen and aloud, applies a configurable cooldown to routine prompts, and prioritizes confirmations only after a view is accepted. Height-based priors and provisional frame estimates are not announced as acquired measurements.

| Live measurement    | Required views and evidence                                                        | Optional refinement                    |
| ------------------- | ---------------------------------------------------------------------------------- | -------------------------------------- |
| Shoulder breadth    | Front view, visible shoulder landmarks, height or known-size reference calibration | None                                   |
| Sleeve length       | Front view, shoulder/elbow/wrist landmarks, scale calibration                      | Back view can refine left/right path   |
| Arm length          | Arms-extended view, both shoulder/wrist paths, scale calibration                   | None                                   |
| Chest circumference | Front and side silhouettes, torso landmarks, segmentation, matching scales         | Back view corroborates front width     |
| Waist circumference | Front and side silhouettes, torso landmarks, segmentation, matching scales         | Back view corroborates front width     |
| Hip circumference   | Front and side silhouettes, torso landmarks, segmentation, matching scales         | Back view corroborates front width     |
| Neck circumference  | Side and relaxed-neck silhouettes, consistent scale                                | None                                   |
| Torso length        | Front shoulder-to-hip landmark distance                                            | Back view can refine the landmark path |
| Inseam              | Height-conditioned population prior only; no supported camera method in this build | Manual Entry                           |

These are dependencies of the current camera estimator, not a claim that the views are sufficient for validated tailoring accuracy. The height-only priors use linear regressions fit to public ANSUR II male and female cohorts (4,082 men and 1,986 women); the cohorts are equally weighted because the app does not request sex. ANSUR II represents U.S. military personnel, not civilian or tailoring customers. Priors are withheld outside 150–190 cm rather than extrapolated. A deterministic, stratified 20% record holdout produced prior-only MAE values of about 1.3 cm for shoulder breadth, 1.4 arm length, 6.8 chest, 8.7 waist, 5.7 hip, 1.9 inseam, 1.7 torso, and 1.8 neck. These figures measure fit within the same source dataset only; they do not validate camera accuracy or performance on ContourStitch users. The raw public records are not included in this repository.

Height calibration is approximate. The optional reference step uses an upright rigid object of known length in the same plane as the wearer. Align the two markers to the ends of the object in the temporary frame. Keep the camera level and at the same distance throughout. Disagreement with entered height is a reason to retry the reference or continue with height calibration.

Loose clothing, hair, occlusion, lighting, motion, posture, camera perspective and incorrect scale can affect results. Capture checks and left/right differences describe the evidence the app saw. The live panel labels ANSUR II population ranges separately from camera repeatability. Both ranges are uncalibrated. Final camera reports still carry no validated physical uncertainty, and prior-only live values are not persisted by the current report/save path. Manual entries also have no assigned interval. Camera values are withheld when necessary evidence is missing or inconsistent; prior-only values remain explicitly labeled as such. Verify every estimate with a tape before garment production. The existing PostgreSQL JSON profile format stores shoulder, arm, and neck keys, arm sides, methods, and tape corrections. The scan can be applied to an existing profile as a draft before saving a new revision.

Test the camera flow on current Safari/iOS and Chrome/Android. Spoken guidance prefers an available English browser voice marked natural, neural, premium, or enhanced, then falls back to the first English voice; it reads the browser's current voice list for each prompt so asynchronously loaded voices are picked up. If the selected voice cannot start, the next available English voice is tried. If browser speech is unavailable, matching bundled English prompts are attempted, and the browser default is used only when it is suitable for English. Users can enable or disable guidance, replay prompts, and adjust volume; no voice-selection menu is shown. Directional guidance uses the participant's perspective and the unmirrored camera source, regardless of preview mirroring. On-screen instructions and Manual Entry remain available independently of voice or camera support. Acquisition progress, milestone announcements, checkmarks, and the local confirmation tone use accepted camera-supported measurements only; population priors do not count as acquired. Bundled audio is cached in the browser, and no images or measurements are sent to a speech service. Automated tests cover automatic voice selection, delayed loading, fallback, cancellation, cooldown, acquisition priority and progress, and replay; real-device compatibility still needs validation in Safari/iOS, Firefox, and Edge.

### Tape comparison workflow

Collect prospective validation scans with consent. Include a representative range of body shapes, clothing conditions, devices, and camera angles. Have a trained measurer take independent tape readings with consistent landmarks and repeat readings to check tape repeatability. Record scan failures and dimensions withheld, and keep participants out of calibration sets used to tune thresholds. Exclude names, photos, video, and landmarks from the validation file.

Supply a JSON array with `anonymousId`, `predictedCm`, and `referenceCm`. Use the keys `arm`, `chest`, `sleeve`, `neck`, `waist`, and `hip`; omit any unsupported prediction and keep its tape reference. Optional `conditions` fields `device`, `clothing`, and `cameraAngle` can contain coarse labels. Run `node scripts/validate-measurements.mjs records.json` for bias, MAE, RMSE, 95th percentile absolute error, and coverage. Add one of `--by=device`, `--by=clothing`, or `--by=cameraAngle` to compare conditions. Use the error and coverage together before making accuracy claims.

The estimator interface can accept a depth- or mesh-based method. Learned RGB shape models such as SHAPY are candidates for comparison, especially across clothing conditions. Methods that fit a body model from depth scans, such as MeasureXpert, would require different capture inputs. Evaluate either approach on held-out ContourStitch scans before using it for fit recommendations. [SHAPY paper](https://openaccess.thecvf.com/content/CVPR2022/html/Choutas_Accurate_3D_Body_Shape_Regression_Using_Metric_and_Semantic_Attributes_CVPR_2022_paper.html) · [MeasureXpert paper](https://openaccess.thecvf.com/content/ICCV2025/html/Zhao_MeasureXpert_Automatic_Anthropometric_Measurement_Extraction_from_Two_Unregistered_Partial_Posed_ICCV_2025_paper.html)

### Experimental reconstruction comparison

The internal development route `/measure/experimental` opens the legacy comparison tools. It reuses the laptop RGB webcam turn capture and lets a user select the existing baseline or the independent browser-side visual-hull beta. The visual-hull path keeps only downsampled binary silhouettes in memory, asks for a known height as its scale anchor, supports 4, 8, 16, 32, or 64 requested angles, carves a bounded voxel grid, extracts exposed voxel faces as a mesh, and estimates chest/waist/hip cross-section perimeters. Its normalized projections assume a weak-perspective camera and relative turn angles; it does not estimate full camera intrinsics or a calibrated rotation axis. The mesh and circumferences are experimental geometric proxies, not validated measurements. No confidence interval is currently calibrated; the engine leaves uncertainty unavailable and asks users to confirm with a tape.

**Parametric 3D Body Fitting — Beta** is a selectable but intentionally unavailable option. This repository does not include a PyTorch fitting service or body-model weights. Commercial deployment requires a separately licensed commercial model and a secured external inference service; research-only SMPL-family assets must not be used as if commercially licensed. No API URL, token, or service is configured, and the UI will not substitute or fabricate fitted measurements.

The `/measure/benchmarks` research dashboard accepts a local JSON array with `id`, `engine`, `key`, `predictedCm`, `referenceCm`, `uncertaintyCm`, `latencyMs`, and `failed`; `viewCount` can be `4`, `8`, `16`, `32`, or `64` for angle-count ablations. The browser computes bias, MAE, RMSE, P95 absolute error, failure rate, average latency, and empirical interval coverage. The file is not uploaded or persisted. For reproducible SVG figures under `Figures/`, run:

```sh
node scripts/benchmark-reconstruction.mjs records.json
```

Only supplied records are measured; there are no bundled participant records or published accuracy results. The automated synthetic tests exercise basic geometry and input handling, but they are not a real-world tape validation, calibration-sensitivity, clothing/posture, repeatability, uncertainty-calibration, GPU, or memory benchmark. Collect a consented, de-identified, held-out tape dataset and report each engine separately before making accuracy or tailoring-readiness claims.

## Plum & Rose Gold design system

The shared palette, typography, spacing, and component state tokens live in `app/theme.css`. The semantic palette is Deep Plum `#45274F`, Rose Gold `#C89B91`, Pearl `#FAF5F3`, Soft Lavender `#EDE4F0`, and Muted Rose `#E4D3D8`; separate success, warning, and error tokens remain available for status feedback. Landing and shared site chrome use the same tokens, and Rose Gold is reserved for decorative accents on light surfaces. The site self-hosts Cormorant Garamond and Inter, with Google Sans on the Google sign-in button. The font licenses are included in `app/fonts`. Sign-in artwork comes from the [Google Identity guidelines](https://developers.google.com/identity/branding-guidelines) and [Facebook](https://www.facebook.com/images/fb_icon_325x325.png).

The built-in ImageGen tool created `public/editorial/heritage-atelier.webp` using this prompt.

> Photorealistic editorial photograph for the right-hand hero of a modern bespoke tailoring studio website. Portrait 4:5 composition. An oatmeal linen tailor’s dress form in a rich dark espresso herringbone suit jacket, three-quarter view, with a warm ivory measuring tape draped naturally over one shoulder. The jacket and handsome lapel dominate; no person. Warm plaster atelier wall, delicate side window light, subtle film grain, tactile cloth, warm browns and soft sand, quiet craftsmanship. At the bottom edge a soft suggestion of a walnut workbench. Keep the main silhouette centered to survive mobile crop. Single coherent realistic scene, clean magazine photography, no lettering, words, logos, watermarks, graphic overlays or collages.

## Fit profiles and family fittings

**Camera-Based Measurement** and **Enter Measurements Manually** are available from the landing page. **My Account** provides responsive navigation for profile details, a concise Digital Fit Passport summary, Family Fit Studio, measurement-unit and garment-fit preferences, password and provider security, session management for password accounts, consent, data export, and deletion. Display names are visible to group organizers; first/last names, phone number, email, and profile pictures remain private. Saved measurements are private unless the user explicitly shares a measurement revision. Email-verification status reflects the connected sign-in provider; the app does not send verification messages. **My Fit Profile** remains the source of truth for saved profiles, corrections, and their history. The fit profile migration backfills each existing profile at its current version and recorded date. Earlier edits predate the history feature.

The Shop, including the Heritage Wedding Collection and product pages, is paused. The page source and demo artwork are stored in the private Next.js folder `app/_paused-shop`. The catalog remains in `lib/shop/catalog.ts` and existing outfit selections remain in the database.

Review estimates with a tape before production and after changes in body dimensions.

**Family Fit Studio** stores groups, fitting occasions, memberships, invitations, and explicit profile shares in PostgreSQL. Invite links are single-use, expire after seven days, and can be revoked before redemption. The database stores SHA-256 digests of invitation tokens. A member can share one specific fit profile revision with the current organizer and revoke access at any time. The organizer sees the measurements in that revision in the group. Future edits, other revisions, and the full profile remain private. Shares do not transfer to a new organizer.

Each existing selection references the exact private fit revision used when it was saved. Updating a profile creates a new revision while existing selections keep their original one. Deleting a fit profile removes its revisions and makes dependent selection progress pending.

Catalog photography, fabrics and outfit choices are illustrative. Apply all Prisma migrations before enabling the account and family routes. The database-backed Playwright run checks group authorization, revoked and used links, explicit sharing, and account deletion.

### Demonstration photography

Built-in ImageGen created the four illustrations now stored in `app/_paused-shop/collections-art`. The parked catalog expects the artwork under `public/collections` when restored. Each was generated with the following prompt.

- `adult-kurta.webp` — Photorealistic bespoke South Asian wedding clothing product photograph for ContourStitch’s demo catalog. Vertical 4:5 framing, entire outfit visible on a headless linen tailor’s form, soft warm stone plaster background, a little walnut floor, natural soft light, authentic woven fabric texture and understated finishing. No people, text, watermark, props, or other outfits. Warm cream, soft sand and copper, timeless high-end tailoring editorial. An adult long ivory textured kurta with modest aged-copper embroidered mandarin neckline, long sleeves and matching straight trousers.
- `adult-lehenga.webp` — Photorealistic bespoke South Asian wedding clothing product photograph for ContourStitch’s demo catalog. Vertical 4:5 framing, entire outfit visible on a headless linen tailor’s form, soft warm stone plaster background, a little walnut floor, natural soft light, authentic woven fabric texture and understated finishing. No people, text, watermark, props, or other outfits. Warm cream, soft sand and copper, timeless high-end tailoring editorial. An adult burnished copper lehenga with a floor-length skirt, half-sleeve matching blouse and a cream dupatta draped naturally on the form.
- `child-kurta.webp` — Photorealistic bespoke South Asian wedding clothing product photograph for ContourStitch’s demo catalog. Vertical 4:5 framing, entire outfit visible on a headless linen tailor’s form, soft warm stone plaster background, a little walnut floor, natural soft light, authentic woven fabric texture and understated finishing. No people, text, watermark, props, or other outfits. Warm cream, soft sand and copper, timeless high-end tailoring editorial. A child-size ivory kurta with copper piping around a narrow band collar and ivory trousers, on a small child-size garment display form.
- `child-dress.webp` — Photorealistic bespoke South Asian wedding clothing product photograph for ContourStitch’s demo catalog. Vertical 4:5 framing, entire outfit visible on a headless linen tailor’s form, soft warm stone plaster background, a little walnut floor, natural soft light, authentic woven fabric texture and understated finishing. No people, text, watermark, props, or other outfits. Warm cream, soft sand and copper, timeless high-end tailoring editorial. A child-size copper occasion dress, subtle woven fabric, gathered tea-length skirt, cap sleeves and warm ivory sash, on a small garment display form.

## Consent and legal documents

New accounts accept the Terms of Service and acknowledge the Privacy Policy at registration. The camera workflow asks separately for the Body Measurement Consent & Accuracy Policy when the current version has no valid consent on record. Guest consent is requested before camera access and is not stored server-side. Acceptance of the two archived agreements does not carry over to the new policy. Optional improvement consent is separate and unchecked by default. ContourStitch records that choice without exporting saved profiles or using them for training. Existing accounts renew only outdated agreements. Consent events are append-only while an account exists, and account deletion removes them through the current database cascade.

**Privacy & Consent** in My Account shows current choices, links to legal documents, and provides withdrawal and deletion controls. Camera-based measurement consent is separate from required account agreements and optional data-improvement sharing. Family Fit sharing is a separate, explicit per-revision choice that can be revoked; it is not a general third-party measurement-sharing program or a versioned consent event. Measurement deletion removes cloud profiles, revisions, observations, measurement shares, and saved fit selections. It also clears the current browser’s saved profile. Account deletion removes consent history along with the account.

The active drafts are Terms v2, Privacy v6, Body Measurement Consent & Accuracy Policy v1, and Optional Data Use v2. Privacy v6 describes optional profile-picture storage and triggers the existing consent-renewal check. Each legal page links to related documents, displays its version and last-updated date, and retains the draft-pending-review designation. For a material change, add a new version to `lib/consent/documents.ts` and update that agreement’s active version in `lib/consent/agreements.ts`. Keep previous document text at its versioned URL. Do not backfill acceptance for users who have not reviewed the new document.

The documents are drafts pending legal review. Before public rollout, confirm the operator and privacy-contact information, supported jurisdictions and age policy, whether the adult-only source population is suitable, representative civilian and tailoring ground-truth validation, applicable body-data and biometric-data rules, hosting/database subprocessors and regions, privacy request handling, and retention periods for provider data, logs, and backups. Do not market the priors or camera estimates as tailoring-ready.

## Landing 3D body illustration

The landing-page “360° Body Mesh” uses a precomputed body surface and indexed wireframe derived from the Quaternius Superhero Female FullBody model (CC0 1.0). `public/models/ATTRIBUTION.txt` records the source and modifications. The browser loads one versioned geometry file and caches it by URL. Rotation transforms the existing mesh, guides follow the same 16-second demo timeline, and continuous drawing pauses when the canvas is offscreen. The figure is illustrative and uses no camera frames or user measurements.

The source rig is retained for offline regeneration with `node scripts/bake-mannequin.mjs`. Update the asset version in the loader, generator, and cache rule when publishing different geometry. Run `node scripts/benchmark-mannequin.mjs http://localhost:3000 5` against each production build to compare five cold browser contexts.

#### Mannequin benchmark

Medians from five fresh Chromium 153 contexts per local production build on an Apple M1, at 1280 × 900 and device pixel ratio 1. Chromium used SwiftShader. First draw is measured from navigation, with the demo scrolled into view. FPS is the rate of rendered frames over a 4.2-second visible window.

| Metric                        |      Original | Baked mannequin |
| ----------------------------- | ------------: | --------------: |
| First WebGL body draw         |        303 ms |          241 ms |
| Mannequin requests            |             2 |               1 |
| Encoded mannequin payload     | 996,118 bytes |    92,620 bytes |
| Body vertices                 |         7,376 |           1,731 |
| Unique indexed body edges     |        20,186 |           5,176 |
| Body triangles                |        12,812 |           3,458 |
| Draw calls per rendered frame |           6.7 |             4.0 |
| Rendered frames per second    |          26.8 |            60.1 |
| WebGL buffer storage          |       404 KiB |          90 KiB |
| Page JS heap after collection |      7.26 MiB |        6.65 MiB |

WebGL buffer storage counts allocated vertex and index buffers. Total GPU memory also includes render targets and driver allocations. The bake locks silhouette points across the shoulder, chest, waist and hip zones and favors retaining curvature. The largest projected width change across five sampled body heights and twelve viewing angles was 4.4 mm on the 1.8 m illustration. The measurement guides use their original, precomputed coordinates.
