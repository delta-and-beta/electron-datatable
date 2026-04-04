/** Log a warning in development. Tree-shaken out of production builds. */
export function devWarn(condition: boolean, message: string): void {
  if (condition && process.env.NODE_ENV !== 'production') {
    console.warn(`[DataTable] ${message}`)
  }
}
