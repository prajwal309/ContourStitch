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

Test camera capture on current Safari/iOS and Chrome/Android. The app offers a local photo picker and tape entry where camera access is unavailable. Model inference and supported file formats depend on the browser and device.

The two-view method approximates torso cross-sections as ellipses. Clothing, lighting, framing, pose, camera perspective, and an inaccurate height can all affect the estimates. Uncertainty ranges are heuristic, and inseam is particularly sensitive to occlusion. Confirm measurements with a tape before garment production.

Run `node scripts/validate-measurements.mjs /path/to/de-identified-records.json` to compare paired predictions and reference tape measurements. The script reports per-measurement bias, MAE, RMSE, and 95th percentile absolute error. Use representative samples before making accuracy claims.

## Heritage Tailor theme

The shared palette, typography, spacing, and component state tokens live in `app/theme.css`. The site self-hosts Cormorant Garamond and Inter, with Google Sans on the Google sign-in button. The font licenses are included in `app/fonts`. Sign-in artwork comes from the [Google Identity guidelines](https://developers.google.com/identity/branding-guidelines) and [Facebook](https://www.facebook.com/images/fb_icon_325x325.png).

The built-in ImageGen tool created `public/editorial/heritage-atelier.webp` using this prompt.

> Photorealistic editorial photograph for the right-hand hero of a modern bespoke tailoring studio website. Portrait 4:5 composition. An oatmeal linen tailor’s dress form in a rich dark espresso herringbone suit jacket, three-quarter view, with a warm ivory measuring tape draped naturally over one shoulder. The jacket and handsome lapel dominate; no person. Warm plaster atelier wall, delicate side window light, subtle film grain, tactile cloth, warm browns and soft sand, quiet craftsmanship. At the bottom edge a soft suggestion of a walnut workbench. Keep the main silhouette centered to survive mobile crop. Single coherent realistic scene, clean magazine photography, no lettering, words, logos, watermarks, graphic overlays or collages.

## Fit profiles and wedding previews

The existing photo and tape tools remain available under **Measure**. **My Fit Profile** lists saved profiles and their recorded dates. Editing creates a private revision, and the detail page shows the available history. The fit profile migration backfills each existing profile at its current version and recorded date. Earlier edits predate the history feature.

The initial Heritage Wedding Collection links adult and junior kurtas, an adult lehenga, and a junior dress through common color and fabric variants. The version-controlled catalog in `lib/shop/catalog.ts` provides stable identifiers, facets, product variants, and required measurement definitions. Keeping the demonstration catalog in code lets guests browse without PostgreSQL and gives future collections a straightforward way to add new requirements.

When a signed-in shopper opens an outfit, the shop offers the most recently recorded profile. Compatibility checks whether the necessary recorded body dimensions exist. Additional body measurements and preferred garment lengths are entered separately in centimetres. Fit preferences are saved as notes. Review estimates with a tape before production and after changes in body dimensions.

**Family Fit Studio** stores groups, organizer and membership records, and outfit selections in PostgreSQL. Invite links are single-use, expire after seven days, and can be revoked before redemption. The database stores SHA-256 digests of invitation tokens. An organizer can see group names, member display names, outfit choices and fit progress. Body measurements, extra dimensions and fit preferences are visible only to the member who supplied them.

The preview supports one saved outfit per signed-in member in each family group and one personal saved outfit per product. A selection references the exact private fit revision used when it was saved. Updating a profile creates a new revision while existing selections keep their original one. Deleting a fit profile removes its revisions and makes dependent selection progress pending. Future orders can use a separate, explicitly authorized immutable snapshot with appropriate retention rules.

Catalog photography, fabrics and outfit choices are illustrative. Real inventory, pricing, checkout, payment, orders and fulfillment are future phases. Apply both Prisma migrations before enabling the updated account and family routes. The database-backed Playwright run also checks group authorization, revoked and used links, and reuse of one fit profile across products.

### Demonstration photography

Built-in ImageGen created the four illustrations in `public/collections`. Each was generated with the following prompt.

- `adult-kurta.webp` — Photorealistic bespoke South Asian wedding clothing product photograph for ContourStitch’s demo catalog. Vertical 4:5 framing, entire outfit visible on a headless linen tailor’s form, soft warm stone plaster background, a little walnut floor, natural soft light, authentic woven fabric texture and understated finishing. No people, text, watermark, props, or other outfits. Warm cream, soft sand and copper, timeless high-end tailoring editorial. An adult long ivory textured kurta with modest aged-copper embroidered mandarin neckline, long sleeves and matching straight trousers.
- `adult-lehenga.webp` — Photorealistic bespoke South Asian wedding clothing product photograph for ContourStitch’s demo catalog. Vertical 4:5 framing, entire outfit visible on a headless linen tailor’s form, soft warm stone plaster background, a little walnut floor, natural soft light, authentic woven fabric texture and understated finishing. No people, text, watermark, props, or other outfits. Warm cream, soft sand and copper, timeless high-end tailoring editorial. An adult burnished copper lehenga with a floor-length skirt, half-sleeve matching blouse and a cream dupatta draped naturally on the form.
- `child-kurta.webp` — Photorealistic bespoke South Asian wedding clothing product photograph for ContourStitch’s demo catalog. Vertical 4:5 framing, entire outfit visible on a headless linen tailor’s form, soft warm stone plaster background, a little walnut floor, natural soft light, authentic woven fabric texture and understated finishing. No people, text, watermark, props, or other outfits. Warm cream, soft sand and copper, timeless high-end tailoring editorial. A child-size ivory kurta with copper piping around a narrow band collar and ivory trousers, on a small child-size garment display form.
- `child-dress.webp` — Photorealistic bespoke South Asian wedding clothing product photograph for ContourStitch’s demo catalog. Vertical 4:5 framing, entire outfit visible on a headless linen tailor’s form, soft warm stone plaster background, a little walnut floor, natural soft light, authentic woven fabric texture and understated finishing. No people, text, watermark, props, or other outfits. Warm cream, soft sand and copper, timeless high-end tailoring editorial. A child-size copper occasion dress, subtle woven fabric, gathered tea-length skirt, cap sleeves and warm ivory sash, on a small garment display form.
