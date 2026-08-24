/**
 * List query builder + fetchers. Works identically in mock mode (reading
 * fixtures/travel/data.json and implementing $filter/$orderby/$top/$skip/$count/$expand
 * semantics in-process) and live mode (forwarding the same query to the real OData V4
 * service). RSC pages call fetchList/fetchOne directly — never via self-HTTP fetch.
 */
import fs from "node:fs";
import path from "node:path";
import type { EntityModel } from "./model";
import { buildLiveUrl, getAuthHeaders, getServiceModel, isMockMode } from "./metadata";

export type ODataRow = Record<string, unknown>;

export interface ListQueryOptions {
  /** property name -> raw filter-bar value (already trimmed, empty values are ignored) */
  filters?: Record<string, string>;
  top?: number;
  skip?: number;
  orderby?: { path: string; dir: "asc" | "desc" };
}

export interface ListResult {
  items: ODataRow[];
  total: number;
}

function isStringLikeProp(entity: EntityModel, name: string) {
  const prop = entity.properties.find((p) => p.name === name);
  return { prop, isString: !prop || prop.type === "Edm.String" };
}

function escapeODataString(value: string): string {
  return value.replace(/'/g, "''");
}

const NUMERIC_LITERAL_RE = /^-?\d+(\.\d+)?$/;
const DATE_LITERAL_RE = /^\d{4}-\d{2}-\d{2}$/;
const GUID_LITERAL_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function isNumericEdmType(type: string): boolean {
  return /^Edm\.(Int16|Int32|Int64|Byte|SByte|Decimal|Double|Single)$/.test(type);
}

interface LiteralOptions {
  /**
   * "omit": the caller drops the whole filter term when the raw value doesn't match the
   * property's EDM literal syntax (used for user-supplied $filter values — never let
   * arbitrary text become executable OData syntax, e.g. `0 or true`).
   * "quote": fall back to a quoted string literal instead (used for key predicates,
   * which can't simply be dropped without breaking the whole predicate).
   */
  onInvalid: "omit" | "quote";
  /**
   * Percent-encode the literal's *content* for safe embedding directly in a fetch URL.
   * The wrapping quote/paren/comma/equals punctuation stays literal — encodeURIComponent
   * already leaves `' ( )` unescaped, so this only encodes characters that would
   * otherwise corrupt the URL (spaces, `&`, `#`, `?`, `/`, unicode, ...).
   */
  urlEncode?: boolean;
}

/**
 * Formats a raw string as an OData literal for `type`, validating non-string types so
 * user- or data-supplied text can never be interpolated as executable OData syntax.
 * Edm.String is always quoted (with doubled single-quotes); every other supported type
 * is validated against its literal grammar before being emitted unquoted.
 */
function formatODataLiteral(
  type: string,
  rawValue: string,
  { onInvalid, urlEncode = false }: LiteralOptions
): string | undefined {
  const quoteString = (v: string): string => {
    const escaped = escapeODataString(v);
    return `'${urlEncode ? encodeURIComponent(escaped) : escaped}'`;
  };

  if (type === "Edm.String") return quoteString(rawValue);

  const isValidTypedLiteral =
    (type === "Edm.Boolean" && (rawValue === "true" || rawValue === "false")) ||
    ((type === "Edm.Date" || type === "Edm.DateTimeOffset") && DATE_LITERAL_RE.test(rawValue)) ||
    (type === "Edm.Guid" && GUID_LITERAL_RE.test(rawValue)) ||
    (isNumericEdmType(type) && NUMERIC_LITERAL_RE.test(rawValue));

  if (isValidTypedLiteral) return rawValue;
  return onInvalid === "omit" ? undefined : quoteString(rawValue);
}

/** contains(Prop,'v') for strings without maxLength<=2, Prop eq <literal> otherwise. */
function buildFilterClause(
  entity: EntityModel,
  name: string,
  rawValue: string
): string | undefined {
  const { prop, isString } = isStringLikeProp(entity, name);
  const useContains = isString && (prop?.maxLength === undefined || prop.maxLength > 2);
  if (useContains) return `contains(${name},'${escapeODataString(rawValue)}')`;
  const literal = formatODataLiteral(prop?.type ?? "Edm.String", rawValue, { onInvalid: "omit" });
  return literal === undefined ? undefined : `${name} eq ${literal}`;
}

export function buildFilterExpression(
  entity: EntityModel,
  filters: Record<string, string> | undefined
): string | undefined {
  if (!filters) return undefined;
  const clauses = Object.entries(filters)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([name, value]) => buildFilterClause(entity, name, value))
    .filter((c): c is string => c !== undefined);
  return clauses.length > 0 ? clauses.join(" and ") : undefined;
}

