# App icon & splash — source art

Drop your source image(s) **here**, then run:

```bash
npm run assets      # generates every icon/splash size into android/ (and ios/ once added)
npx cap sync        # copies them into the native projects
```

The generated icons live inside `android/`/`ios/` (gitignored, regenerable).
**These source files are the tracked source of truth** — they ARE committed.

## Simplest — one file does everything

- **`logo.png`** — **1024×1024**, PNG, square. Generates all icons plus a splash.
  Keep the important artwork within the **center ~80%**: Android masks icons into
  circles/squircles/rounded-squares and crops the corners.

## Finer control (optional — these override `logo.png`)

**Icons — 1024×1024 each:**
| File | Used for |
|---|---|
| `icon-only.png` | iOS + legacy Android icon (the full square icon) |
| `icon-foreground.png` | Android adaptive-icon foreground — keep art in the center **~66%** (outer ring gets cropped by the mask) |
| `icon-background.png` | Android adaptive-icon background (a solid color or simple pattern) |

**Splash — 2732×2732 each (content centered in the middle ~1200×1200):**
| File | Used for |
|---|---|
| `splash.png` | light mode |
| `splash-dark.png` | dark mode |

## Notes

- **iOS icons cannot be transparent** — Apple requires an opaque icon. Either give
  `logo.png`/`icon-only.png` an opaque background, or supply `icon-background.png`.
- Re-run `npm run assets` any time you change the art.
- Recommended format: PNG (or SVG for `logo` if you have vector art — it'll rasterize crisply).
