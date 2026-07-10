/** Shared group styling — used by GroupHeader (header band) and Content (row rail). */

/** Level-tinted group-header background — strongest at the top level, lighter when nested.
 *  Higher-contrast tints so grouped rows stand out clearly from data rows. */
export function groupBg(level: number, stuck: boolean): string {
  const tint = level <= 0 ? 32 : level === 1 ? 21 : 13
  const base = stuck ? 'var(--dt-bg, #14142a)' : 'var(--dt-bg-secondary, #1f2937)'
  return `color-mix(in srgb, var(--dt-primary, #6366f1) ${tint}%, ${base})`
}

/** Left accent colour for a group — fades with depth. */
export function groupAccent(level: number): string {
  const alpha = level <= 0 ? 90 : level === 1 ? 55 : 30
  return `color-mix(in srgb, var(--dt-primary, #6366f1) ${alpha}%, transparent)`
}

/** Accent rail applied to the first rendered cell of a group's rows. */
export function groupRail(level: number): string {
  return `inset 3px 0 0 0 ${groupAccent(level)}`
}
