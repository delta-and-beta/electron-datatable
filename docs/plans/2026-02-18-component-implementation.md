# Data Table Component Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement all remaining UI components for @delta-and-beta/data-table — table primitives, toolbar controls, group headers, content rendering, and preset layouts.

**Architecture:** Compound component pattern with DataTable root providing context, sub-components consuming via useDataTable hook. Each component is independently importable but designed to compose within DataTable.

**Tech Stack:** React 18, Tailwind CSS, lucide-react icons, clsx + tailwind-merge

---

### Task 1: Table Primitives

**Files:**
- Create: `src/components/table/Table.tsx`
- Create: `src/components/table/index.ts`

Port shadcn/ui table primitives with dt-* theme tokens.

### Task 2: GroupByToolbarButton

**Files:**
- Create: `src/components/toolbar/GroupByToolbarButton.tsx`
- Test: `src/components/toolbar/GroupByToolbarButton.test.tsx`

### Task 3: GroupByConfigPanel

**Files:**
- Create: `src/components/toolbar/GroupByConfigPanel.tsx`
- Create: `src/components/toolbar/index.ts`

### Task 4: GroupHeader

**Files:**
- Create: `src/components/headers/GroupHeader.tsx`
- Create: `src/components/headers/index.ts`

### Task 5: Search Component

**Files:**
- Create: `src/components/toolbar/Search.tsx`

### Task 6: ColumnToggle Component

**Files:**
- Create: `src/components/toolbar/ColumnToggle.tsx`

### Task 7: DateFilter Component

**Files:**
- Create: `src/components/toolbar/DateFilter.tsx`

### Task 8: Content Component (Table Body)

**Files:**
- Create: `src/components/Content.tsx`

### Task 9: Toolbar & Footer Components

**Files:**
- Create: `src/components/Toolbar.tsx`
- Create: `src/components/Footer.tsx`

### Task 10: Wire DataTable Compound Component

**Files:**
- Modify: `src/components/DataTable.tsx`
- Modify: `src/index.ts`

### Task 11: Tests & Build Verification

**Files:**
- Create: component tests
- Run: typecheck, test, build
