# Condition-Based Filtering Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Airtable-style condition-based filtering to @delta-and-beta/data-table — nested condition groups with And/Or conjunctions, type-aware operators, and a filter config UI panel.

**Reference:** Airtable's "Filtering records using conditions" documentation.

**Architecture:** Extends the existing compound component pattern. Filter slots into the data pipeline as the first step: filter → search → sort → groupBy.

---

## Data Model (`src/types.ts`)

```typescript
type TextOperator = 'is' | 'is_not' | 'contains' | 'does_not_contain' | 'is_empty' | 'is_not_empty'
type NumberOperator = 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'is_empty' | 'is_not_empty'
type DateOperator = 'is' | 'is_before' | 'is_after' | 'is_on_or_before' | 'is_on_or_after' | 'is_empty' | 'is_not_empty'

type FilterOperator = TextOperator | NumberOperator | DateOperator

interface FilterCondition {
  id: string           // unique ID for React keys / drag reorder
  field: string        // column id
  operator: FilterOperator
  value: string        // stored as string, parsed per type at eval time
}

interface FilterGroup {
  id: string
  conjunction: 'and' | 'or'
  conditions: FilterCondition[]
  groups: FilterGroup[]  // nested sub-groups, max depth 3
}

interface FilterConfig {
  root: FilterGroup
  enabled: boolean      // toggle all filters on/off without losing config
}
```

Key constraints (from Airtable model):
- Max nesting depth: 3 levels
- Each group uses a single conjunction (And or Or, not both)
- "is" operator is case-sensitive; "contains" is case-insensitive
- "is_empty"/"is_not_empty" operators require no value

---

## Pure Logic Layer (`src/lib/filter.ts`)

Framework-agnostic, zero dependencies. Follows the pattern of `group-by.ts`, `sort.ts`, `search.ts`.

### Core function

```typescript
function filterRecords<T extends RowData>(
  records: T[],
  root: FilterGroup,
  columns: ColumnDef<T>[],
): T[]
```

Walks the FilterGroup tree recursively:
1. Evaluate each condition in the group against a record → boolean
2. Evaluate each nested group recursively → boolean
3. Combine all results with the group's conjunction (and = every, or = some)

### Operator evaluation

Switches on column type to parse values:
- **Text**: string comparison; case-insensitive for contains/does_not_contain, case-sensitive for is/is_not
- **Number/Currency**: parseFloat then numeric comparison
- **Date**: new Date() comparison
- **is_empty/is_not_empty**: check for null, undefined, or empty string

### Exported helpers

- `getOperatorsForColumnType(type: ColumnDef['type']): FilterOperator[]` — for UI dropdowns
- `createEmptyCondition(field: string): FilterCondition` — factory with default operator
- `createEmptyGroup(): FilterGroup` — factory with 'and' conjunction
- `getFilterDepth(group: FilterGroup): number` — for enforcing depth limit
- `countConditions(group: FilterGroup): number` — for active filter badge

### Test file: `src/lib/filter.test.ts`

Heavy unit tests covering:
- Each operator for each column type
- Nested group evaluation (and/or combinations)
- Empty value handling and is_empty/is_not_empty
- Edge cases: no conditions (pass-through), invalid field IDs, type coercion

---

## React Hook (`src/hooks/useFilter.ts`)

Follows the pattern of useGroupBy, useColumns, useSort.

### Options

```typescript
interface UseFilterOptions<T extends RowData> {
  data: T[]
  columns: ColumnDef<T>[]
  storageKey?: string
}
```

### Return value

- `filteredData` — memoized result of filterRecords
- `root` — current FilterGroup tree
- `enabled` / `setEnabled` — toggle on/off without losing config
- `activeCount` — total conditions across all groups (for toolbar badge)
- Mutation helpers:
  - `addCondition(groupId, condition)`
  - `removeCondition(groupId, conditionId)`
  - `updateCondition(groupId, conditionId, updates)`
  - `addGroup(parentGroupId)` — enforces depth <= 3
  - `removeGroup(parentGroupId, groupId)`
  - `updateConjunction(groupId, conjunction)`
  - `clearAll()` — resets to empty root group

### Persistence

Saves FilterConfig to localStorage under `{storageKey}-filters`. On load, validates saved field IDs still exist in columns.

---

## UI Components

### FilterToolbarButton (`src/components/toolbar/FilterToolbarButton.tsx`)

Toolbar button showing active filter count badge. Toggles filter panel open/closed. Includes quick "enabled" toggle.

### FilterConfigPanel (`src/components/toolbar/FilterConfigPanel.tsx`)

Main panel rendering the root FilterGroup recursively:
- **Condition row**: field dropdown → operator dropdown → value input (type-dependent) + delete button
- **Group**: bordered box with conjunction toggle (And/Or), conditions, nested sub-groups. Header has +Add condition, +Add condition group (disabled at depth 3), delete group.
- **Footer**: +Add condition and +Add condition group for root level.

Operator dropdown updates when field changes. Value input hides for is_empty/is_not_empty.

### FilterConditionRow (`src/components/toolbar/FilterConditionRow.tsx`)

Extracted sub-component for single condition row (field/operator/value triplet).

---

## Integration

### Pipeline change in DataTable.tsx

```
useFilter(data) → useSearch(filteredData) → useSort → useGroupBy
```

### Context addition

Add `filter: ReturnType<typeof useFilter>` to DataTableContextValue.

### Compound component

- `DataTable.Filter` = FilterToolbarButton
- `DataTable.FilterPanel` = FilterConfigPanel
- FullPreset toolbar gets a filter button added

### Exports from index.ts

- Types: FilterCondition, FilterGroup, FilterConfig, FilterOperator, TextOperator, NumberOperator, DateOperator
- Pure logic: filterRecords, getOperatorsForColumnType, createEmptyCondition, createEmptyGroup
- Hook: useFilter
- Components: FilterToolbarButton, FilterConfigPanel, FilterConditionRow

---

## New Files

1. `src/lib/filter.ts` — pure filtering logic
2. `src/lib/filter.test.ts` — unit tests
3. `src/hooks/useFilter.ts` — React hook
4. `src/components/toolbar/FilterToolbarButton.tsx`
5. `src/components/toolbar/FilterConfigPanel.tsx`
6. `src/components/toolbar/FilterConditionRow.tsx`

## Modified Files

1. `src/types.ts` — add filter types
2. `src/context.ts` — add filter to context
3. `src/components/DataTable.tsx` — wire useFilter, add static properties, update FullPreset
4. `src/index.ts` — add exports
5. `src/components/toolbar/index.ts` — add barrel exports
