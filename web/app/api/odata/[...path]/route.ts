/**
 * OData proxy: browser-side calls and external tools go through here. RSC pages never
 * hit this route during render/build — they call lib/metadata.ts + lib/odata.ts
 * directly instead.
 *
 * GET /api/odata/$metadata            -> $metadata XML (mock fixture or live SAP)
 * GET /api/odata/Travel?$top=20&...   -> OData V4 JSON list ({"@odata.count", "value"})
 * GET /api/odata/Travel('00000001')   -> single entity, optional $expand
 *
 * Mock mode parses the incoming $filter/$orderby text itself (there's no real upstream
 * to forward it to) and reuses lib/odata.ts's mock fetchers. LIVE mode for a list request
 * is a raw pass-through: the caller's original query string (their exact $filter, $top,
 * $skip, $orderby, $count, ...) is forwarded to SAP UNCHANGED, with only `sap-client`
 * layered on — it is never re-derived from our own contains/eq filter policy, so a
 * caller's $filter always means exactly what they sent. A key-predicate (single-entity)
 * request still goes through lib/odata.ts's fetchOne in both modes, since that path
 * deliberately rebuilds+validates the key predicate (EDM-type-aware, percent-encoded)
 * rather than concatenating caller input into the upstream URL raw.
 */
import { NextRequest, NextResponse } from "next/server";
import { getAuthHeaders, getEntity, getMetadataXml, getSapBaseUrl, isMockMode } from "@/lib/metadata";
import { fetchList, fetchOne } from "@/lib/odata";

export const dynamic = "force-dynamic";

function parseFilterParams(filterExpr: string | null): Record<string, string> {
  if (!filterExpr) return {};
  const result: Record<string, string> = {};
  for (const clause of filterExpr.split(/\s+and\s+/i)) {
    const trimmed = clause.trim();
    const containsMatch = /^contains\(\s*([A-Za-z0-9_]+)\s*,\s*'((?:[^']|'')*)'\s*\)$/i.exec(
      trimmed
    );
    if (containsMatch) {
      result[containsMatch[1]] = containsMatch[2].replace(/''/g, "'");
      continue;
    }
    const eqMatch = /^([A-Za-z0-9_]+)\s+eq\s+'?((?:[^']|'')*)'?$/i.exec(trimmed);
    if (eqMatch) {
      result[eqMatch[1]] = eqMatch[2].replace(/''/g, "'");
    }
  }
  return result;
}

function parseOrderBy(raw: string | null): { path: string; dir: "asc" | "desc" } | undefined {
  if (!raw) return undefined;
  const [orderPath, dir] = raw.trim().split(/\s+/);
  if (!orderPath) return undefined;
  return { path: orderPath, dir: dir?.toLowerCase() === "desc" ? "desc" : "asc" };
}

/** Forwards `rawQuery` (e.g. `request.nextUrl.search`, including its leading "?") to the
 *  live SAP service byte-for-byte, only layering `sap-client` on top — never re-parses
 *  or re-serializes it, so the caller's original $filter text is preserved exactly. */
function buildRawLiveUrl(setPath: string, rawQuery: string): string {
  const base = getSapBaseUrl();
  const sapClient = process.env.SAP_CLIENT;
  let qs = rawQuery;
  if (sapClient) {
    qs += `${qs.length > 0 ? "&" : "?"}sap-client=${encodeURIComponent(sapClient)}`;
  }
  return `${base}/${setPath}${qs}`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;
  if (!segments || segments.length === 0) {
    return NextResponse.json({ error: "missing path" }, { status: 400 });
  }

  if (segments[0] === "$metadata") {
    const xml = await getMetadataXml();
    return new NextResponse(xml, { headers: { "Content-Type": "application/xml" } });
  }

  const first = segments[0];
  const openIdx = first.indexOf("(");
  const setName = openIdx >= 0 ? first.slice(0, openIdx) : first;
  const keyPredicate = openIdx >= 0 ? first.slice(openIdx) : undefined;

  const entity = await getEntity(setName);
  if (!entity) {
    return NextResponse.json({ error: `Unknown entity set: ${setName}` }, { status: 404 });
  }

  const searchParams = request.nextUrl.searchParams;

  if (keyPredicate) {
    const expand = (searchParams.get("$expand") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const row = await fetchOne(entity, keyPredicate, expand);
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(row);
  }

  if (isMockMode()) {
    const top = searchParams.get("$top");
    const skip = searchParams.get("$skip");
    const result = await fetchList(entity, {
      filters: parseFilterParams(searchParams.get("$filter")),
      top: top ? Number(top) : undefined,
      skip: skip ? Number(skip) : undefined,
      orderby: parseOrderBy(searchParams.get("$orderby"))
    });
    return NextResponse.json({ "@odata.count": result.total, value: result.items });
  }

  // Live mode: stream the caller's original list query straight through to SAP.
  const url = buildRawLiveUrl(entity.set, request.nextUrl.search);
  const res = await fetch(url, {
    headers: { ...getAuthHeaders(), Accept: "application/json" },
    cache: "no-store"
  });
  return new NextResponse(res.body, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("content-type") ?? "application/json" }
  });
}
