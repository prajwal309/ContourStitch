# ContourStitch

ContourStitch uses a guided live video session to estimate six body measurements on-device. Users can review the estimates, enter tape corrections, and save a reusable fit profile in their browser or account.

## Local development

Use Node.js 22.12 or later and npm.

```sh
npm ci
npm run dev
```

Open `http://localhost:3000`. Guest mode works without configuration. The camera requires a secure context. Use localhost for desktop development or HTTPS when testing on a phone.

To enable accounts, copy `.env.example` to `.env`, configure a PostgreSQL database and at least one OAuth provider, and run `npm run db:migrate` before starting the app. Prisma uses `DATABASE_URL` for migrations. The running app uses `DATABASE_URL_POOLED` when present and falls back to `DATABASE_URL`.

| Setting                                    | Purpose                                                                                   |
| ------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `AUTH_URL`                                 | Exact app origin, such as `http://localhost:3000` or `https://contourstitchv1.vercel.app` |
| `AUTH_SECRET`                              | Generate a separate random secret for each environment, e.g. `openssl rand -base64 32`    |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`     | Web application OAuth client credentials                                                  |
| `AUTH_FACEBOOK_ID`, `AUTH_FACEBOOK_SECRET` | Meta app ID and app secret for Facebook Login                                             |
| `DATABASE_URL`                             | Direct PostgreSQL connection for migration and local use                                  |
| `DATABASE_URL_POOLED`                      | TLS-enabled pooled PostgreSQL connection for Vercel Functions                             |

Register both exact callbacks for each origin where the providers are enabled. Google accepts an HTTP localhost callback during development. Use a dedicated Meta development app or stable HTTPS staging origin for Facebook testing. Complete each provider’s publishing requirements with the site’s real privacy policy and, for Meta, a user-data deletion process before enabling public access. [Google provider setup](https://authjs.dev/getting-started/providers/google) · [Facebook provider setup](https://authjs.dev/getting-started/providers/facebook)

```text
https://contourstitchv1.vercel.app/api/auth/callback/google
https://contourstitchv1.vercel.app/api/auth/callback/facebook
```

## Accounts and storage

The optional profile saved on a device stays in that browser, including through sign-in or sign-out. After signing in, **My Fit Profile** can save the current draft or explicitly import the saved browser copy. An identical set of measurement values resolves to the existing profile without overwriting it. The cloud editor retains original estimate ranges when a tape correction is added. Local and account deletion controls act on their respective copies.

Account ownership is checked on every profile read and write. Sign-in uses revocable PostgreSQL sessions and HTTP-only cookies, with secure cookies on HTTPS. To add a second provider, sign in with the original provider and choose **Connect** in My Account. Matching email addresses alone never connect accounts. Photos, video, masks, and landmarks stay in the browser. The cloud database stores only the account information and derived profile fields needed by these features.

## Verification

```sh
npx playwright install chromium
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```

The standard Playwright suite uses mocked camera input. The account integration test additionally runs both mocked OAuth providers through Auth.js against a disposable PostgreSQL database. Apply the migration to that database first, then point `CONTOURSTITCH_TEST_DATABASE_URL` at it when running Playwright.

```sh
DATABASE_URL=postgresql://localhost/contourstitch_test npm run db:migrate
CONTOURSTITCH_TEST_DATABASE_URL=postgresql://localhost/contourstitch_test npm run test:e2e
```

## Deployment

1. Provision managed PostgreSQL with TLS and connection pooling. Use separate databases and OAuth credentials for production and staging. [Prisma on Vercel](https://www.prisma.io/docs/guides/postgres/vercel)
2. Configure the production variables in the Vercel project and register the callbacks for its canonical HTTPS origin. Leave OAuth unconfigured on arbitrary preview URLs.
3. Apply `npm run db:migrate` from a trusted environment with the target database’s direct URL before enabling login. Use the project’s `npm run build` command on Vercel. It generates the Prisma client and runs the Next.js webpack production build.
4. After release, sign in with each real provider, refresh, sign out, and verify that two separate accounts can only see their own saved profiles. Confirm the local guest flow on a mobile browser.

MediaPipe models and WASM assets are served from the application origin under `public/models`. The CSP allows the same-origin assets and WebAssembly. The sign-in and account routes allow form redirects to Google and Facebook.

## Measurement limitations and validation

The guided scan uses MediaPipe pose landmarks and person masks on-device. It collects repeatable evidence through front, arms-extended, side, back, and relaxed neck poses. Stable frontal and side silhouette samples provide ellipse inputs for circumferences. Rear evidence can corroborate torso widths and arm paths. Arm length uses shoulder-joint to wrist distance. Sleeve length follows the elbow using the shoulder landmark as a proxy for the starting point. Neck estimates require clear silhouettes from the relaxed front and side and often need tape entry.

The live panel updates from a rolling window of valid frames while the wearer holds a pose. If the hold is interrupted, the provisional readings clear. Review uses only evidence from completed holds. [MediaPipe Pose Landmarker for the web](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker?tab=Web)

Height calibration is approximate. The optional reference step uses an upright rigid object of known length in the same plane as the wearer. Align the two markers to the ends of the object in the temporary frame. Keep the camera level and at the same distance throughout. Disagreement with entered height is a reason to retry the reference or continue with height calibration.

Loose clothing, hair, occlusion, lighting, motion, posture, camera perspective and incorrect scale can affect results. Capture checks and left/right differences describe the evidence the app saw. The video estimates have no calibrated uncertainty intervals. The interface withholds values when the necessary evidence is missing or inconsistent. Verify every estimate with a tape before garment production. The existing PostgreSQL JSON profile format stores the added arm and neck keys, arm sides, methods, and tape corrections. The scan can be applied to an existing profile as a draft before saving a new revision.

Test the camera flow on current Safari/iOS and Chrome/Android. Spoken guidance requires a local English system voice. The on-screen instructions and tape entry are available independently of voice or camera support.

### Tape comparison workflow

Collect prospective validation scans with consent. Include a representative range of body shapes, clothing conditions, devices, and camera angles. Have a trained measurer take independent tape readings with consistent landmarks and repeat readings to check tape repeatability. Record scan failures and dimensions withheld, and keep participants out of calibration sets used to tune thresholds. Exclude names, photos, video, and landmarks from the validation file.

Supply a JSON array with `anonymousId`, `predictedCm`, and `referenceCm`. Use the keys `arm`, `chest`, `sleeve`, `neck`, `waist`, and `hip`; omit any unsupported prediction and keep its tape reference. Optional `conditions` fields `device`, `clothing`, and `cameraAngle` can contain coarse labels. Run `node scripts/validate-measurements.mjs records.json` for bias, MAE, RMSE, 95th percentile absolute error, and coverage. Add one of `--by=device`, `--by=clothing`, or `--by=cameraAngle` to compare conditions. Use the error and coverage together before making accuracy claims.

The estimator interface can accept a depth- or mesh-based method. Learned RGB shape models such as SHAPY are candidates for comparison, especially across clothing conditions. Methods that fit a body model from depth scans, such as MeasureXpert, would require different capture inputs. Evaluate either approach on held-out ContourStitch scans before using it for fit recommendations. The previous rotation and ONNX prototype is available for development at `/measure/experimental`. [SHAPY paper](https://openaccess.thecvf.com/content/CVPR2022/html/Choutas_Accurate_3D_Body_Shape_Regression_Using_Metric_and_Semantic_Attributes_CVPR_2022_paper.html) · [MeasureXpert paper](https://openaccess.thecvf.com/content/ICCV2025/html/Zhao_MeasureXpert_Automatic_Anthropometric_Measurement_Extraction_from_Two_Unregistered_Partial_Posed_ICCV_2025_paper.html)

## Heritage Tailor theme

The shared palette, typography, spacing, and component state tokens live in `app/theme.css`. The site self-hosts Cormorant Garamond and Inter, with Google Sans on the Google sign-in button. The font licenses are included in `app/fonts`. Sign-in artwork comes from the [Google Identity guidelines](https://developers.google.com/identity/branding-guidelines) and [Facebook](https://www.facebook.com/images/fb_icon_325x325.png).

The built-in ImageGen tool created `public/editorial/heritage-atelier.webp` using this prompt.

> Photorealistic editorial photograph for the right-hand hero of a modern bespoke tailoring studio website. Portrait 4:5 composition. An oatmeal linen tailor’s dress form in a rich dark espresso herringbone suit jacket, three-quarter view, with a warm ivory measuring tape draped naturally over one shoulder. The jacket and handsome lapel dominate; no person. Warm plaster atelier wall, delicate side window light, subtle film grain, tactile cloth, warm browns and soft sand, quiet craftsmanship. At the bottom edge a soft suggestion of a walnut workbench. Keep the main silhouette centered to survive mobile crop. Single coherent realistic scene, clean magazine photography, no lettering, words, logos, watermarks, graphic overlays or collages.

## Fit profiles and family fittings

The guided video scan and tape entry are available under **Measure**. **My Account** manages the display name shown to group organizers and sign-in methods. **My Fit Profile** lists saved profiles and their recorded dates. Editing creates a private revision, and the detail page shows the available history. The fit profile migration backfills each existing profile at its current version and recorded date. Earlier edits predate the history feature.

The Shop, including the Heritage Wedding Collection and product pages, is paused. The page source and demo artwork are stored in the private Next.js folder `app/_paused-shop`. The catalog remains in `lib/shop/catalog.ts` and existing outfit selections remain in the database.

Review estimates with a tape before production and after changes in body dimensions.

**Family Fit Studio** stores groups, organizer and membership records, and outfit selections in PostgreSQL. Invite links are single-use, expire after seven days, and can be revoked before redemption. The database stores SHA-256 digests of invitation tokens. An organizer can see group names and member display names. Body measurements, extra dimensions and fit preferences are visible only to the member who supplied them.

Each existing selection references the exact private fit revision used when it was saved. Updating a profile creates a new revision while existing selections keep their original one. Deleting a fit profile removes its revisions and makes dependent selection progress pending.

Catalog photography, fabrics and outfit choices are illustrative. Apply both Prisma migrations before enabling the account and family routes. The database-backed Playwright run checks group authorization, revoked and used links, and privacy of the fit revisions linked to existing outfits.

### Demonstration photography

Built-in ImageGen created the four illustrations now stored in `app/_paused-shop/collections-art`. The parked catalog expects the artwork under `public/collections` when restored. Each was generated with the following prompt.

- `adult-kurta.webp` — Photorealistic bespoke South Asian wedding clothing product photograph for ContourStitch’s demo catalog. Vertical 4:5 framing, entire outfit visible on a headless linen tailor’s form, soft warm stone plaster background, a little walnut floor, natural soft light, authentic woven fabric texture and understated finishing. No people, text, watermark, props, or other outfits. Warm cream, soft sand and copper, timeless high-end tailoring editorial. An adult long ivory textured kurta with modest aged-copper embroidered mandarin neckline, long sleeves and matching straight trousers.
- `adult-lehenga.webp` — Photorealistic bespoke South Asian wedding clothing product photograph for ContourStitch’s demo catalog. Vertical 4:5 framing, entire outfit visible on a headless linen tailor’s form, soft warm stone plaster background, a little walnut floor, natural soft light, authentic woven fabric texture and understated finishing. No people, text, watermark, props, or other outfits. Warm cream, soft sand and copper, timeless high-end tailoring editorial. An adult burnished copper lehenga with a floor-length skirt, half-sleeve matching blouse and a cream dupatta draped naturally on the form.
- `child-kurta.webp` — Photorealistic bespoke South Asian wedding clothing product photograph for ContourStitch’s demo catalog. Vertical 4:5 framing, entire outfit visible on a headless linen tailor’s form, soft warm stone plaster background, a little walnut floor, natural soft light, authentic woven fabric texture and understated finishing. No people, text, watermark, props, or other outfits. Warm cream, soft sand and copper, timeless high-end tailoring editorial. A child-size ivory kurta with copper piping around a narrow band collar and ivory trousers, on a small child-size garment display form.
- `child-dress.webp` — Photorealistic bespoke South Asian wedding clothing product photograph for ContourStitch’s demo catalog. Vertical 4:5 framing, entire outfit visible on a headless linen tailor’s form, soft warm stone plaster background, a little walnut floor, natural soft light, authentic woven fabric texture and understated finishing. No people, text, watermark, props, or other outfits. Warm cream, soft sand and copper, timeless high-end tailoring editorial. A child-size copper occasion dress, subtle woven fabric, gathered tea-length skirt, cap sleeves and warm ivory sash, on a small garment display form.
