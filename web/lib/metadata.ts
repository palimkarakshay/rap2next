/**
 * Metadata layer: load $metadata (mock fixture or live SAP system), run it through
 * SAP's own OSS parser/converter (@sap-ux/edmx-parser + @sap-ux/annotation-converter),
 * and normalize the typed, alias-resolved result into the neutral ServiceModel contract
 * defined in ./model.ts.
 *
 * This module is the ONLY place in the app that imports @sap-ux/* types. Nothing here
 * ever string-matches an "SAP__" alias — all annotation access goes through the
 * converter's resolved `annotations.UI.*` / `annotations.Common.*` typed properties, or
 * (for AnnotationPath facet targets) the converter's own resolved `$target`, with a
 * defensive fallback to parsing the raw AnnotationPath string only if `$target` could
 * not be resolved.
 */
import fs from "node:fs";
import path from "node:path";
import { parse } from "@sap-ux/edmx-parser";
import { convert } from "@sap-ux/annotation-converter";
import type {
  ConvertedMetadata,
  EntitySet,
  EntityType,
  Property
} from "@sap-ux/vocabularies-types";
import type {
  ServiceModel,
  EntityModel,
  PropertyModel,
  ColumnModel,
  FacetModel
} from "./model";

export function isMockMode(): boolean {
  return process.env.MOCK === "1" || !process.env.SAP_BASE_URL;
}

export function getSapBaseUrl(): string {
  const base = process.env.SAP_BASE_URL;
  if (!base) {
    throw new Error("SAP_BASE_URL is not set (mock mode should be used instead)");
  }
  return base.replace(/\/$/, "");
}

/** Server-only. Never call from client components / never expose the result to the browser. */
export function getAuthHeaders(): Record<string, string> {
  if (process.env.SAP_BEARER) {
    return { Authorization: `Bearer ${process.env.SAP_BEARER}` };
  }
  if (process.env.SAP_USER && process.env.SAP_PASSWORD) {
    const token = Buffer.from(`${process.env.SAP_USER}:${process.env.SAP_PASSWORD}`).toString(
      "base64"
    );
    return { Authorization: `Basic ${token}` };
  }
  return {};
}

/** Appends sap-client (if configured) to an existing query string. */
export function withSapClient(params: URLSearchParams): URLSearchParams {
  if (process.env.SAP_CLIENT) {
    params.set("sap-client", process.env.SAP_CLIENT);
  }
  return params;
}

export function buildLiveUrl(resourcePath: string, queryString = ""): string {
  const url = new URL(`${getSapBaseUrl()}/${resourcePath}`);
  const params = withSapClient(new URLSearchParams(queryString));
  url.search = params.toString();
  return url.toString();
}

let cachedXml: string | undefined;

/** Raw $metadata XML — used by both the model normalizer and the /api/odata proxy. */
export async function getMetadataXml(): Promise<string> {
  if (cachedXml) return cachedXml;
  if (isMockMode()) {
    const p = path.join(process.cwd(), "fixtures/travel/metadata.xml");
    cachedXml = fs.readFileSync(p, "utf-8");
    return cachedXml;
  }
  const url = buildLiveUrl("$metadata");
  const res = await fetch(url, { headers: getAuthHeaders(), cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch $metadata: ${res.status} ${res.statusText}`);
  }
  cachedXml = await res.text();
  return cachedXml;
}

function str(value: unknown): string | undefined {
  return value === undefined || value === null ? undefined : String(value);
}

function labelOf(prop: Property): string {
  return str(prop.annotations?.Common?.Label) ?? prop.name;
}

function toPropertyModel(prop: Property): PropertyModel {
  return {
    name: prop.name,
    label: labelOf(prop),
    type: prop.type,
    nullable: prop.nullable ?? true,
    maxLength: prop.maxLength
  };
}

/** A DataField (or DataField-like) record's `Value` is a Path expression when it carries data. */
function dataFieldToColumn(dataField: unknown): ColumnModel | undefined {
  const value = (dataField as { Value?: unknown } | undefined)?.Value as
    | { type?: string; path?: string; $target?: Property }
    | undefined;
  if (!value || value.type !== "Path" || !value.path) return undefined;
  const target = value.$target;
  return {
    path: value.path,
    label: target ? labelOf(target) : value.path,
    type: target?.type ?? "Edm.String"
  };
}

function toHeaderInfo(entityType: EntityType): EntityModel["headerInfo"] {
  const hi = entityType.annotations?.UI?.HeaderInfo;
  if (!hi) return undefined;
  const titleValue = (hi.Title as { Value?: { type?: string; path?: string } } | undefined)?.Value;
  const descValue = (hi.Description as { Value?: { type?: string; path?: string } } | undefined)
    ?.Value;
  return {
    typeName: str(hi.TypeName) ?? entityType.name,
    typeNamePlural: str(hi.TypeNamePlural) ?? entityType.name,
    titlePath: titleValue?.type === "Path" ? titleValue.path : undefined,
    descriptionPath: descValue?.type === "Path" ? descValue.path : undefined
  };
}

/** Splits an AnnotationPath's raw string into an optional nav-property prefix + the term part. */
function splitAnnotationPath(raw: string): { nav?: string; termPart: string } {
  const atIdx = raw.indexOf("@");
  if (atIdx <= 0) return { termPart: raw.slice(atIdx + 1) };
  return { nav: raw.slice(0, atIdx).replace(/\/$/, ""), termPart: raw.slice(atIdx + 1) };
}

function resolveFacet(entityType: EntityType, facet: unknown): FacetModel | undefined {
  const f = facet as {
    Label?: unknown;
    Target?: { value?: string; $target?: unknown };
  };
  const target = f.Target;
  if (!target?.value) return undefined;
  const label = str(f.Label) ?? "";
  const { nav, termPart } = splitAnnotationPath(target.value);
  const resolved = target.$target as
    | ({ term?: string; Data?: unknown[]; Label?: unknown } & unknown[])
    | { term?: string; Data?: unknown[]; Label?: unknown }
    | undefined;

  if (resolved && resolved.term === "com.sap.vocabularies.UI.v1.LineItem") {
    const columns = (resolved as unknown[])
      .map(dataFieldToColumn)
      .filter((c): c is ColumnModel => !!c);
    return { kind: "table", label, nav: nav ?? "", columns };
  }

  if (resolved && resolved.term === "com.sap.vocabularies.UI.v1.FieldGroup") {
    const fields = (resolved.Data ?? [])
      .map(dataFieldToColumn)
      .filter((c): c is ColumnModel => !!c);
    return { kind: "group", label: label || str(resolved.Label) || "", fields };
  }

  // Defensive fallback: $target failed to resolve (e.g. a not-yet-supported term on a
  // live system) — parse the qualifier out of the raw AnnotationPath value ourselves.
  const qualifierMatch = /FieldGroup#([^/]+)$/.exec(termPart);
  if (qualifierMatch) {
    const qualifier = qualifierMatch[1];
    const fg = (entityType.annotations?.UI as Record<string, { Data?: unknown[]; Label?: unknown } | undefined>)?.[
      `FieldGroup#${qualifier}`
    ];
    if (fg) {
      const fields = (fg.Data ?? []).map(dataFieldToColumn).filter((c): c is ColumnModel => !!c);
      return { kind: "group", label: label || str(fg.Label) || qualifier, fields };
    }
  }
  return undefined;
}

