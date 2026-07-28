# Raw PDP originals (placeholder)

Drop high-resolution PDP / listing image originals here when building gold-standard benchmark fixtures.

These files are **not** consumed directly by CI stub tests. After adding an original:

1. Redact sensitive branding if needed.
2. Annotate expected slice boundaries and cross-slice field values.
3. Regenerate synthetic companions or slice stubs under `../stubs/` as needed.

The long-image pressure-cooker scaffold (`cn-pdp-pressure-cooker-pos.jpg`) is generated synthetically via `scripts/generate-long-pdp-fixture.mjs` until real originals are available.
