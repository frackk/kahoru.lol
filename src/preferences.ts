export interface Preferences {
  compact: boolean;
}
export const defaultPreferences: Preferences = { compact: false };
export function readPreferences(raw: string | null): Preferences {
  try {
    const value: unknown = JSON.parse(raw ?? "null");
    if (
      typeof value === "object" &&
      value !== null &&
      "compact" in value &&
      typeof value.compact === "boolean"
    ) {
      return { compact: value.compact };
    }
  } catch {
    /* Un ajuste corrupto no debe impedir el inicio. */
  }
  return { ...defaultPreferences };
}
