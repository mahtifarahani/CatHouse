/** Find the next enabled menu item for an ARIA navigation key. */
export function nextIndex(current: number, key: string, enabled: boolean[]): number | null {
  const count = enabled.length;
  if (!enabled.some(Boolean)) return null;
  if (key === "Home" || (key === "ArrowDown" && current === -1)) return enabled.findIndex(Boolean);
  if (key === "End" || (key === "ArrowUp" && current === -1)) return enabled.lastIndexOf(true);
  if (key !== "ArrowDown" && key !== "ArrowUp") return null;
  const step = key === "ArrowDown" ? 1 : -1;
  for (let offset = 1; offset <= count; offset++) {
    const index = (current + step * offset + count * 2) % count;
    if (enabled[index]) return index;
  }
  return null;
}
