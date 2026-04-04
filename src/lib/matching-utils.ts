export const DEFAULT_ACCEPTED_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/gif',
] as const

export function filterByMimeType(files: File[], acceptedTypes: readonly string[]): File[] {
  return files.filter((f) => acceptedTypes.includes(f.type))
}

export async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}
