// The product name as a bare string, in a module with **zero imports**.
//
// `src/ui/components/brand.js` is the canonical brand module and still owns
// every brand *element* (createBrandMark/createBrandWordmark/createBrandIcon),
// but it imports `el()` from `../dom.js` and `svgEl()` from `../utils/svg.js`
// — both DOM-touching. That makes it unimportable from `src/core/**`, whose
// modules are pure by contract (no DOM, no store, no Firebase), and from the
// pure data modules that feed them.
//
// Same reasoning, and the same shape, as `src/core/roadmap/limits.js`: a
// caller that needs only the constant must not be forced to pull in a whole
// DOM/Firebase import chain to get it (see .claude/rules/roadmap-store.md's
// note on why the length caps live in their own dependency-free module).
//
// `brand.js` re-exports this, so `import { BRAND_NAME } from './brand.js'`
// keeps working unchanged for every UI call site that already used it.
//
// Root CLAUDE.md: the literal string must never be hard-coded anywhere else —
// that one-file-rename guarantee (issue #7, docs/adr/ADR-004-product-rename.md)
// is the whole reason this constant exists. `scripts/lint-brand.mjs` enforces it.
export const BRAND_NAME = 'Ascent';
