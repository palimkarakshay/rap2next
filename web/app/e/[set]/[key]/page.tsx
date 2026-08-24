import Link from "next/link";
import { notFound } from "next/navigation";
import { getEntity } from "@/lib/metadata";
import { fetchOne } from "@/lib/odata";
import { formatValue } from "@/lib/format";
import type { FacetModel } from "@/lib/model";

export const dynamic = "force-dynamic";

export default async function ObjectPage({
  params
}: {
  params: Promise<{ set: string; key: string }>;
}) {
  const { set, key } = await params;
  const entity = await getEntity(set);
  if (!entity) notFound();

  // Next.js already URL-decodes dynamic route params before handing them to the page —
  // decoding again here would corrupt a key predicate containing a literal "%" and can
  // throw URIError on malformed sequences. Use `key` as-is; encode only when a URL
  // needs to be built (lib/odata.ts does that for the live upstream fetch).
  const tableFacetNavs = entity.facets
    .filter((f): f is Extract<FacetModel, { kind: "table" }> => f.kind === "table")
    .map((f) => f.nav)
    .filter(Boolean);

  const row = await fetchOne(entity, key, tableFacetNavs);
  if (!row) notFound();

  const title = entity.headerInfo?.titlePath
    ? formatValue(row[entity.headerInfo.titlePath], undefined)
    : (entity.headerInfo?.typeName ?? entity.set);
  const description = entity.headerInfo?.descriptionPath
    ? formatValue(row[entity.headerInfo.descriptionPath], undefined)
    : undefined;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-10 sm:px-10">
      <Link href={`/e/${set}`} className="text-sm text-(--muted) hover:text-(--brand)">
        ← Back to {entity.headerInfo?.typeNamePlural ?? entity.set}
      </Link>

      <header className="flex flex-col gap-2 rounded-xl border border-(--border) bg-(--surface) p-6">
        <span className="inline-flex w-fit items-center rounded-full border border-(--border) px-2.5 py-0.5 text-xs font-medium text-(--muted)">
          {entity.headerInfo?.typeName ?? entity.typeName}
        </span>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        {description && description !== "–" && <p className="text-(--muted)">{description}</p>}
      </header>

      <div className="flex flex-col gap-6">
        {entity.facets.map((facet, i) =>
          facet.kind === "group" ? (
            <section key={i} className="rounded-xl border border-(--border) bg-(--surface) p-6">
              <h2 className="mb-4 text-lg font-semibold">{facet.label}</h2>
              <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
                {facet.fields.map((field) => (
                  <div key={field.path} className="flex flex-col gap-0.5">
                    <dt className="text-xs font-medium uppercase tracking-wide text-(--muted)">
                      {field.label}
                    </dt>
                    <dd className="text-sm">{formatValue(row[field.path], field.type)}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : (
            <section key={i} className="rounded-xl border border-(--border) bg-(--surface) p-6">
              <h2 className="mb-4 text-lg font-semibold">{facet.label}</h2>
              <div className="overflow-x-auto rounded-lg border border-(--border)">
                <table className="w-full min-w-max text-left text-sm">
                  <thead>
                    <tr className="border-b border-(--border)">
                      {facet.columns.map((col) => (
                        <th
                          key={col.path}
                          className="whitespace-nowrap px-4 py-2.5 font-medium text-(--muted)"
                        >
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(Array.isArray(row[facet.nav])
                      ? (row[facet.nav] as Record<string, unknown>[])
                      : []
                    ).map((navRow, ri) => (
                      <tr
                        key={ri}
                        className="border-b border-(--border) last:border-0 hover:bg-(--background)"
                      >
                        {facet.columns.map((col) => (
                          <td key={col.path} className="px-4 py-2.5">
                            {formatValue(navRow[col.path], col.type)}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {!Array.isArray(row[facet.nav]) || (row[facet.nav] as unknown[]).length === 0 ? (
                      <tr>
                        <td
                          colSpan={facet.columns.length}
                          className="px-4 py-6 text-center text-(--muted)"
                        >
                          No related records.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
          )
        )}
      </div>
    </div>
  );
}
