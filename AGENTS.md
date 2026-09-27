# ContourStitch — Codex Build Instructions

## Mission

Build a production-quality, mobile-first web MVP that estimates tailoring measurements from two guided photographs: one front view and one side view. The user supplies their height as the physical scale anchor. The app returns estimated body measurements with uncertainty, lets the user correct them, and explains that these are estimates requiring validation before garment production.

The MVP must optimize for reliable capture, privacy, testability, and honest uncertainty. Do not claim perfect accuracy, a full 3D scan, or production-ready made-to-measure precision.

## Product scope

Implement this journey:

1. Landing page with a concise value proposition and “Start measurement” action.
2. Privacy/consent screen explaining camera use and image retention.
3. Height entry with centimetre/feet-inch conversion.
4. Camera-permission flow with helpful denied/unsupported states.
5. Guided front capture.
6. Guided side capture.
7. Processing state.
8. Results showing estimated measurements and confidence/uncertainty.
9. Manual correction of every measurement.
10. Optional local profile save and deletion.

Estimate these fields in the first version:

- height
- shoulder breadth
- chest circumference
- waist circumference
- hip circumference
- sleeve length
- inseam
- outseam

## Required stack

- Next.js with App Router
- React and TypeScript in strict mode
- Tailwind CSS
- MediaPipe Tasks Vision in the browser for pose landmarks and person segmentation
- Vitest and React Testing Library for unit/component tests
- Playwright for the main end-to-end flow
- ESLint and Prettier

Keep the first deployment as a single Next.js application. Put measurement logic behind typed interfaces so it can later be moved to a Python/FastAPI service without rewriting the UI. Do not add a database, authentication, payments, or a separate backend unless explicitly requested.

## Architecture

Use a structure close to:

```text
app/
  page.tsx
  measure/page.tsx
  results/page.tsx
components/
  camera/
    CameraView.tsx
    BodyGuide.tsx
    PoseOverlay.tsx
    CaptureChecklist.tsx
  measurement/
    HeightForm.tsx
    MeasurementResult.tsx
    MeasurementEditor.tsx
lib/
  camera/
  vision/
    pose.ts
    segmentation.ts
    quality.ts
  measurement/
    types.ts
    scale.ts
    landmarks.ts
    circumference.ts
    estimate.ts
    uncertainty.ts
  privacy/
  storage/
tests/
e2e/
public/models/
```

Separate camera capture, vision inference, geometric estimation, uncertainty, and UI. All measurement functions must be pure where practical and independently testable.

## Capture requirements

- Use `navigator.mediaDevices.getUserMedia()`.
- Prefer the rear camera when another person is assisting; provide an obvious camera-switch control.
- Never assume camera access is available.
- Show a full-body outline, level indicator, progress, and live checklist.
- Require the head and both feet to be visible.
- For the front pose, require the shoulders to be approximately level, the torso to face the camera, feet separated slightly, and arms roughly 15–25 degrees away from the torso.
- For the side pose, require a near-profile orientation, neutral posture, and arms positioned so they do not obscure the torso.
- Prevent capture until minimum quality checks pass, but provide an accessible override labelled as potentially reducing accuracy.
- Detect blur, insufficient lighting, missing landmarks, body cropping, excessive tilt, and poor framing where feasible.
- Correctly handle device rotation and mirrored previews. Measurement calculations must use unmirrored source coordinates.

## Measurement method

Version 1 uses explainable geometry rather than pretending to reconstruct a perfect body mesh.

1. Detect pose landmarks and the person mask in each image.
2. Estimate pixel-to-centimetre scale from entered height and segmented head-to-foot height.
3. Locate chest, waist, and hip sampling levels relative to shoulder/hip landmarks.
4. Measure front silhouette width and side silhouette depth at each level. Use robust local sampling across several neighboring rows rather than one row.
5. Approximate each torso cross-section as an ellipse. For semi-axes `a = width / 2` and `b = depth / 2`, use Ramanujan’s approximation:

   `C = π × (3(a+b) − sqrt((3a+b)(a+3b)))`

6. Estimate sleeve length along shoulder → elbow → wrist.
7. Estimate leg/outseam along hip → knee → ankle.
8. Treat inseam as lower confidence unless the crotch landmark/segmentation geometry is sufficiently constrained.
9. Keep anatomical body measurements distinct from garment measurements and ease. Do not calculate manufacturing patterns in this MVP.

Put all heuristic constants in one documented configuration module. Include citations/links in code comments for any externally derived measurement convention.

## Confidence and uncertainty

Every result must include:

```ts
type MeasurementEstimate = {
  key: MeasurementKey;
  valueCm: number;
  uncertaintyCm: number;
  confidence: "high" | "medium" | "low";
  method: string;
  warnings: string[];
};
```

Uncertainty must worsen when input quality worsens, including pose misalignment, segmentation instability, low landmark confidence, inconsistent scaling between views, or manual capture override. Do not show false precision: display whole centimetres or sensible half-inch increments with an uncertainty range.

