export function safeStorage(): Storage | null {
  try {
    const s = window.localStorage
    s.getItem('fdi:probe')
    return s
  } catch {
    return null
  }
}
