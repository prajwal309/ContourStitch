# ContourStitch

ContourStitch estimates eight body measurements from guided front and side photos using an entered height for scale. It runs pose detection, segmentation, and measurement calculations in the browser. Users can review the estimated ranges, enter tape corrections, and save on their device or to an optional account.

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

The optional profile saved on a device stays in that browser, including through sign-in or sign-out. After signing in, **My Measurements** can save the current draft or explicitly import the saved browser copy. An identical set of measurement values resolves to the existing profile without overwriting it. The cloud editor retains original estimate ranges when a tape correction is added. Local and account deletion controls act on their respective copies.

Account ownership is checked on every profile read and write. Sign-in uses revocable PostgreSQL sessions and HTTP-only cookies, with secure cookies on HTTPS. To add a second provider, sign in with the original provider and choose **Connect** in My Measurements. Matching email addresses alone never connect accounts. Photos, video, masks, and landmarks stay in the browser. The cloud database stores only the account information and derived profile fields needed by these features.

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

MediaPipe models and WASM assets are served from the application origin under `public/models`. The CSP allows the same-origin assets and WebAssembly. Only the sign-in and dashboard pages allow form redirects to Google and Facebook.

## Measurement limitations and validation

Test camera capture on current Safari/iOS and Chrome/Android. The app offers a local photo picker and tape entry where camera access is unavailable. Model inference and supported file formats depend on the browser and device.

The two-view method approximates torso cross-sections as ellipses. Clothing, lighting, framing, pose, camera perspective, and an inaccurate height can all affect the estimates. Uncertainty ranges are heuristic, and inseam is particularly sensitive to occlusion. Confirm measurements with a tape before garment production.

Run `node scripts/validate-measurements.mjs /path/to/de-identified-records.json` to compare paired predictions and reference tape measurements. The script reports per-measurement bias, MAE, RMSE, and 95th percentile absolute error. Use representative samples before making accuracy claims.

## Heritage Tailor theme

The shared palette, typography, spacing, and component state tokens live in `app/theme.css`. The site self-hosts Cormorant Garamond and Inter, with Google Sans on the Google sign-in button. The font licenses are included in `app/fonts`. Sign-in artwork comes from the [Google Identity guidelines](https://developers.google.com/identity/branding-guidelines) and [Facebook](https://www.facebook.com/images/fb_icon_325x325.png).

The built-in ImageGen tool created `public/editorial/heritage-atelier.webp` using this prompt.

> Photorealistic editorial photograph for the right-hand hero of a modern bespoke tailoring studio website. Portrait 4:5 composition. An oatmeal linen tailor’s dress form in a rich dark espresso herringbone suit jacket, three-quarter view, with a warm ivory measuring tape draped naturally over one shoulder. The jacket and handsome lapel dominate; no person. Warm plaster atelier wall, delicate side window light, subtle film grain, tactile cloth, warm browns and soft sand, quiet craftsmanship. At the bottom edge a soft suggestion of a walnut workbench. Keep the main silhouette centered to survive mobile crop. Single coherent realistic scene, clean magazine photography, no lettering, words, logos, watermarks, graphic overlays or collages.
