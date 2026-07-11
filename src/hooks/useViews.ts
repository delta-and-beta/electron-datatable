import { useCallback, useEffect, useRef, useState } from 'react'
import type { FilterConfig, GroupConfig, DataTableRowHeight, DataTableView } from '../types'
import type { SortLevel } from '../lib/sort'
import type { ColumnSnapshot } from './useColumns'

interface SnapshotFacet<T> {
  getSnapshot: () => T
  restore: (snapshot: T) => void
}

export interface UseViewsOptions {
  storageKey: string
  columns: SnapshotFacet<ColumnSnapshot>
  sort: SnapshotFacet<SortLevel[]>
  filter: SnapshotFacet<FilterConfig>
  groupBy: SnapshotFacet<GroupConfig>
  viewMode?: SnapshotFacet<'table' | 'kanban'>
}

interface InitialViewsState {
  views: DataTableView[]
  defaultViewId: string | null
  preserveWorkingState: boolean
}

let fallbackId = 0

function createViewId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  fallbackId += 1
  return `view-${Date.now()}-${fallbackId}`
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? fallback : JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ignore quota errors
  }
}

function normalizeSort(value: SortLevel[] | SortLevel): SortLevel[] {
  return Array.isArray(value) ? value : [value]
}

function comparableView(view: DataTableView) {
  return {
    viewMode: view.viewMode,
    sort: view.sort,
    filter: view.filter,
    groupBy: view.groupBy,
    columns: view.columns,
    rowHeight: view.rowHeight,
  }
}

function viewsDiffer(left: DataTableView, right: DataTableView): boolean {
  return JSON.stringify(comparableView(left)) !== JSON.stringify(comparableView(right))
}

