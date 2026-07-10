/**
 * Collapse-state path helpers.
 *
 * Group paths are stored as '/'-joined segments (and persisted to
 * localStorage), so raw group values containing '/' would make distinct
 * paths collide (e.g. top-level "N/A" vs nested "N" → "A"). Each segment
 * is therefore percent-escaped before joining.
 */

export function encodeGroupSegment(key: string): string {
  return key.replace(/%/g, '%25').replace(/\//g, '%2F')
}

export function joinGroupPath(parentPath: string, key: string): string {
  const segment = encodeGroupSegment(key)
  return parentPath ? `${parentPath}/${segment}` : segment
}
