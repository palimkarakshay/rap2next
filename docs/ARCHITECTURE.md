# rap2next — Architecture

_2026-08-24 v0.1. Publish SAP RAP services to the modern web._

## The idea

ABAP/RAP consultants already produce everything a UI needs: CDS entities, behavior
definitions, **UI annotations** (`@UI.lineItem`, `@UI.selectionField`, `@UI.facet`, …)
and an OData V4 service binding. Fiori Elements renders that metadata — but only as a
UI5 app with the Fiori look, aimed at enterprise-internal users.

**rap2next is a metadata-driven Next.js renderer for the same services**: point it at a
RAP OData V4 URL and it renders List Report and Object Page floorplans as a modern,
brandable, SSR/SEO-capable web app — for customers, suppliers, and the public web.
The backend stays 100% native SAP (clean core, zero Z-frontend artifacts); the ABAP
consultant's annotations ARE the app definition.

```
RAP (CDS + behavior + @UI annotations + OData V4 binding)   ← consultant writes ONLY this
        │  $metadata + JSON data
        ▼
Next.js proxy route (server-side auth, credentials never in browser)
        ▼
@sap-ux/edmx-parser + annotation-converter (SAP's own OSS)
        ▼
Neutral ServiceModel (this repo's contract, framework-agnostic)
        ▼
Floorplans: List Report → Object Page (Tailwind, CSS-var theming, light/dark)
```

## Decisions

1. **Metadata layer = SAP's own OSS** (`@sap-ux/edmx-parser`, `@sap-ux/annotation-converter`,
   `@sap-ux/vocabularies-types`, Apache-2.0) — the exact libraries behind Fiori tooling.
   We never string-match annotation aliases (`SAP__UI…`); the converter resolves them to
   full vocabulary terms.
2. **Neutral normalized model.** The UI consumes `ServiceModel` (below), not sap-ux types —
   so the metadata layer can be extracted to a `rap-metadata` package and reused by future
   siblings (rap2angular etc.).
3. **OData V4 first** (RAP's strategic binding); V2 adapter later (edmx-parser already reads V2).
4. **Server-side everything**: metadata fetch, data fetch, and auth live in Next.js route
   handlers / RSC. `SAP_USER`/`SAP_PASSWORD` (or `SAP_BEARER`) stay server-only.
5. **Mock-first development**: a bundled RAP-Travel-style fixture (`web/fixtures/travel/`)
   serves `$metadata` + data through the same proxy path, so the full pipeline runs with
   zero SAP system (`MOCK=1` or no `SAP_BASE_URL`). The fixture mirrors real RAP output
   (SAP__ aliases, `_Booking` navigation, Edm.Decimal-as-string).
6. **Not the Fiori look.** Clean modern design (Tailwind v4, CSS-variable theming, dark
   mode). Fiori Elements' *brain*, contemporary *skin*, brandable per customer.

## Normalized model (the contract)

```ts
interface ServiceModel { serviceUrl: string; entities: EntityModel[] }

interface EntityModel {
  set: string;                    // EntitySet name, e.g. "Travel"
  typeName: string;               // EntityType name
  keys: string[];
  properties: PropertyModel[];    // all structural properties
  columns: ColumnModel[];         // UI.LineItem → list columns (fallback: first 6 props)
  selectionFields: string[];      // UI.SelectionFields → filter bar
  headerInfo?: { typeName: string; typeNamePlural: string;
                 titlePath?: string; descriptionPath?: string };
  facets: FacetModel[];           // resolved object-page sections
  navsToMany: { name: string; targetSet?: string }[];
}

interface PropertyModel { name: string; label: string; type: string;
                          nullable: boolean; maxLength?: number }
interface ColumnModel   { path: string; label: string; type: string }

type FacetModel =
  | { kind: 'group'; label: string; fields: ColumnModel[] }   // ReferenceFacet → FieldGroup
  | { kind: 'table'; label: string; nav: string; columns: ColumnModel[] }; // nav/@UI.LineItem
```

Labels resolve `Common.Label` → sap:label → property name. Entities without a
`UI.LineItem` annotation are not published on the home page (annotation = publication
intent), but still render with property-fallback columns if addressed directly.

## v0.1 scope (read-only)

- Home: published entity sets as cards (`headerInfo.typeNamePlural`).
- List Report `/e/[set]`: filter bar from selectionFields ($filter eq/contains),
  server-side paging ($top/$skip/$count), $orderby column sort, row → Object Page.
- Object Page `/e/[set]/[key]`: HeaderInfo title/description, facet sections,
  to-many nav tables ($expand).
- Proxy: `app/api/odata/[...path]` — mock or live forward (basic/bearer, sap-client).

## Roadmap

- **v0.2 — transactional**: draft create/edit/activate (RAP draft protocol), PATCH,
  `DataFieldForAction` buttons, `Common.ValueList` value helps, CSRF handling.
- **v0.3 — publish-grade**: OAuth2 (BTP/XSUAA + on-prem), role-based visibility,
  codegen "eject" (generate typed pages for per-customer customization), OData V2.
- **Later**: extract `rap-metadata` npm package; rap2angular sibling; catalog page from
  IWFND/service catalog; live demo against a public RAP system.

## ⚠ Licensing reality check (tell every customer)

Exposing S/4HANA data to external users can trigger **SAP Digital Access / indirect-use
licensing** — write-back is the biggest trigger. A licensing assessment belongs in every
external-facing rollout plan. (Same finding as the sap-app-kit hardening review, 2026-06-29.)

## Adjacent work (and why this is different)

| Project | What it is | Difference |
|---|---|---|
| SAP Fiori Elements | annotation-driven UI5 renderer | UI5/Fiori look, enterprise-internal focus |
| UDINA BTP toolkit | annotation-driven React/shadcn blocks | CAP-first, part of a commercial platform |
| s4kit | type-safe TS SDK/proxy for S/4 OData | data access, no UI rendering |
| SAP open-ux-odata | EDMX parser + annotation converter | our foundation, not an app |
| abap2angular / abap2nextjs (sisters) | write UI in ABAP (view DSL) | freestyle track; rap2next is RAP-native |
