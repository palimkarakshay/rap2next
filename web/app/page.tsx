import Link from "next/link";
import { getPublishedEntities } from "@/lib/metadata";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const entities = await getPublishedEntities();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-12 px-6 py-16 sm:px-10">
      <header className="flex flex-col gap-4">
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-(--border) bg-(--surface) px-3 py-1 text-xs font-medium text-(--muted)">
          rap2next · v0.1
        </span>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Your SAP RAP services, rendered fresh.
        </h1>
        <p className="max-w-2xl text-lg text-(--muted)">
          Metadata-driven List Report and Object Page floorplans for OData V4 +{" "}
          <span className="font-mono text-sm">@UI</span> annotations — Fiori Elements&rsquo;
          brain, a modern skin.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {entities.map((entity) => (
          <Link
            key={entity.set}
            href={`/e/${entity.set}`}
            className="group flex flex-col gap-3 rounded-xl border border-(--border) bg-(--surface) p-6 transition-colors hover:border-(--brand)"
          >
            <span className="text-xs font-medium uppercase tracking-wide text-(--muted)">
              {entity.set}
            </span>
            <span className="text-2xl font-semibold">
              {entity.headerInfo?.typeNamePlural ?? entity.set}
            </span>
            <span className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-(--brand)">
              View list
              <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </span>
          </Link>
        ))}
        {entities.length === 0 && (
          <p className="text-(--muted)">
            No published entity sets found (none carry a UI.LineItem annotation).
          </p>
        )}
      </section>
    </div>
  );
}