If confidence is low, tell the user which measurement should be confirmed with a tape. Never silently fabricate a result when a required landmark or silhouette is missing.

## Privacy and security

- Default to browser-side inference and processing.
- Do not upload images in the initial MVP.
- Do not persist raw photos by default.
- Keep temporary image data in memory and release camera tracks when leaving capture.
- If the user saves a profile, store only derived measurements and preferences locally unless a later task explicitly adds accounts/cloud storage.
- Provide “Delete my measurements.”
- Include concise consent, privacy, and limitation copy.
- Never log images, image data URLs, biometric geometry, or detailed body measurements to analytics or console output.
- Add a Content Security Policy compatible with MediaPipe model loading, and pin dependencies.

## Design requirements

The visual direction should feel premium, calm, and trustworthy rather than clinical. Use generous spacing, high contrast, large touch targets, and one primary action per screen. Ensure the complete flow works at 360 px width and on desktop.

Accessibility requirements:

- WCAG 2.2 AA color contrast
- keyboard-operable controls
- visible focus states
- meaningful labels and status announcements
- reduced-motion support
- instructions that do not rely on color alone
- a non-camera fallback explaining how to enter tape measurements manually

Do not use placeholder lorem ipsum. Use concise real copy throughout.

## Implementation phases

Complete and verify each phase before advancing:

### Phase 1: Foundation and interface

- Scaffold the app and quality tooling.
- Build landing, consent, height, front capture, side capture, processing, and results states.
- Implement the flow first with deterministic mock estimates.
- Make the experience responsive and accessible.

### Phase 2: Camera and capture validation

- Add permission handling, preview, camera switching, capture, retry, and cleanup.
- Add MediaPipe pose overlays and live quality feedback.
- Add segmentation and framing validation.

### Phase 3: Measurement engine

- Implement scaling, landmark-derived sampling levels, silhouette widths/depths, ellipse circumference, limb measurements, warnings, and uncertainty.
- Overlay detected measurement locations on review images for debugging, behind a development-only flag.

### Phase 4: Results and local persistence

- Display metric/imperial values, uncertainties, warnings, and manual corrections.
- Save/delete derived measurements locally only after explicit user action.

### Phase 5: Verification and deployment

- Complete automated tests.
- Test camera flow on current Safari/iOS and Chrome/Android where available.
- Run production build locally.
- Add deployment configuration and concise setup documentation.
- Deploy only after all required checks pass.

## Testing requirements

Add unit tests for:

- height/unit conversion
- pixel scale calculation
- ellipse circumference against known values
- robust silhouette width sampling
- landmark path lengths
- uncertainty escalation
- missing/low-confidence data behavior

Add component tests for height validation, permission failure, capture gating, result editing, unit switching, and deletion.

Add a Playwright happy path that uses mocked camera/vision results so CI does not require a physical camera. Also test camera denial and low-confidence results.

Before declaring completion, run and report:

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```

Fix failures rather than bypassing checks. Do not weaken TypeScript or lint rules to make the build pass.

## Validation dataset support

Include a development-only validation page or script that can ingest de-identified records containing predicted measurements and reference tape measurements. It should compute bias, MAE, RMSE, and percentile absolute error per measurement. Do not bundle participant photos or personal data.

Use this schema:

```ts
type ValidationRecord = {
  anonymousId: string;
  predictedCm: Partial<Record<MeasurementKey, number>>;
  referenceCm: Partial<Record<MeasurementKey, number>>;
};
```

Do not market the system as tailoring-ready until representative testing establishes acceptable error for each garment and measurement.

## Deployment

The app must be deployable on a standard Next.js host with HTTPS because browser camera access requires a secure context. Document:

- prerequisites
- install and local-development commands
- test commands
- production build command
- environment variables, if any
- model asset hosting/CSP requirements
- deployment steps
- supported browsers and known limitations

Do not commit secrets. Provide `.env.example` only if environment variables are introduced.

## Definition of done

The project is complete only when:

- A mobile user can finish the full front/side capture flow.
- Permission denial, unsupported browser, and invalid pose states are handled cleanly.
- Real pose/segmentation output feeds the typed measurement engine.
- Results include uncertainty and can be manually corrected.
- Raw photos are not uploaded or retained by default.
- Automated tests and production build pass.
- README documents local use, limitations, validation, and deployment.
- No UI copy claims guaranteed fit or validated accuracy.

## Codex working rules

- Inspect existing files before editing and preserve unrelated user changes.
- Maintain a short implementation plan and update it as phases complete.
- Prefer small, reviewable changes.
- Use existing well-maintained packages before inventing infrastructure.
- Do not add scope beyond this document without stating the tradeoff.
- When blocked by a product decision, choose the privacy-preserving and simplest reversible option, document the assumption, and continue.
- After each major phase, run the relevant checks and summarize what changed.
- At completion, provide the deployed URL if deployment was requested, plus a short list of known accuracy limitations and the next validation step.
