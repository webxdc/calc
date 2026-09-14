# Vendored dependencies

## ironcalc

A copy of IronCalc at upstream `main`, commit
`4a95d5d71c574c37b4cab37e5fa30e1cfe719e42`, with
[PR #1146](https://github.com/ironcalc/IronCalc/pull/1146) rebased on top.

This has a PR modifying ``@ironcalc/workbook` with a modification that allows
editing to proceed without losing focus/text.

See [Building](../README.md#building) for how to build it.

### Local modifications

Three modifications were made, all of them consequences of IronCalc living inside another git repo and
of needing xlsx in the browser.

`bindings/wasm/Makefile`, two changes:

- `pnpm exec tsc` gained `--ignoreConfig`

TypeScript walks up the directory parent chain and finds it, which breaks
the build.

- `SRC_HASH` passes absolute paths to `git hash-object`. That command resolves
  relative paths against the repository root, which here is the calc project
  rather than `vendor/ironcalc`, so every path missed its file.

`webapp/IronCalc/package.json`:

- `@ironcalc/wasm` points at `../../bindings/wasm/pkg-xlsx` instead of `pkg`.
  Upstream gates the xlsx reader and writer behind the wasm crate's `xlsx`
  feature and emits two packages from it; the default one has no `toXlsx`,
  which the export button needs. The name inside `pkg-xlsx` is
  `@ironcalc/wasm-xlsx`, but npm links it under the dependency key, so the
  `@ironcalc/wasm` imports in the library keep resolving.

`@ironcalc/wasm-xlsx` is not published on npm yet. Once it is, and once #1146
has landed, this whole directory can be replaced by ordinary npm dependencies.