export function buildListQuery(entity: EntityModel, opts: ListQueryOptions = {}): string {
  const params = new URLSearchParams();
  params.set("$count", "true");
  params.set("$top", String(opts.top ?? 20));
  if (opts.skip) params.set("$skip", String(opts.skip));
  const filter = buildFilterExpression(entity, opts.filters);
  if (filter) params.set("$filter", filter);
  if (opts.orderby) {
    params.set(
      "$orderby",
      `${opts.orderby.path}${opts.orderby.dir === "desc" ? " desc" : ""}`
    );
  }
  return params.toString();
}

/** Builds the `(...)` key predicate for a row (single key or Name='v',Name2='v2'). */
export function buildKeyPredicate(entity: EntityModel, row: ODataRow): string {
  const format = (key: string): string => {
    const prop = entity.properties.find((p) => p.name === key);
    const raw = row[key];
    // "quote": an invalid/unexpected value for a numeric/date/guid/boolean key falls
    // back to a safely-quoted string literal rather than ever being interpolated
    // unquoted — never omitted, since dropping a key segment would break the predicate.
    return formatODataLiteral(prop?.type ?? "Edm.String", String(raw ?? ""), {
      onInvalid: "quote"
    })!;
  };
  if (entity.keys.length === 1) {
    return `(${format(entity.keys[0])})`;
  }
  return `(${entity.keys.map((k) => `${k}=${format(k)}`).join(",")})`;
}

/**
 * Rebuilds a (possibly caller-supplied) key predicate into a validated, EDM-type-aware
 * predicate safe to concatenate into a live upstream SAP URL: string content is quoted
 * (doubled single-quotes) and percent-encoded; other types are validated against their
 * literal grammar and emitted unquoted, or safely quoted+encoded as a fallback.
 */
function buildUpstreamKeyPredicate(entity: EntityModel, keyPredicate: string): string {
  const keyValues = parseKeyPredicate(keyPredicate, entity.keys);
  const format = (key: string): string => {
    const prop = entity.properties.find((p) => p.name === key);
    const raw = keyValues[key] ?? "";
    return formatODataLiteral(prop?.type ?? "Edm.String", raw, {
      onInvalid: "quote",
      urlEncode: true
    })!;
  };
  if (entity.keys.length === 1) {
    return `(${format(entity.keys[0])})`;
  }
  return `(${entity.keys.map((k) => `${k}=${format(k)}`).join(",")})`;
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replace(/''/g, "'");
  }
  return trimmed;
}

/** Splits a key-predicate's inner content on top-level commas (ignoring commas inside quotes). */
function splitTopLevel(inner: string): string[] {
  const parts: string[] = [];
  let current = "";
  let inQuote = false;
  for (const ch of inner) {
    if (ch === "'") inQuote = !inQuote;
    if (ch === "," && !inQuote) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current) parts.push(current);
  return parts;
}

/**
 * Parses a key predicate like `('00000001')` or `(TravelID='00000001',BookingID='0001')`.
 * Tolerates an optional leading entity-set name, e.g. `Travel('00000001')`.
 */
