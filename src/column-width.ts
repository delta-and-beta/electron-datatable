export const DEFAULT_MIN_COLUMN_WIDTH = '140px'

export type ColumnWidth = string | number

export function toCssWidth(width: ColumnWidth): string {
  return typeof width === 'number' ? `${width}px` : width
}

export function pixelWidthValue(width: ColumnWidth): number | undefined {
  if (typeof width === 'number') return width
  const normalized = width.trim()
  if (!/^\d+(?:\.\d+)?(?:px)?$/.test(normalized)) return undefined
  return Number.parseFloat(normalized)
}

export function clampColumnWidth(
  width: ColumnWidth,
  minWidth: string = DEFAULT_MIN_COLUMN_WIDTH,
): string {
  const widthCss = toCssWidth(width)
  const widthPixels = pixelWidthValue(width)
  const minPixels = pixelWidthValue(minWidth)

  if (widthPixels !== undefined && minPixels !== undefined) {
    return `${Math.max(widthPixels, minPixels)}px`
  }

  return widthCss === minWidth ? widthCss : `max(${widthCss}, ${minWidth})`
}
