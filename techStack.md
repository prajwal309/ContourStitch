# ContourStitch tech stack

## Application

- **Framework:** Next.js 16.3.5 using the App Router
- **UI:** React 19.3.0 and React DOM 19.3.0
- **Language:** TypeScript 6.0.3 in strict mode
- **Styling:** Tailwind CSS 4.3.3 with the Tailwind PostCSS plugin
- **Icons:** `lucide-react` 1.47.0
- **Module format:** ECMAScript modules (`"type": "module"`)

## Browser vision and measurement

- **Pose and segmentation:** MediaPipe Tasks Vision 1.0.1 running in the browser
- **Model assets:** A local MediaPipe pose landmarker model and WASM runtime files in `public/models/`
- **Camera access:** Browser `navigator.mediaDevices.getUserMedia()` APIs
- **Measurement engine:** Typed, pure TypeScript modules for unit conversion, scaling, landmark geometry, silhouette sampling, circumference estimation, and uncertainty scoring
- **Persistence:** Browser local storage for explicitly saved derived profiles; raw photos are not persisted by default

## Project structure

- `app/` — Next.js routes and global styles
- `components/` — camera, capture guidance, measurement forms, results, and session UI
- `lib/camera/` — camera permissions and media handling
- `lib/vision/` — pose, segmentation, and capture-quality checks
- `lib/measurement/` — geometric estimation and uncertainty logic
- `lib/storage/` — local profile persistence
- `public/models/` — MediaPipe model and WASM assets

## Testing and quality

- **Unit and component tests:** Vitest 4.1.11 with React Testing Library 16.3.3, `user-event`, `jest-dom`, and JSDOM
- **End-to-end tests:** Playwright 1.63.0
- **Linting:** ESLint 9.39.5 with `eslint-config-next`
- **Formatting:** Prettier 3.9.8
- **Type checking:** TypeScript compiler (`tsc --noEmit`)

## Runtime and deployment

- **Required runtime:** Node.js 22 or newer
- **Package manager:** npm, using the committed `package-lock.json`
- **Deployment shape:** A single Next.js application; no database, authentication service, payments, or separate backend is currently used
- **Camera requirement:** Production camera access requires HTTPS (or localhost during development)

## Available scripts

```bash
npm run dev       # Start the development server
npm run build     # Create a production build
npm run start     # Serve the production build
npm run lint      # Run ESLint
npm run typecheck # Run TypeScript checks
npm test          # Run unit and component tests
npm run test:e2e  # Run Playwright tests
npm run format    # Format the repository with Prettier
```
