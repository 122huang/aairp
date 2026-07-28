# Image compliance benchmark fixtures (Sprint 6A)

Synthetic and stub-backed fixtures for `image-compliance-v1` vision benchmark.

## Files

- `cn-panel-unreplaced-pos.jpg` / `cn-panel-unreplaced-neg.jpg` — localisation panel scenarios
- `competitor-logo-pos.jpg` / `competitor-logo-neg.jpg`
- `ai-no-disclaimer-pos.jpg` / `ai-no-disclaimer-neg.jpg`
- `food-safety-raw-meat-pos.jpg` / `food-safety-raw-meat-neg.jpg`
- `cn-pdp-pressure-cooker-pos.jpg` / `cn-pdp-pressure-cooker-neg.jpg` — 750×15000 long PDP (generated via `scripts/generate-long-pdp-fixture.mjs`)

Slice-level vision stubs live under `stubs/`. Long-image pressure-cooker POS uses per-slice stubs (`slice2` localisation + 112kPa, `slice5` 80kPa).

Manifest: `benchmark/image-compliance-v1.json`

## Raw originals

Drop high-resolution PDP originals under `raw/` for future gold fixtures. See `raw/README.md`.
