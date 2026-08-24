# rap2next (web)

Metadata-driven Next.js renderer for SAP RAP OData V4 services: point it at a `$metadata`
+ data endpoint and it renders List Report / Object Page floorplans from the service's
`@UI` annotations — see `../docs/ARCHITECTURE.md` for the full picture and the
normalized `ServiceModel` contract in `lib/model.ts`.

## Quickstart — mock mode (no SAP system needed)

```bash
npm install
npm run dev        # http://localhost:3000, serves web/fixtures/travel
```

Mock mode is the default: it's used whenever `SAP_BASE_URL` is unset, or always when
`MOCK=1`. `$metadata` comes from `fixtures/travel/metadata.xml`, data from
`fixtures/travel/data.json`.

## Quickstart — live RAP service

```bash
SAP_BASE_URL="https://myhost:44300/sap/opu/odata4/sap/zrap2next_travel/srvd/sap/zrap2next_travel/0001" \
SAP_USER=demo SAP_PASSWORD=secret \
npm run dev
```

## Environment variables

| Variable          | Purpose                                                        |
| ------------------ | --------------------------------------------------------------- |
| `SAP_BASE_URL`     | Base OData V4 service URL. Unset (or `MOCK=1`) => mock mode.    |
| `MOCK`             | Set to `1` to force mock mode even if `SAP_BASE_URL` is set.    |
| `SAP_USER`         | Basic-auth username (server-side only).                         |
| `SAP_PASSWORD`     | Basic-auth password (server-side only).                         |
| `SAP_BEARER`       | Bearer token, used instead of basic auth if set.                 |
| `SAP_CLIENT`       | Appended as `?sap-client=` to every request.                    |

Credentials never reach the client bundle — all fetching happens in RSC pages and the
`/api/odata/[...path]` proxy route, both server-side only.
