# jayobee-app

Capacitor-ready Vite + React + TypeScript front end for the jayobee preference game.

It consumes two sibling artifacts directly (via Vite aliases, no build step needed):

- `@engine` → `../engine/src` — the pure preference engine.
- `@data` → `../data/taste_vectors.json` — the ETL artifact (bundled, offline).

## Develop

```bash
npm install
npm run dev        # web app at http://localhost:5173
npm run typecheck
npm run build      # -> dist/  (Capacitor webDir)
```

## Native (later)

Capacitor is configured (`capacitor.config.ts`, appId `com.jayobee.app`). Adding
native platforms needs the platform SDKs (Xcode / Android Studio):

```bash
npx cap add ios
npx cap add android
npm run build && npx cap sync
```

The game runs entirely on-device: the artifact is bundled and the learned
preference vector is persisted to `localStorage`. Nothing is sent to a server.
