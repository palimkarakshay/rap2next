# rap2next

**Publish your SAP RAP services to the modern web.**

You already wrote the app — in ABAP. Your CDS entities, behavior definitions, and
`@UI` annotations fully describe a UI; Fiori Elements proves it every day. But Fiori
Elements gives you a UI5 app with the Fiori look, built for enterprise-internal users.

**rap2next is the other renderer for the same metadata**: point it at a RAP OData V4
service URL and get a modern, brandable, SSR/SEO-capable Next.js app — List Report and
Object Page floorplans included — fit for customers, partners, and the public web.

```
@UI.lineItem, @UI.selectionField, @UI.facet, @UI.headerInfo   ← you already write these
                          │
                          ▼
        rap2next  ─────  $metadata-driven rendering
                          │
                          ▼
   a modern branded web app (Next.js, Tailwind, dark mode, SSR)
```

- **Zero frontend artifacts in SAP.** Clean core stays clean: no Z-UI objects, no BSP,
  no deployment to the ABAP stack. The annotations ARE the app definition.
- **Built on SAP's own OSS** — `@sap-ux/edmx-parser` + `@sap-ux/annotation-converter`
  (the libraries behind Fiori tooling) parse the metadata; rap2next renders it.
- **Not the Fiori look.** CSS-variable theming, modern typography, light/dark — brand it
  per customer in minutes.
- **Try it with no SAP system**: mock mode ships a RAP-Travel-style service.

## Quickstart

```sh
cd web && npm install
npm run dev            # mock mode: RAP-Travel demo at http://localhost:3000
```

Point it at a real RAP service:

```sh
SAP_BASE_URL=https://<host>/sap/opu/odata4/sap/zui_travel_o4/srvd/sap/zui_travel/0001 \
SAP_USER=... SAP_PASSWORD=... npm run dev
```

Credentials stay server-side (Next.js route handlers); the browser never sees SAP.

## Status & roadmap

**v0.1 — read-only floorplans** (List Report, Object Page), verified against the bundled
mock; live-RAP verification is the next milestone. Then: draft create/edit (RAP draft
protocol), actions, value helps, OAuth2, OData V2, and a codegen "eject" mode.
Details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

> ⚠ **Licensing**: exposing S/4HANA data to external users can trigger SAP Digital
> Access / indirect-use licensing. Run a licensing assessment before any external-facing
> production rollout.

## Sister projects

[abap2angular](https://github.com/palimkarakshay/abap2angular) and
[abap2nextjs](https://github.com/palimkarakshay/abap2nextjs) — the *freestyle* track
(write UIs in ABAP via a view DSL, abap2UI5-style) for screens beyond what RAP models.
rap2next is the RAP-native track. MIT licensed.
