# Known issues — v0.1

Deliberately deferred past v0.1 (found in the 2026-08-24 independent review); each is a
narrow-edge-case limitation, not a correctness regression for the RAP-Travel fixture.

- **Mock key-predicate parsing splits on `=` inside quoted literals.** `parseKeyPredicate`
  (`web/lib/odata.ts`) naively splits a multi-key predicate's `Name=Value` pairs on `=`;
  a string key whose value itself contains a literal `=` character will be mis-parsed.
- **The `/api/odata` proxy doesn't validate `$top`/`$skip` as bounded nonnegative
  integers.** A caller can request an arbitrarily large or negative page size/offset.
- **Live mode doesn't follow `@odata.nextLink`.** If SAP server-side-pages a response
  instead of honoring `$top`/`$skip` fully, the remaining pages are silently dropped.
- **The mock `$filter` parser splits `and` inside quoted values.** A filter value
  containing the literal substring `" and "` will be mis-split into extra, bogus clauses.
