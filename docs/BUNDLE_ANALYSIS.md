# Bundle analysis

## How to run

```bash
npm run analyze
```

This sets `ANALYZE=true` and runs `next build`. The project uses `@next/bundle-analyzer` in [`next.config.ts`](../next.config.ts). When the webpack-based analyzer output is emitted, open the generated client report (path varies by Next version; check the build log).

**Note:** Next.js 16 may build with Turbopack; analyzer output is most reliable when the build uses the webpack path. If no HTML report appears, use **Chrome DevTools → Network** on a production build (`npm run build && npm start`) to inspect loaded JS for large assets.

## Already applied

- `experimental.optimizePackageImports` for `lucide-react` and `date-fns` in `next.config.ts`.
- `serverExternalPackages` for `pdf-parse` and `mammoth` (server-only parsing).
- **Client-only graphs:** [`ExecutionGraphVizDynamic`](../src/components/v4/execution-graph-viz-dynamic.tsx) and [`HealthGraphConcentrationDynamic`](../src/components/assurance/health-graph-concentration-dynamic.tsx) use `next/dynamic` with `ssr: false` inside `"use client"` modules so Server Components stay valid and heavy SVG UI loads on demand.
- Document parsing uses **dynamic `import()`** inside server code ([`parse-document.ts`](../src/lib/extraction/parse-document.ts)) so PDF and DOCX parsers are not both loaded per request.

## Next checks (when tuning further)

1. Re-run `npm run analyze` after major dependency upgrades.
2. Prefer leaf **client** wrappers for any future `ssr: false` widgets (same pattern as [`command-palette-loader.tsx`](../src/components/layout/command-palette-loader.tsx)).