export function parseKeyPredicate(raw: string, keys: string[]): Record<string, string> {
  const openIdx = raw.indexOf("(");
  const closeIdx = raw.lastIndexOf(")");
  const inner = openIdx >= 0 && closeIdx > openIdx ? raw.slice(openIdx + 1, closeIdx) : raw;
  const result: Record<string, string> = {};
  if (inner.includes("=")) {
    for (const part of splitTopLevel(inner)) {
      const eq = part.indexOf("=");
      if (eq < 0) continue;
      const name = part.slice(0, eq).trim();
      result[name] = unquote(part.slice(eq + 1));
    }
  } else if (keys.length === 1) {
    result[keys[0]] = unquote(inner);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

type MockData = Record<string, ODataRow[]>;
let mockDataCache: MockData | undefined;

function loadMockData(): MockData {
  if (mockDataCache) return mockDataCache;
  const p = path.join(process.cwd(), "fixtures/travel/data.json");
  mockDataCache = JSON.parse(fs.readFileSync(p, "utf-8")) as MockData;
  return mockDataCache;
}

/**
 * Returns the flat row collection for an entity set. RAP-Travel-style fixtures only
 * carry data for the root entity set (Travel) with children nested under their
 * navigation property (`_Booking`); if `set` has no top-level array of its own, derive
 * it by flattening every to-many nav across the model whose target set matches.
 */
async function loadMockCollection(set: string): Promise<ODataRow[]> {
  const data = loadMockData();
  if (Array.isArray(data[set])) return data[set];

  const model = await getServiceModel();
  const derived: ODataRow[] = [];
  for (const parent of model.entities) {
    const parentRows = Array.isArray(data[parent.set]) ? data[parent.set] : [];
    for (const nav of parent.navsToMany) {
      if (nav.targetSet !== set) continue;
      for (const row of parentRows) {
        const child = row[nav.name];
        if (Array.isArray(child)) derived.push(...(child as ODataRow[]));
      }
    }
  }
  return derived;
}

function compareValues(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === undefined || a === null) return -1;
  if (b === undefined || b === null) return 1;
  const an = Number(a);
  const bn = Number(b);
  if (!Number.isNaN(an) && !Number.isNaN(bn)) return an - bn;
  return String(a).localeCompare(String(b));
}

function matchesFilter(
  entity: EntityModel,
  row: ODataRow,
  name: string,
  rawValue: string
): boolean {
  const { prop, isString } = isStringLikeProp(entity, name);
  const useContains = isString && (prop?.maxLength === undefined || prop.maxLength > 2);
  const cell = row[name];
  if (cell === undefined || cell === null) return false;
  const cellStr = String(cell);
  if (useContains) return cellStr.toLowerCase().includes(rawValue.toLowerCase());
  return cellStr === rawValue;
}

function stripNavKeys(entity: EntityModel, row: ODataRow): ODataRow {
  const navNames = new Set(entity.navsToMany.map((n) => n.name));
  const out: ODataRow = {};
  for (const [k, v] of Object.entries(row)) {
    if (navNames.has(k)) continue;
    out[k] = v;
  }
  return out;
}

async function mockFetchList(entity: EntityModel, opts: ListQueryOptions): Promise<ListResult> {
  let rows = await loadMockCollection(entity.set);

  if (opts.filters) {
    for (const [name, value] of Object.entries(opts.filters)) {
      if (!value) continue;
      rows = rows.filter((row) => matchesFilter(entity, row, name, value));
    }
  }

  if (opts.orderby) {
    const { path: sortPath, dir } = opts.orderby;
    rows = [...rows].sort((a, b) => {
      const cmp = compareValues(a[sortPath], b[sortPath]);
      return dir === "desc" ? -cmp : cmp;
    });
  }

  const total = rows.length;
  const skip = opts.skip ?? 0;
  const top = opts.top ?? 20;
  const items = rows.slice(skip, skip + top).map((row) => stripNavKeys(entity, row));
  return { items, total };
}

async function mockFetchOne(
  entity: EntityModel,
  keyPredicate: string,
  expandNavs: string[]
): Promise<ODataRow | undefined> {
  const keyValues = parseKeyPredicate(keyPredicate, entity.keys);
  const rows = await loadMockCollection(entity.set);
  const row = rows.find((r) => entity.keys.every((k) => String(r[k]) === keyValues[k]));
  if (!row) return undefined;

  const navNames = new Set(entity.navsToMany.map((n) => n.name));
  const out: ODataRow = {};
  for (const [k, v] of Object.entries(row)) {
    if (navNames.has(k)) {
      if (expandNavs.includes(k)) out[k] = v;
      continue;
    }
    out[k] = v;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Public fetchers (mock + live)
// ---------------------------------------------------------------------------

export async function fetchList(
  entity: EntityModel,
  opts: ListQueryOptions = {}
): Promise<ListResult> {
  if (isMockMode()) return mockFetchList(entity, opts);

  const query = buildListQuery(entity, opts);
  const url = buildLiveUrl(entity.set, query);
  const res = await fetch(url, {
    headers: { ...getAuthHeaders(), Accept: "application/json" },
    cache: "no-store"
  });
  if (!res.ok) {
    throw new Error(`OData list fetch failed for ${entity.set}: ${res.status} ${res.statusText}`);
  }
  const json = (await res.json()) as { "@odata.count"?: number; value?: ODataRow[] };
  const items = Array.isArray(json.value) ? json.value : [];
  const total = typeof json["@odata.count"] === "number" ? json["@odata.count"] : items.length;
  return { items, total };
}

export async function fetchOne(
  entity: EntityModel,
  keyPredicate: string,
  expandNavs: string[] = []
): Promise<ODataRow | undefined> {
  if (isMockMode()) return mockFetchOne(entity, keyPredicate, expandNavs);

  const params = new URLSearchParams();
  if (expandNavs.length > 0) params.set("$expand", expandNavs.join(","));
  // Never concatenate the (already-decoded) key predicate into the upstream URL raw:
  // rebuild it from validated, EDM-type-aware, percent-encoded literals.
  const predicate = buildUpstreamKeyPredicate(entity, keyPredicate);
  const url = buildLiveUrl(`${entity.set}${predicate}`, params.toString());
  const res = await fetch(url, {
    headers: { ...getAuthHeaders(), Accept: "application/json" },
    cache: "no-store"
  });
  if (res.status === 404) return undefined;
  if (!res.ok) {
    throw new Error(`OData entity fetch failed for ${entity.set}: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as ODataRow;
}
