# Example: Product Catalog — a full RAP test project for rap2next

A complete, copy-paste-ready **RAP managed business object** built only on
**C1-released SAP objects**, exposed as an OData V4 UI service, and consumed by
rap2next as a public product catalog. This is the canonical stack every RAP
consultant writes daily — tables → interface views → behavior → projections →
metadata extensions → service definition/binding — with **zero frontend artifacts**.

**Released APIs this example deliberately uses:** `I_Currency`, `I_Country`,
`I_UnitOfMeasure` (association targets + a validating read), `sysuuid_x16`,
`abap_boolean`, `cl_system_uuid`, `cl_abap_context_info`, `utclong_current( )`,
`if_oo_adt_classrun`. Runs on **BTP ABAP Environment (incl. trial)** and
**S/4HANA 2022+ / S/4HANA Cloud** unchanged.

## What this tests in rap2next (by design)

| rap2next path | Exercised by |
|---|---|
| `Edm.Guid` key predicates | `ProductUUID` / `TierUUID` keys (`Product(guid'...')`) |
| `Edm.Boolean` rendering + filter | `InStock` |
| `Edm.Decimal`-as-string | `ListPrice`, `TierPrice`, `MinQty` |
| `Edm.Date` / `Edm.DateTimeOffset` | `ValidFrom` / `CreatedAt`, `ChangedAt` |
| List Report columns | `@UI.lineItem` (5 columns) |
| Filter bar | `@UI.selectionField` (Name, Category, Country) |
| Object Page header | `@UI.headerInfo` (title=ProductName, desc=Description) |
| Field-group facets | `#FIELDGROUP_REFERENCE` × 3 (General/Logistics/Pricing) |
| Embedded child table | `#LINEITEM_REFERENCE` on `_PriceTier` |
| Labels | `@EndUserText.label` → `Common.Label` |
| Publication intent | only annotated sets get home cards |

## Part 1 — Create the ABAP objects (ADT, ~20 minutes)

> ⚠ On a **shared trial system**: work only in your own Z-package, never touch
> foreign objects. Demo-data reset deletes only this example's own tables.

