export function shortToolId(id?: string): string | null {
  if (!id) return null
  if (id.length <= 14) return id
  return `${id.slice(0, 10)}…`
}