export function useViews({
  storageKey,
  columns,
  sort,
  filter,
  groupBy,
  viewMode,
}: UseViewsOptions) {
  const viewsKey = `${storageKey}-views`
  const activeViewKey = `${storageKey}-active-view`
  const rowHeightRef = useRef<DataTableRowHeight>('medium')

  const capture = useCallback((id: string, name: string): DataTableView => ({
    id,
    name,
    ...(viewMode ? { viewMode: viewMode.getSnapshot() } : {}),
    sort: sort.getSnapshot(),
    filter: filter.getSnapshot(),
    groupBy: groupBy.getSnapshot(),
    columns: columns.getSnapshot(),
    rowHeight: rowHeightRef.current,
  }), [columns, filter, groupBy, sort, viewMode])

  const [initialState] = useState<InitialViewsState>(() => {
    const storedViews = readJson<DataTableView[] | null>(viewsKey, null)
    const storedDefault = localStorage.getItem(activeViewKey)
    const legacyKeys = ['columns', 'sort', 'filters', 'groupby']
      .map((suffix) => `${storageKey}-${suffix}`)
    const hasLegacyState = legacyKeys.some((key) => localStorage.getItem(key) !== null)
    if (Array.isArray(storedViews)) {
      const activeView = storedDefault
        ? storedViews.find((view) => view.id === storedDefault)
        : undefined
      const workingStateDiffers = activeView
        ? viewsDiffer({
            ...activeView,
            sort: sort.getSnapshot(),
            filter: filter.getSnapshot(),
            groupBy: groupBy.getSnapshot(),
            columns: columns.getSnapshot(),
          }, activeView)
        : false
      return {
        views: storedViews,
        defaultViewId: activeView?.id ?? null,
        preserveWorkingState: hasLegacyState && workingStateDiffers,
      }
    }

    if (!hasLegacyState) return { views: [], defaultViewId: null, preserveWorkingState: false }

    const currentColumns = columns.getSnapshot()
    const currentSort = sort.getSnapshot()
    const currentFilter = filter.getSnapshot()
    const currentGroupBy = groupBy.getSnapshot()
    const legacySort = readJson<SortLevel[] | SortLevel>(`${storageKey}-sort`, currentSort)
    const legacyGroupBy = readJson<Partial<GroupConfig> | null>(`${storageKey}-groupby`, currentGroupBy)
    const migratedGroupBy = Array.isArray(legacyGroupBy?.groups)
      ? legacyGroupBy.groups.length === 0 && currentGroupBy.groups.length > 0
        ? currentGroupBy
        : legacyGroupBy as GroupConfig
      : currentGroupBy
    const migrated: DataTableView = {
      id: createViewId(),
      name: 'Default',
      ...(viewMode ? { viewMode: viewMode.getSnapshot() } : {}),
      columns: readJson(`${storageKey}-columns`, currentColumns),
      sort: normalizeSort(legacySort),
      filter: readJson(`${storageKey}-filters`, currentFilter),
      groupBy: migratedGroupBy,
      rowHeight: 'medium',
    }
    writeJson(viewsKey, [migrated])
    try {
      localStorage.setItem(activeViewKey, migrated.id)
    } catch {
      // ignore quota errors
    }
    return { views: [migrated], defaultViewId: migrated.id, preserveWorkingState: true }
  })

  const [views, setViews] = useState(initialState.views)
  const viewsRef = useRef(views)
  viewsRef.current = views
  const [activeViewId, setActiveViewId] = useState<string | null>(initialState.defaultViewId)
  const [defaultViewId, setDefaultViewId] = useState<string | null>(initialState.defaultViewId)
  const [rowHeight, setRowHeightState] = useState<DataTableRowHeight>(() => (
    initialState.views.find((view) => view.id === initialState.defaultViewId)?.rowHeight ?? 'medium'
  ))
  rowHeightRef.current = rowHeight

  const replaceViews = useCallback((next: DataTableView[]) => {
    viewsRef.current = next
    setViews(next)
    writeJson(viewsKey, next)
  }, [viewsKey])

  const applyViewPresentation = useCallback((view: DataTableView) => {
    if (view.viewMode && viewMode) viewMode.restore(view.viewMode)
    const nextRowHeight = view.rowHeight ?? 'medium'
    rowHeightRef.current = nextRowHeight
    setRowHeightState(nextRowHeight)
  }, [viewMode])

  const applyView = useCallback((view: DataTableView) => {
    columns.restore({
      visible: [...view.columns.visible],
      order: [...view.columns.order],
      widths: { ...view.columns.widths },
      frozen: view.columns.frozen ?? 0,
    })
    sort.restore(view.sort)
    filter.restore(view.filter)
    groupBy.restore({
      groups: view.groupBy.groups,
      collapsed: view.groupBy.collapsed ?? [],
      showEmpty: view.groupBy.showEmpty,
    })
    applyViewPresentation(view)
  }, [applyViewPresentation, columns, filter, groupBy, sort])

  const appliedDefaultRef = useRef(false)
  useEffect(() => {
    if (appliedDefaultRef.current || !defaultViewId) return
    appliedDefaultRef.current = true
    const defaultView = viewsRef.current.find((view) => view.id === defaultViewId)
    if (!defaultView) return
    if (initialState.preserveWorkingState) applyViewPresentation(defaultView)
    else applyView(defaultView)
  }, [applyView, applyViewPresentation, defaultViewId, initialState.preserveWorkingState])

  const persistActiveView = useCallback((id: string) => {
    try {
      localStorage.setItem(activeViewKey, id)
    } catch {
      // ignore quota errors
    }
  }, [activeViewKey])

  const saveAs = useCallback((name: string) => {
    const view = capture(createViewId(), name.trim())
    replaceViews([...viewsRef.current, view])
    setActiveViewId(view.id)
    persistActiveView(view.id)
    return view
  }, [capture, persistActiveView, replaceViews])

  const update = useCallback((id: string) => {
    const existing = viewsRef.current.find((view) => view.id === id)
    if (!existing) return
    replaceViews(viewsRef.current.map((view) => (
      view.id === id ? capture(id, existing.name) : view
    )))
  }, [capture, replaceViews])

  const rename = useCallback((id: string, name: string) => {
    replaceViews(viewsRef.current.map((view) => (
      view.id === id ? { ...view, name: name.trim() } : view
    )))
  }, [replaceViews])

  const duplicate = useCallback((id: string) => {
    const source = viewsRef.current.find((view) => view.id === id)
    if (!source) throw new Error(`View "${id}" not found`)
    const copy = { ...source, id: createViewId(), name: `${source.name} copy` }
    replaceViews([...viewsRef.current, copy])
    return copy
  }, [replaceViews])

  const remove = useCallback((id: string) => {
    replaceViews(viewsRef.current.filter((view) => view.id !== id))
    setActiveViewId((current) => current === id ? null : current)
    if (defaultViewId === id) {
      setDefaultViewId(null)
      try {
        localStorage.removeItem(activeViewKey)
      } catch {
        // ignore storage errors
      }
    }
  }, [activeViewKey, defaultViewId, replaceViews])

  const setDefault = useCallback((id: string) => {
    const view = viewsRef.current.find((candidate) => candidate.id === id)
    if (!view) return
    applyView(view)
    setActiveViewId(id)
    setDefaultViewId(id)
    persistActiveView(id)
  }, [applyView, persistActiveView])

  const switchTo = useCallback((id: string) => {
    const view = viewsRef.current.find((candidate) => candidate.id === id)
    if (!view) return
    applyView(view)
    setActiveViewId(id)
    persistActiveView(id)
  }, [applyView, persistActiveView])

  const setRowHeight = useCallback((next: DataTableRowHeight) => {
    rowHeightRef.current = next
    setRowHeightState(next)
  }, [])

  const activeView = views.find((view) => view.id === activeViewId)
  const currentSnapshot = capture(activeViewId ?? '', activeView?.name ?? '')
  const isDirty = activeView ? viewsDiffer(currentSnapshot, activeView) : false

  return {
    views,
    activeViewId,
    defaultViewId,
    isDirty,
    rowHeight,
    setRowHeight,
    saveAs,
    update,
    rename,
    duplicate,
    remove,
    setDefault,
    switchTo,
  }
}
