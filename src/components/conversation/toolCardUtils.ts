export function shortToolId(id?: string): string | null {
  if (!id) return null
  if (id.length <= 64) return id
  return `${id.slice(0, 64)}…`
}