import Link from "next/link";
import { notFound } from "next/navigation";
import { getEntity } from "@/lib/metadata";
import { fetchList, buildKeyPredicate } from "@/lib/odata";
import { formatValue } from "@/lib/format";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

type SearchParams = Record<string, string | string[] | undefined>;

function firstValue(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** A positive safe integer, else 1 (rejects NaN, Infinity, negatives, decimals, and
 *  values large enough to build an absurd $skip). */
function parsePage(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isSafeInteger(n) && n >= 1 ? n : 1;
}

export default async function ListReportPage({
  params,
  searchParams
}: {
  params: Promise<{ set: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { set } = await params;
  const sp = await searchParams;
  const entity = await getEntity(set);
  if (!entity) notFound();

  const filters: Record<string, string> = {};
  for (const field of entity.selectionFields) {
    const value = firstValue(sp[`f_${field}`]);
    if (value) filters[field] = value;
  }

  const sortField = typeof sp.sort === "string" ? sp.sort : undefined;
  const sortDir = sp.dir === "desc" ? "desc" : "asc";
  const page = parsePage(firstValue(sp.page));
  const skip = (page - 1) * PAGE_SIZE;

  const { items, total } = await fetchList(entity, {
    filters,
    top: PAGE_SIZE,
    skip,
    orderby: sortField ? { path: sortField, dir: sortDir } : undefined
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function hrefWith(overrides: Record<string, string | undefined>): string {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      if (typeof v === "string") next.set(k, v);
    }
    for (const [k, v] of Object.entries(overrides)) {
      if (v === undefined) next.delete(k);
      else next.set(k, v);
    }
    const qs = next.toString();
    return `/e/${set}${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-10 sm:px-10">
      <div className="flex flex-col gap-1">
        <Link href="/" className="text-sm text-(--muted) hover:text-(--brand)">
          ← Home
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">
          {entity.headerInfo?.typeNamePlural ?? entity.set}
        </h1>
      </div>

      {entity.selectionFields.length > 0 && (
        <form
          method="GET"
          className="flex flex-wrap items-end gap-4 rounded-xl border border-(--border) bg-(--surface) p-4"
        >
          {entity.selectionFields.map((field) => {
            const prop = entity.properties.find((p) => p.name === field);
            return (
              <label key={field} className="flex flex-col gap-1 text-sm">
                <span className="text-(--muted)">{prop?.label ?? field}</span>
                <input
                  type="text"
                  name={`f_${field}`}
                  defaultValue={filters[field] ?? ""}
                  className="rounded-lg border border-(--border) bg-(--background) px-3 py-1.5 text-sm outline-none focus:border-(--brand)"
                />
              </label>
            );
          })}
          <button
            type="submit"
            className="rounded-lg bg-(--brand) px-4 py-1.5 text-sm font-medium text-(--brand-foreground)"
          >
            Filter
          </button>
          {Object.keys(filters).length > 0 && (
            <Link href={`/e/${set}`} className="text-sm text-(--muted) hover:text-(--brand)">
              Clear
            </Link>
          )}
        </form>
      )}

      <div className="overflow-x-auto rounded-xl border border-(--border) bg-(--surface)">
        <table className="w-full min-w-max text-left text-sm">
          <thead className="sticky top-0 bg-(--surface)">
            <tr className="border-b border-(--border)">
              {entity.columns.map((col) => {
                const isSorted = sortField === col.path;
                const nextDir = isSorted && sortDir === "asc" ? "desc" : "asc";
                return (
                  <th
                    key={col.path}
                    className="whitespace-nowrap px-4 py-3 font-medium text-(--muted)"
                  >
                    <Link
                      href={hrefWith({ sort: col.path, dir: nextDir, page: undefined })}
                      className="inline-flex items-center gap-1 hover:text-(--brand)"
                    >
                      {col.label}
                      {isSorted && <span aria-hidden>{sortDir === "asc" ? "↑" : "↓"}</span>}
                    </Link>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {items.map((row, i) => {
              const key = buildKeyPredicate(entity, row);
              return (
                <tr
                  key={i}
                  className="border-b border-(--border) last:border-0 hover:bg-(--background)"
                >
                  {entity.columns.map((col) => (
                    <td key={col.path} className="px-4 py-3">
                      <Link href={`/e/${set}/${encodeURIComponent(key)}`} className="block">
                        {formatValue(row[col.path], col.type)}
                      </Link>
                    </td>
                  ))}
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={entity.columns.length} className="px-4 py-8 text-center text-(--muted)">
                  No results.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-(--muted)">
        <span>
          {total} result{total === 1 ? "" : "s"}
        </span>
        <div className="flex items-center gap-3">
          <Link
            href={hrefWith({ page: page > 1 ? String(page - 1) : undefined })}
            aria-disabled={page <= 1}
            className={`rounded-lg border border-(--border) px-3 py-1.5 ${
              page <= 1 ? "pointer-events-none opacity-40" : "hover:border-(--brand)"
            }`}
          >
            Previous
          </Link>
          <span>
            Page {page} of {totalPages}
          </span>
          <Link
            href={hrefWith({ page: String(page + 1) })}
            aria-disabled={page >= totalPages}
            className={`rounded-lg border border-(--border) px-3 py-1.5 ${
              page >= totalPages ? "pointer-events-none opacity-40" : "hover:border-(--brand)"
            }`}
          >
            Next
          </Link>
        </div>
      </div>
    </div>
  );
}