1. Create package `ZR2N_DEMO` (superpackage as usual on your system, e.g. `ZLOCAL`).
2. Create the objects **in file order** from `src/`, copy-pasting each source:
   - `01`/`02` — database tables `ZR2N_APROD`, `ZR2N_APRICE`. Activate.
   - `03`/`04` — data definitions `ZR2N_I_PRODUCT`, `ZR2N_I_PRICETIER`.
     They reference each other (composition ↔ parent): create both, then
     **activate both together** (Ctrl+Shift+F3 multi-select).
   - `05` — behavior definition on `ZR2N_I_PRODUCT` (managed, strict(2), UUID
     numbering). Activate.
   - `06`/`07` — behavior implementation class `ZBP_R2N_I_PRODUCT` (global class +
     *Local Types* tab gets `07-…locals_imp`). The empty instance-authorization
     handler = unrestricted; **demo only** — write real checks before production.
   - `08`/`09` — projection views (note `@Metadata.allowExtensions: true` — without
     it the metadata extensions won't activate). Activate together.
   - `10` — projection behavior definition. Activate.
   - `11`/`12` — **metadata extensions** — this is everything rap2next renders.
     Activate.
   - `13` — service definition `ZR2N_UI_PRODUCT`. Activate.
3. **Service binding** (wizard, no source file): right-click `ZR2N_UI_PRODUCT` →
   New Service Binding → name `ZR2N_UI_PRODUCT_O4`, binding type
   **OData V4 – UI**. Activate, then press **Publish**.
   Sanity check: the binding's *Preview…* button must show a working Fiori
   Elements list — if Fiori Elements renders it, rap2next has everything it needs.
4. Load demo data: open `ZR2N_CL_DEMO_DATA` (file `14`), run with **F9**.
   Expected console output: `I_Currency check: 4/4` and
   `Inserted 12 products and 36 price tiers.`

## Part 2 — Reach the service from outside SAP

rap2next calls the service **server-side** (Next.js proxy), so there is **no CORS
setup** on the SAP side — you only need an authenticated URL.

**BTP ABAP Environment (incl. trial):** browser-SAML doesn't work for technical
clients, so create an inbound communication user:
1. ADT: New → *Communication Scenario* `ZR2N_CS` → Inbound tab → add service
   `ZR2N_UI_PRODUCT_O4` (Basic auth supported) → **Publish Locally**.
2. Fiori launchpad (admin): *Communication Systems* → new system (dummy host is
   fine for inbound-only) with a *Communication User* + password;
   *Communication Arrangements* → new arrangement for `ZR2N_CS` with that system.
3. Your base URL is on the service binding, pattern:
   `https://<host>/sap/opu/odata4/sap/zr2n_ui_product_o4/srvd/sap/zr2n_ui_product/0001`
   (copy the exact *Service URL* from the binding editor).
4. Verify from any terminal:
   `curl -u COMM_USER:PASS "<base-url>/Product?$top=2&$count=true"` → JSON with 2 products.

**On-premise S/4HANA (2022+):** publish the binding; the ICF node is active
automatically. Use a dialog/service user with basic auth and add
`SAP_CLIENT=<mandant>` below.

## Part 3 — Point rap2next at it

```sh
cd web && npm install
SAP_BASE_URL="<base-url-from-the-binding>" \
SAP_USER="COMM_USER" SAP_PASSWORD="..." \
# SAP_CLIENT=100   # on-premise only
npm run dev
```

Open http://localhost:3000.

## Part 4 — Verification checklist (the actual test script)

| # | Check | Pass looks like |
|---|---|---|
| 1 | Home page | One card: **Products** (from `typeNamePlural`). PriceTier gets no card of its own on Home only if you remove its `@UI.lineItem`s — as shipped, both appear; the child is still reachable via the object page either way |
| 2 | `/e/Product` list | Columns exactly: Product ID, Product, Category, List Price, In Stock — in `position` order |
| 3 | Filter bar | Product, Category, Country of Origin inputs; `Category=Safety` → 3 rows |
| 4 | Quote safety | Filter Product = `O'Brien` → 200, "No results", no error |
| 5 | Pagination/count | "12" total; one page at $top=20 |
| 6 | Row → Object Page | URL contains `Product(guid'...')`-style predicate; page loads (**Edm.Guid key test**) |
| 7 | Object Page header | Title = product name, description under it, "Product" chip |
| 8 | Sections | General / Logistics / Pricing field groups with labeled values |
| 9 | Price Tiers section | Embedded table, 3 rows (1/10/50 min qty), prices descending |
| 10 | Types render | Dates as locale dates, decimals with 2 decimals, In Stock as boolean, no `[object Object]` anywhere |
| 11 | Live vs mock parity | Repeat 1–10 with `MOCK=1` (Travel fixture) — same behaviors, different data |

Anything failing in 1–10 against a live system but passing in mock is a
live-mode bug — please open an issue with the failing `$metadata` snippet.

## Troubleshooting

- **401/403** — communication arrangement not active, wrong user type (must be a
  communication user on BTP), or unpublished binding.
- **Home page empty** — metadata extensions not activated, or
  `@Metadata.allowExtensions` missing on the projection views.
- **Facet/section missing** — check `targetQualifier` matches the `fieldGroup`
  qualifier exactly; check `targetElement: '_PriceTier'` spelling.
- **Rows but wrong labels** — `@EndUserText.label` lives in the MDE; reactivate MDEs.
- Known v0.1 gaps (server-driven paging etc.): see [`docs/KNOWN-ISSUES.md`](../../docs/KNOWN-ISSUES.md).

## Cleanup

Run `DELETE FROM zr2n_aprice.` / `DELETE FROM zr2n_aprod.` (or just delete the
package contents). Nothing else on the system is touched.

> ⚠ Reminder: exposing S/4 data to external users can trigger **SAP Digital
> Access / indirect-use licensing** — assess before any production rollout.
