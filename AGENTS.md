# AGENTS.md — rap2next

Publish SAP RAP services to the modern web: a metadata-driven Next.js renderer for
RAP OData V4 + @UI annotations (Fiori Elements' brain, modern skin).
Public OSS (MIT) under github.com/palimkarakshay. Read docs/ARCHITECTURE.md first.

## Layout
- `docs/ARCHITECTURE.md` — vision, decisions, the normalized ServiceModel CONTRACT,
  roadmap, SAP licensing warning. The contract governs; UI never imports sap-ux types.
- `web/` — the Next.js app (App Router, Tailwind v4).
  - `web/lib/` — metadata layer (@sap-ux/edmx-parser + annotation-converter → ServiceModel).
  - `web/app/api/odata/[...path]/` — proxy (mock fixture or live SAP forward; auth server-only).
  - `web/fixtures/travel/` — RAP-Travel-style $metadata + data; doubles as the parser spec.

## Invariants
- Backend stays 100% native SAP: no Z-artifacts required on the ABAP side, ever.
- Annotation semantics follow the OData vocabularies (full terms, alias-resolved) —
  never string-match `SAP__UI…` aliases.
- Everything must work in mock mode (`MOCK=1`, no SAP system) end to end.
- SAP credentials live server-side only (env), never in client bundles.
- Tailwind v4: CSS vars in arbitrary values use `(--var)` syntax, not `[--var]`.

## Verify before commit
- `cd web && npm run build` → must pass.
- Mock smoke: `npm start` + curl `/`, `/e/Travel`, one object page → 200 + rendered rows.

## State
v0.1 read-only floorplans (List Report, Object Page) against mock; live-RAP proof and
draft/edit are roadmap (ARCHITECTURE.md). Not yet tested against a real RAP system.
