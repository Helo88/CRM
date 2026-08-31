// Escapes regex metacharacters in user-supplied text search input before
// it's interpolated into a `new RegExp(...)` — without this, a query like
// "a.*" or "(" would either match unintended rows or throw.
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
