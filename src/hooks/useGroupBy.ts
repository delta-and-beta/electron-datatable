import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import type { ColumnDef, GroupLevel, GroupConfig, GroupedSection } from '../types'
import { groupRecords } from '../lib/group-by'

const MAX_LEVELS = 3

function isGroupable<T extends object>(column: ColumnDef<T>): boolean {
  return column.groupable !== false && column.type !== 'tags'
}

interface UseGroupByOptions<T extends object> {
  data: T[]
  columns: ColumnDef<T>[]
  sumFields?: string[]
  storageKey?: string
  defaultLevels?: GroupLevel[]
  seedLevelWhenEmpty?: GroupLevel
}

export function useGroupBy<T extends object>({
  data,
  columns,
  sumFields = [],
  storageKey,
  defaultLevels = [],
  seedLevelWhenEmpty,
}: UseGroupByOptions<T>) {
  const fullKey = storageKey ? `${storageKey}-groupby` : null

  // Load initial state from localStorage, falling back to defaultLevels
  const [levels, setLevels] = useState<GroupLevel[]>(() => {
    const validFields = new Set(columns.filter(isGroupable).map((column) => column.id))
    const tagFields = new Set(columns.filter((column) => column.type === 'tags').map((column) => column.id))
    if (fullKey) {
      try {
        const saved = localStorage.getItem(fullKey)
        if (saved) {
          const config = JSON.parse(saved)
          if (config && Array.isArray(config.groups)) {
            const savedLevels = config.groups.filter(
              (g: unknown) => g && typeof g === 'object' && 'field' in g && typeof (g as GroupLevel).field === 'string' && validFields.has((g as GroupLevel).field)
            )
            if (savedLevels.length > 0) return savedLevels
            if (seedLevelWhenEmpty && validFields.has(seedLevelWhenEmpty.field)) {
              return [seedLevelWhenEmpty]
            }
            return []
          }
        }
      } catch {
        // ignore
      }
    }
    const initialLevels = defaultLevels.filter((level) => !tagFields.has(level.field))
    if (initialLevels.length > 0) return initialLevels
    return seedLevelWhenEmpty && validFields.has(seedLevelWhenEmpty.field)
      ? [seedLevelWhenEmpty]
      : []
  })

  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    if (!fullKey) return new Set()
    try {
      const saved = localStorage.getItem(fullKey)
      if (saved) {
        const config = JSON.parse(saved)
        if (config && Array.isArray(config.collapsed)) {
          return new Set(config.collapsed.filter((v: unknown) => typeof v === 'string'))
        }
      }
    } catch {
      // ignore
    }
    return new Set()
  })

  const [showEmpty, setShowEmpty] = useState<boolean>(() => {
    if (!fullKey) return false
    try {
      const saved = localStorage.getItem(fullKey)
      if (saved) {
        const config = JSON.parse(saved)
        if (config && typeof config.showEmpty === 'boolean') {
          return config.showEmpty
        }
      }
    } catch {
      // ignore
    }
    return false
  })
  const levelsRef = useRef(levels)
  const collapsedRef = useRef(collapsed)
  const showEmptyRef = useRef(showEmpty)
  const columnsRef = useRef(columns)
  const fullKeyRef = useRef(fullKey)
  levelsRef.current = levels
  collapsedRef.current = collapsed
  showEmptyRef.current = showEmpty
  columnsRef.current = columns
  fullKeyRef.current = fullKey

  // Persist to localStorage
  useEffect(() => {
    if (!fullKey) return
    const config: GroupConfig = {
      groups: levels,
      collapsed: [...collapsed],
      showEmpty,
    }
    try {
      localStorage.setItem(fullKey, JSON.stringify(config))
    } catch {
      // ignore quota errors
    }
  }, [fullKey, levels, collapsed, showEmpty])

  // Compute grouped data
  const groupedData = useMemo<GroupedSection<T>[]>(() => {
    if (levels.length === 0) return []
    const sumFieldIds =
      sumFields.length > 0
        ? sumFields
        : columns.filter((c) => c.sumInGroup !== false && (c.type === 'number' || c.type === 'currency')).map((c) => c.id)
    return groupRecords(data, levels, columns, sumFieldIds)
  }, [data, levels, columns, sumFields])

  const isGrouped = levels.length > 0

  // Actions
  const addGroup = useCallback(
    (field: string) => {
      setLevels((prev) => {
        if (prev.length >= MAX_LEVELS) return prev
        if (prev.some((g) => g.field === field)) return prev
        const column = columns.find((c) => c.id === field)
        if (column?.type === 'tags') return prev
        return [
          ...prev,
          {
            field,
            sort: column?.type === 'date' ? 'desc' : 'asc',
            datePeriod: column?.type === 'date' ? 'month' : undefined,
          },
        ]
      })
    },
    [columns],
  )

  const removeGroup = useCallback((index: number) => {
    setLevels((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const updateGroup = useCallback((index: number, updates: Partial<GroupLevel>) => {
    setLevels((prev) => {
      const column = updates.field ? columns.find((candidate) => candidate.id === updates.field) : undefined
      if (column?.type === 'tags') return prev
      return prev.map((g, i) => (i === index ? { ...g, ...updates } : g))
    })
  }, [columns])

  const reorderGroups = useCallback((fromIndex: number, toIndex: number) => {
    setLevels((prev) => {
      const next = [...prev]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      return next
    })
  }, [])

  const clearGroups = useCallback(() => {
    setLevels([])
    setCollapsed(new Set())
  }, [])

  // Collapse state
  const toggleCollapse = useCallback((groupPath: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(groupPath)) {
        next.delete(groupPath)
      } else {
        next.add(groupPath)
      }
      return next
    })
  }, [])

  const collapseAll = useCallback(() => {
    const allPaths = new Set<string>()
    function collectPaths(sections: GroupedSection<T>[], prefix: string) {
      for (const section of sections) {
        const path = prefix ? `${prefix}/${section.key}` : section.key
        allPaths.add(path)
        if (section.subgroups.length > 0) {
          collectPaths(section.subgroups, path)
        }
      }
    }
    collectPaths(groupedData, '')
    setCollapsed(allPaths)
  }, [groupedData])

  const expandAll = useCallback(() => {
    setCollapsed(new Set())
  }, [])

  const isCollapsed = useCallback(
    (groupPath: string) => collapsed.has(groupPath),
    [collapsed],
  )

  const getSnapshot = useCallback((): GroupConfig => ({
    groups: levelsRef.current.map((level) => ({ ...level })),
    collapsed: [...collapsedRef.current],
    showEmpty: showEmptyRef.current,
  }), [])

  const restore = useCallback((snapshot: GroupConfig) => {
    const validFields = new Set(columnsRef.current.filter(isGroupable).map((column) => column.id))
    const next: GroupConfig = {
      groups: snapshot.groups
        .filter((level) => validFields.has(level.field))
        .map((level) => ({ ...level })),
      collapsed: [...(snapshot.collapsed ?? [])],
      showEmpty: snapshot.showEmpty,
    }
    if (fullKeyRef.current) {
      try {
        localStorage.setItem(fullKeyRef.current, JSON.stringify(next))
      } catch {
        // ignore quota errors
      }
    }
    const nextCollapsed = new Set(next.collapsed)
    levelsRef.current = next.groups
    collapsedRef.current = nextCollapsed
    showEmptyRef.current = next.showEmpty
    setLevels(next.groups)
    setCollapsed(nextCollapsed)
    setShowEmpty(next.showEmpty)
  }, [])

  return {
    levels,
    groupedData,
    isGrouped,
    addGroup,
    removeGroup,
    updateGroup,
    reorderGroups,
    clearGroups,
    toggleCollapse,
    collapseAll,
    expandAll,
    isCollapsed,
    showEmpty,
    setShowEmpty,
    getSnapshot,
    restore,
  }
}
