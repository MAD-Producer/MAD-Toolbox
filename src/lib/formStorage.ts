export function loadStoredForm<T extends object>(key: string, defaults: T): T {
  const restored: T = { ...defaults };
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
    if (saved && typeof saved === "object" && !Array.isArray(saved)) {
      Object.assign(restored, saved);
    }
  } catch {}
  return restored;
}

export function saveStoredForm(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}
