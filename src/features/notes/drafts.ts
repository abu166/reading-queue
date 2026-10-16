import type { Note } from "../../lib/domain";
export function readDraft(key: string): Note | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw);
    return typeof value.body === "string" && Number.isInteger(value.version)
      ? value
      : null;
  } catch {
    return null;
  }
}
export function writeDraft(key: string, note: Note | null): boolean {
  try {
    if (note) sessionStorage.setItem(key, JSON.stringify(note));
    else sessionStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
