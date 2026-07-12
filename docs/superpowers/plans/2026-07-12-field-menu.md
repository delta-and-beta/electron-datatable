# Field Menu 0.13.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the 0.13.0 package surface for header field actions, consumer menu extensions, a source-neutral field editor, and inferred writability metadata.

**Architecture:** Add focused exported primitives (`MenuItem`, `ColumnHeaderMenu`, `FieldEditor`) and thread the consumer menu factory plus filter-panel opener through the existing `DataTable` context. Keep inference safety in `inferColumns`, after override merging, so display overrides cannot unlock computed fields.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, lucide-react, Vitest, React Testing Library, tsup

## Global Constraints

- Implement package units P1, P2, and P3 only.
- Version the package as `0.13.0` and add the three requested `CHANGELOG.md` Added entries.
- Use no Airtable-specific vocabulary in package components.
- Use no semicolons and do not hardcode locale-dependent `Intl` output in tests.
- Do not commit.

---

### Task 1: Writable inference metadata

**Files:**
- Modify: `src/types.ts`
- Modify: `src/sync/infer-columns.ts`
- Test: `src/sync/infer-columns.test.ts`

**Interfaces:**
- Produces: `ColumnDef.meta.writable?: boolean`

- [ ] Add failing tests for false/true metadata round-tripping, `editable: true` override rejection, and display-type override safety.
- [ ] Run `npx vitest run src/sync/infer-columns.test.ts` and confirm the new metadata assertions fail.
- [ ] Merge `writable` into inferred metadata while retaining the post-override `editable = false` guard.
- [ ] Re-run the focused test and confirm it passes.

### Task 2: Shared MenuItem primitive and ViewsMenu refactor

**Files:**
- Create: `src/components/MenuItem.tsx`
- Create: `src/components/MenuItem.test.tsx`
- Modify: `src/components/ViewsMenu.tsx`
- Modify: `src/index.ts`

**Interfaces:**
- Produces: `MenuItem` with icon, label, `variant`, `disabled`, `disabledReason`, and selection callback props.

- [ ] Add failing RTL tests for default, danger, and disabled-with-reason behavior.
- [ ] Run the focused tests and confirm failure because `MenuItem` is absent.
- [ ] Implement and export `MenuItem`; replace `ViewsMenu`'s local action row without changing its labels or callbacks.
- [ ] Run MenuItem and existing ViewsMenu tests and confirm they pass.

### Task 3: Column header menu contract and actions

**Files:**
- Modify: `src/types.ts`
- Modify: `src/context.ts`
- Modify: `src/components/DataTable.tsx`
- Create: `src/components/ColumnHeaderMenu.tsx`
- Modify: `src/components/Content.tsx`
- Modify: `src/index.ts`
- Test: `src/components/ColumnHeaderMenu.test.tsx`

**Interfaces:**
- Produces: `ColumnMenuItem`, `DataTableProps.columnMenuItems`, and exported `ColumnHeaderMenu`.
- Consumes: `MenuItem`, `sort`, `filter`, `groupBy`, `columnState`, visible column index, and a context filter-panel opener.

- [ ] Add full-`DataTable` failing tests for opening, keyboard reachability, both sorts, seeded filter plus open panel, grouping, freeze, hide, capability disabled reasons/no-ops, tags/cap grouping reason, consumer ordering/separators/danger/disabled behavior, and isolated chevron/resize hit areas.
- [ ] Run the focused suite and confirm failures are caused by the missing menu API.
- [ ] Add the public types and context values; move the full-preset filter open state high enough for header actions to request it.
- [ ] Implement the Popover-backed header menu, append consumer rows after built-ins, and reserve non-overlapping sort/chevron/resize hit areas.
- [ ] Re-run focused tests and relevant Content/toolbar tests; refactor only while green.

### Task 4: Presentational FieldEditor

**Files:**
- Create: `src/components/FieldEditor.tsx`
- Create: `src/components/FieldEditor.test.tsx`
- Modify: `src/index.ts`

**Interfaces:**
- Produces: `FieldTypeOption`, `FieldEditorProps`, and `FieldEditor`.

- [ ] Add failing RTL tests for label/description search, keyboard type selection, disabled reasons/no-op, description reveal, exact save payload, cancel, saving state, and error rendering.
- [ ] Run the focused suite and confirm failure because `FieldEditor` is absent.
- [ ] Implement controlled local form state, searchable listbox semantics, disabled-entry handling, description affordance, and async-safe save invocation.
- [ ] Re-run focused tests and refactor only while green.

### Task 5: Release metadata and artifact verification

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `CHANGELOG.md`
- Verify: `dist/index.d.ts`, `dist/index.js`, `dist/styles.css`

**Interfaces:**
- Produces: package version `0.13.0` and public declarations for all new APIs.

- [ ] Update version and changelog with the three exact Added capabilities.
- [ ] Run `npm test`, `npx tsc --noEmit`, `npm run lint`, and `npm run build`.
- [ ] Inspect built declarations/JS/CSS for the exported menu/editor APIs and header/editor styles.
- [ ] Review `git diff` against P1/P2/P3 and report each gate with exit status and test counts.
