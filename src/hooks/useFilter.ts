import { useState, useMemo, useCallback, useEffect } from 'react'
import type { RowData, ColumnDef, FilterGroup, FilterConfig, FilterCondition } from '../types'
import { filterRecords, createEmptyGroup, createEmptyCondition, countConditions } from '../lib/filter'

const MAX_DEPTH = 3

interface UseFilterOptions<T extends RowData> {
  data: T[]
  columns: ColumnDef<T>[]
  storageKey?: string
}

function updateGroupInTree(root: FilterGroup, groupId: string, updater: (group: FilterGroup) => FilterGroup): FilterGroup {
  if (root.id === groupId) return updater(root)
  return {
    ...root,
    groups: root.groups.map((g) => updateGroupInTree(g, groupId, updater)),
  }
}

function removeGroupFromTree(root: FilterGroup, groupId: string): FilterGroup {
  return {
    ...root,
    groups: root.groups
      .filter((g) => g.id !== groupId)
      .map((g) => removeGroupFromTree(g, groupId)),
  }
}

function findGroupDepth(root: FilterGroup, groupId: string, currentDepth: number = 1): number {
  if (root.id === groupId) return currentDepth
  for (const g of root.groups) {
    const depth = findGroupDepth(g, groupId, currentDepth + 1)
    if (depth > 0) return depth
  }
  return 0
}

function validateFilterGroup(group: FilterGroup, validFields: Set<string>): FilterGroup {
  return {
    ...group,
    conditions: group.conditions.filter((c) => validFields.has(c.field)),
    groups: group.groups.map((g) => validateFilterGroup(g, validFields)),
  }
}

export function useFilter<T extends RowData>({
  data,
  columns,
  storageKey,
}: UseFilterOptions<T>) {
  const fullKey = storageKey ? `${storageKey}-filters` : null

  const [root, setRoot] = useState<FilterGroup>(() => {
    if (!fullKey) return createEmptyGroup()
    try {
      const saved = localStorage.getItem(fullKey)
      if (saved) {
        const config: FilterConfig = JSON.parse(saved)
        const validFields = new Set(columns.filter((c) => c.filterable !== false).map((c) => c.id))
        return validateFilterGroup(config.root, validFields)
      }
    } catch {
      // ignore
    }
    return createEmptyGroup()
  })

  const [enabled, setEnabled] = useState<boolean>(() => {
    if (!fullKey) return true
    try {
      const saved = localStorage.getItem(fullKey)
      if (saved) {
        const config: FilterConfig = JSON.parse(saved)
        return config.enabled
      }
    } catch {
      // ignore
    }
    return true
  })

  useEffect(() => {
    if (!fullKey) return
    const config: FilterConfig = { root, enabled }
    try {
      localStorage.setItem(fullKey, JSON.stringify(config))
    } catch {
      // ignore quota errors
    }
  }, [fullKey, root, enabled])

  const filteredData = useMemo(() => {
    if (!enabled || countConditions(root) === 0) return data
    return filterRecords(data, root, columns)
  }, [data, root, enabled, columns])

  const activeCount = useMemo(() => countConditions(root), [root])

  const addCondition = useCallback((groupId: string, field: string) => {
    setRoot((prev) =>
      updateGroupInTree(prev, groupId, (g) => ({
        ...g,
        conditions: [...g.conditions, createEmptyCondition(field)],
      })),
    )
  }, [])

  const removeCondition = useCallback((groupId: string, conditionId: string) => {
    setRoot((prev) =>
      updateGroupInTree(prev, groupId, (g) => ({
        ...g,
        conditions: g.conditions.filter((c) => c.id !== conditionId),
      })),
    )
  }, [])

  const updateCondition = useCallback((groupId: string, conditionId: string, updates: Partial<FilterCondition>) => {
    setRoot((prev) =>
      updateGroupInTree(prev, groupId, (g) => ({
        ...g,
        conditions: g.conditions.map((c) => (c.id === conditionId ? { ...c, ...updates } : c)),
      })),
    )
  }, [])

  const addGroup = useCallback((parentGroupId: string) => {
    setRoot((prev) => {
      const parentDepth = findGroupDepth(prev, parentGroupId)
      if (parentDepth >= MAX_DEPTH) return prev
      return updateGroupInTree(prev, parentGroupId, (g) => ({
        ...g,
        groups: [...g.groups, createEmptyGroup()],
      }))
    })
  }, [])

  const removeGroup = useCallback((groupId: string) => {
    setRoot((prev) => removeGroupFromTree(prev, groupId))
  }, [])

  const updateConjunction = useCallback((groupId: string, conjunction: 'and' | 'or') => {
    setRoot((prev) =>
      updateGroupInTree(prev, groupId, (g) => ({ ...g, conjunction })),
    )
  }, [])

  const clearAll = useCallback(() => {
    setRoot(createEmptyGroup())
  }, [])

  return {
    root,
    filteredData,
    enabled,
    setEnabled,
    activeCount,
    addCondition,
    removeCondition,
    updateCondition,
    addGroup,
    removeGroup,
    updateConjunction,
    clearAll,
  }
}
