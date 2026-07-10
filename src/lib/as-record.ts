/** Centralized coercion for internal dynamic field access. */
export function asRecord<T extends object>(row: T): Record<string, unknown> {
  return row as Record<string, unknown>
}