function findTargetSetName(entitySet: EntitySet, navName: string): string | undefined {
  const target = entitySet.navigationPropertyBinding[navName];
  return target?.name;
}

function buildEntityModel(entitySet: EntitySet): EntityModel {
  const et = entitySet.entityType;
  const properties = et.entityProperties.map(toPropertyModel);

  const lineItem = et.annotations?.UI?.LineItem;
  const columns: ColumnModel[] =
    lineItem && lineItem.length > 0
      ? lineItem.map(dataFieldToColumn).filter((c): c is ColumnModel => !!c)
      : properties.slice(0, 6).map((p) => ({ path: p.name, label: p.label, type: p.type }));

  const selectionFields = (et.annotations?.UI?.SelectionFields ?? []).map(
    (pp) => pp.value
  );

  const headerInfo = toHeaderInfo(et);

  const facets = (et.annotations?.UI?.Facets ?? [])
    .map((f) => resolveFacet(et, f))
    .filter((f): f is FacetModel => !!f);

  const navsToMany = et.navigationProperties
    .filter((nav) => nav.isCollection)
    .map((nav) => ({
      name: nav.name,
      targetSet: findTargetSetName(entitySet, nav.name)
    }));

  return {
    set: entitySet.name,
    typeName: et.name,
    keys: et.keys.map((k) => k.name),
    properties,
    columns,
    selectionFields,
    headerInfo,
    facets,
    navsToMany
  };
}

let cachedModel: ServiceModel | undefined;
let cachedPublishedSets: Set<string> | undefined;

async function loadConverted(): Promise<ConvertedMetadata> {
  const xml = await getMetadataXml();
  const raw = parse(xml, "rap2next");
  return convert(raw);
}

/** Cached, normalized ServiceModel — the ONLY shape pages/components consume. */
export async function getServiceModel(): Promise<ServiceModel> {
  if (cachedModel) return cachedModel;
  const converted = await loadConverted();
  const entities = converted.entitySets.map((es) => buildEntityModel(es));
  cachedModel = {
    serviceUrl: isMockMode() ? "mock://travel" : getSapBaseUrl(),
    entities
  };
  cachedPublishedSets = new Set(
    converted.entitySets
      .filter((es) => (es.entityType.annotations?.UI?.LineItem?.length ?? 0) > 0)
      .map((es) => es.name)
  );
  return cachedModel;
}

/**
 * Entities with a UI.LineItem annotation — the ones the home page publishes as cards.
 * (Annotation = publication intent; see docs/ARCHITECTURE.md "Normalized model".)
 */
export async function getPublishedEntities(): Promise<EntityModel[]> {
  const model = await getServiceModel();
  if (!cachedPublishedSets) return model.entities;
  return model.entities.filter((e) => cachedPublishedSets!.has(e.set));
}

export async function getEntity(set: string): Promise<EntityModel | undefined> {
  const model = await getServiceModel();
  return model.entities.find((e) => e.set === set);
}
